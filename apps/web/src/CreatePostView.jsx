import React, { useState } from 'react';

export default function CreatePostView({ user, profile, onCreatePost }) {
  const [body, setBody] = useState('');
  const [media, setMedia] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (busy || (!body.trim() && !media)) return;
    if (!onCreatePost) {
      window.dispatchEvent(new CustomEvent('ofsocio:notice', { detail: 'Post publishing requires a signed-in account connected to Ofsocio.' }));
      return;
    }
    setBusy(true);
    try {
      const success = await onCreatePost(body.trim(), media);
      if (success) {
        setBody('');
        setMedia(null);
        window.dispatchEvent(new CustomEvent('ofsocio:navigate', { detail: 'home' }));
      }
    } finally {
      setBusy(false);
    }
  }

  return <>
    <div className="view-heading"><div><div className="eyebrow">SHARE WITH YOUR CIRCLE</div><h1>Create a post</h1><p>Share an update, photo or video with Ofsocio members.</p></div></div>
    <form className="composer panel create-post-page" onSubmit={submit}>
      <div className="create-post-avatar">{profile?.display_name?.slice(0,1)?.toUpperCase() || user?.email?.slice(0,1)?.toUpperCase() || 'O'}</div>
      <div className="composer-main">
        <div className="create-post-author"><strong>{profile?.display_name || user?.email?.split('@')[0] || 'Your profile'}</strong><span>Posting as your account · Public audience</span></div>
        <textarea value={body} onChange={event => setBody(event.target.value)} placeholder="What would you like to share?" aria-label="Write your post" rows={7} maxLength={5000}/>
        <div className="create-post-attachment"><label className="composer-file-button">＋ Add photo or video<input type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm" hidden onChange={event => setMedia(event.target.files?.[0] || null)}/></label>{media && <span className="create-post-file-name">{media.name}<button type="button" onClick={() => setMedia(null)} aria-label="Remove attachment">×</button></span>}</div>
        <div className="composer-actions"><span className="create-post-limit">Up to 50 MB · JPG, PNG, WebP, GIF, MP4, MOV or WebM</span><button className="button primary" type="submit" disabled={busy || (!body.trim() && !media)}>{busy ? 'Publishing…' : 'Publish post'}</button></div>
      </div>
    </form>
  </>;
}
