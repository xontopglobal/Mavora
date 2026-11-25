import React, { useEffect, useState } from 'react';

const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() || '').join('') || 'O';

export default function LiveProfileView({ supabase, user, isPrivate = false, onPrivacyChange, onNotice }) {
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [stories, setStories] = useState([]);
  const [following, setFollowing] = useState([]);
  const [tab, setTab] = useState('Posts');
  const [edit, setEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ display_name: '', username: '', bio: '', country_code: '' });
  const [avatarUrl, setAvatarUrl] = useState('');
  const [storyCaption, setStoryCaption] = useState('');

  async function load() {
    if (!supabase || !user?.id) return;
    const [p, postResult, storyResult, followResult] = await Promise.all([
      supabase.from('profiles').select('id,username,display_name,bio,country_code,avatar_url,is_private,follower_list_visibility,created_at').eq('id', user.id).maybeSingle(),
      supabase.from('posts').select('id,body,media_urls,visibility,created_at').eq('author_id', user.id).order('created_at', { ascending: false }).limit(50),
      supabase.from('stories').select('id,user_id,media_path,media_type,caption,created_at,expires_at').eq('user_id', user.id).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }),
      supabase.from('follows').select('followed_id,created_at').eq('follower_id', user.id).order('created_at', { ascending: false })
    ]);
    if (p.error) throw p.error;
    setProfile(p.data);
    setDraft({ display_name: p.data?.display_name || '', username: p.data?.username || '', bio: p.data?.bio || '', country_code: p.data?.country_code || '' });
    if (postResult.error) throw postResult.error;
    const postRows = await Promise.all((postResult.data || []).map(async post => ({ ...post, signed_media: await Promise.all((post.media_urls || []).map(async value => { if (!value || value.startsWith('http')) return value; const { data } = await supabase.storage.from('social-media').createSignedUrl(value, 3600); return data?.signedUrl || ''; })) })));
    setPosts(postRows);
    if (storyResult.error) throw storyResult.error;
    const storyRows = storyResult.data || [];
    const signedStories = await Promise.all(storyRows.map(async story => {
      const { data } = await supabase.storage.from('social-media').createSignedUrl(story.media_path, 3600);
      return { ...story, signed_url: data?.signedUrl || '' };
    }));
    setStories(signedStories);
    if (followResult.error) throw followResult.error;
    const followingRows = followResult.data || [];
    const followingIds = followingRows.map(row => row.followed_id);
    let followingProfiles = [];
    if (followingIds.length) { const { data, error } = await supabase.from('profiles').select('id,username,display_name').in('id', followingIds); if (error) throw error; followingProfiles = data || []; }
    const followingMap = new Map(followingProfiles.map(row => [row.id, row]));
    setFollowing(followingRows.map(row => ({ ...row, profile: followingMap.get(row.followed_id) || {} })));
    if (p.data?.avatar_url) {
      if (p.data.avatar_url.startsWith('http')) setAvatarUrl(p.data.avatar_url);
      else { const { data } = await supabase.storage.from('avatars').createSignedUrl(p.data.avatar_url, 3600); setAvatarUrl(data?.signedUrl || ''); }
    } else setAvatarUrl('');
  }

  useEffect(() => { load().catch(error => onNotice?.(error.message)); }, [supabase, user?.id]);

  async function uploadStory(event) {
    const file = event.target.files?.[0];
    if (!file || !supabase || !user?.id) return;
    const allowed = ['image/jpeg','image/png','image/webp','video/mp4','video/webm'];
    if (!allowed.includes(file.type) || file.size > 100 * 1024 * 1024) { onNotice?.('Choose JPG, PNG, WebP, MP4, or WebM up to 100 MB.'); event.target.value=''; return; }
    setSaving(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || (file.type.startsWith('video/')?'mp4':'jpg');
      const path = `${user.id}/stories/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('social-media').upload(path,file,{contentType:file.type,upsert:false});
      if (uploadError) throw uploadError;
      const expires = new Date(Date.now()+24*60*60*1000).toISOString();
      const { error: insertError } = await supabase.from('stories').insert({user_id:user.id,media_path:path,media_type:file.type.startsWith('video/')?'video':'image',caption:storyCaption.trim(),expires_at:expires});
      if (insertError) { await supabase.storage.from('social-media').remove([path]); throw insertError; }
      setStoryCaption(''); await load(); onNotice?.('Story published. It will expire in 24 hours.');
    } catch (error) { onNotice?.(error.message); }
    finally { setSaving(false); event.target.value=''; }
  }

  async function saveProfile(event) {
    event.preventDefault();
    if (!supabase || !user?.id) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.from('profiles').update({
        display_name: draft.display_name.trim() || null,
        username: draft.username.trim().replace(/^@/, '').toLowerCase() || null,
        bio: draft.bio.trim() || null,
        country_code: draft.country_code.trim().toUpperCase() || null,
        updated_at: new Date().toISOString()
      }).eq('id', user.id).select('id,username,display_name,bio,country_code,avatar_url,is_private,follower_list_visibility,created_at').single();
      if (error) throw error;
      setProfile(data); setEdit(false); onNotice?.('Profile updated successfully.');
    } catch (error) { onNotice?.(error.message); }
    finally { setSaving(false); }
  }

  async function uploadAvatar(event) {
    const file = event.target.files?.[0];
    if (!file || !supabase || !user?.id) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      onNotice?.('Choose a JPG, PNG, or WebP image up to 5 MB.'); return;
    }
    setSaving(true);
    let uploadedPath = null;
    try {
      const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
      const path = `${user.id}/${Date.now()}.${extension}`; uploadedPath = path;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      const { error: updateError } = await supabase.from('profiles').update({ avatar_url: path, updated_at: new Date().toISOString() }).eq('id', user.id);
      if (updateError) throw updateError;
      await load(); onNotice?.('Profile photo updated.');
    } catch (error) { if (uploadedPath) await supabase.storage.from('avatars').remove([uploadedPath]); onNotice?.(error.message); }
    finally { setSaving(false); event.target.value = ''; }
  }

  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'Ofsocio member';
  return <section className="live-profile">
    <div className="live-profile-cover" />
    <div className="live-profile-head">
      <div className="live-profile-avatar">{avatarUrl ? <img src={avatarUrl} alt="Profile"/> : <span>{initials(displayName)}</span>}</div>
      <div className="live-profile-actions"><button className="button outline small-button" type="button" onClick={()=>onPrivacyChange?.(!isPrivate)}>{isPrivate?'Private':'Public'}</button><label className="button outline small-button">Change photo<input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={uploadAvatar} disabled={saving}/></label><button className="button primary small-button" onClick={() => setEdit(value => !value)}>{edit ? 'Cancel edit' : 'Edit profile'}</button></div>
    </div>
    {edit && <form className="live-profile-edit panel" onSubmit={saveProfile}><label>Display name<input value={draft.display_name} onChange={e => setDraft({...draft,display_name:e.target.value})} maxLength={80}/></label><label>Username<input value={draft.username} onChange={e => setDraft({...draft,username:e.target.value})} maxLength={30}/></label><label>Bio<textarea value={draft.bio} onChange={e => setDraft({...draft,bio:e.target.value})} maxLength={280}/></label><label>Country code<input value={draft.country_code} onChange={e => setDraft({...draft,country_code:e.target.value})} maxLength={2} placeholder="NG"/></label><button className="button primary" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</button></form>}
    <div className="live-profile-summary"><h1>{displayName}</h1><p>{profile?.username ? `@${profile.username}` : user?.email || ''}</p><p>{profile?.bio || 'Add a short introduction to help your circles know you.'}</p><div className="live-profile-stats"><span><strong>{posts.length}</strong> posts</span><span><strong>{stories.length}</strong> active stories</span><span><strong>{following.length}</strong> following</span></div></div>
    <div className="live-story-upload panel"><div><strong>Share a story</strong><small>Stories use the existing private media bucket and expire after 24 hours.</small></div><input value={storyCaption} onChange={e=>setStoryCaption(e.target.value)} placeholder="Add a caption (optional)" maxLength={280}/><label className="button primary small-button">Choose media<input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" hidden onChange={uploadStory} disabled={saving}/></label></div>
    <div className="live-profile-tabs">{['Posts','Stories','Following','About'].map(name => <button key={name} className={tab===name?'active':''} onClick={()=>setTab(name)}>{name}</button>)}</div>
    <div className="live-profile-content">
      {tab==='Posts' && (posts.length ? posts.map(post => <article className="live-activity-card" key={post.id}><time>{new Date(post.created_at).toLocaleString()}</time><p>{post.body || ''}</p>{(post.signed_media || []).filter(Boolean).map(url => <img className="live-post-media" key={url} src={url} alt="Post media"/>)}<small>Audience: {post.visibility}</small></article>) : <div className="empty-state">Your posts will appear here when you share something.</div>)}
      {tab==='Stories' && (stories.length ? stories.map(story => <article className="live-activity-card" key={story.id}><time>Expires {new Date(story.expires_at).toLocaleString()}</time><p>{story.caption}</p>{story.signed_url && <img className="live-post-media" src={story.signed_url} alt="Story"/>}</article>) : <div className="empty-state">You have no active stories. Stories expire after 24 hours.</div>)}
      {tab==='Following' && (following.length ? <ul className="live-follow-list">{following.map(row=><li key={row.followed_id}>{row.profile?.display_name || row.profile?.username || row.followed_id}</li>)}</ul> : <div className="empty-state">You are not following anyone yet.</div>)}
      {tab==='About' && <div className="live-activity-card"><p>{profile?.bio || 'No bio added yet.'}</p><p>{profile?.country_code || 'Country not set'}</p><p>Member since {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'joining Ofsocio'}</p></div>}
    </div>
  </section>;
}
