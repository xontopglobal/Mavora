import React, { useEffect, useMemo, useState } from 'react';

function Notice({ children }) { return children ? <p className="live-feature-notice" role="status">{children}</p> : null; }
function Empty({ title, body }) { return <div className="live-feature-empty"><strong>{title}</strong><p>{body}</p></div>; }

export function LiveMessagesView({ supabase, user, onNotice }) {
  const [conversations,setConversations]=useState([]);
  const [selected,setSelected]=useState('');
  const [messages,setMessages]=useState([]);
  const [draft,setDraft]=useState('');
  const [username,setUsername]=useState('');
  const [peer,setPeer]=useState(null);
  const [busy,setBusy]=useState(false);
  const [searchBusy,setSearchBusy]=useState(false);
  const [error,setError]=useState('');
  const loadConversations=async()=>{
    if(!supabase||!user?.id)return;
    const {data:members,error:memberError}=await supabase.from('conversation_members').select('conversation_id').eq('user_id',user.id);
    if(memberError)throw memberError;
    const ids=[...new Set((members||[]).map(x=>x.conversation_id))];
    if(!ids.length){setConversations([]);setSelected('');return;}
    const {data:allMembers,error:allError}=await supabase.from('conversation_members').select('conversation_id,user_id').in('conversation_id',ids);
    if(allError)throw allError;
    const otherIds=[...new Set((allMembers||[]).filter(x=>x.user_id!==user.id).map(x=>x.user_id))];
    const {data:profiles,error:profileError}=otherIds.length?await supabase.from('profiles').select('id,username,display_name,avatar_url').in('id',otherIds):{data:[],error:null};
    if(profileError)throw profileError;
    const profileMap=new Map((profiles||[]).map(p=>[p.id,p]));
    const peerMap=new Map((allMembers||[]).filter(x=>x.user_id!==user.id).map(x=>[x.conversation_id,profileMap.get(x.user_id)]));
    const {data:latest,error:latestError}=await supabase.from('messages').select('id,conversation_id,body,created_at,sender_id').in('conversation_id',ids).order('created_at',{ascending:false}).limit(100);
    if(latestError)throw latestError;
    const lastMap=new Map();(latest||[]).forEach(m=>{if(!lastMap.has(m.conversation_id))lastMap.set(m.conversation_id,m);});
    const rows=ids.map(id=>({id,peer:peerMap.get(id)||{},last:lastMap.get(id)})).sort((a,b)=>new Date(b.last?.created_at||0)-new Date(a.last?.created_at||0));
    setConversations(rows);if(!selected&&rows[0])setSelected(rows[0].id);
  };
  useEffect(()=>{loadConversations().catch(e=>setError(e.message));},[supabase,user?.id]);
  useEffect(()=>{
    if(!selected||!supabase)return;
    let active=true;
    const load=async()=>{const {data,error}=await supabase.from('messages').select('id,conversation_id,sender_id,body,created_at').eq('conversation_id',selected).order('created_at',{ascending:true}).limit(300);if(error)throw error;if(active)setMessages(data||[]);};
    load().catch(e=>setError(e.message));
    const channel=supabase.channel(`ofsocio-chat-${selected}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:`conversation_id=eq.${selected}`},payload=>{if(active)setMessages(prev=>prev.some(m=>m.id===payload.new.id)?prev:[...prev,payload.new]);}).subscribe();
    return()=>{active=false;supabase.removeChannel(channel);};
  },[selected,supabase]);
  const active=conversations.find(c=>c.id===selected);
  async function findPerson(e){e.preventDefault();setSearchBusy(true);setError('');try{const name=username.trim().replace(/^@/,'').toLowerCase();if(!name)throw new Error('Enter a username.');const {data,error}=await supabase.from('profiles').select('id,username,display_name,avatar_url').eq('username',name).maybeSingle();if(error)throw error;if(!data)throw new Error('No member found with that username.');if(data.id===user.id)throw new Error('You cannot start a conversation with yourself.');setPeer(data);}catch(e){setError(e.message);}finally{setSearchBusy(false);}}
  async function startChat(){if(!peer)return;setBusy(true);try{const {data,error}=await supabase.rpc('start_ofsocio_direct_conversation',{p_other_user_id:peer.id});if(error)throw error;await loadConversations();setSelected(data);setPeer(null);setUsername('');}catch(e){setError(e.message);}finally{setBusy(false);}}
  async function send(e){e.preventDefault();if(!draft.trim()||!selected)return;setBusy(true);try{const {data,error}=await supabase.from('messages').insert({conversation_id:selected,sender_id:user.id,body:draft.trim()}).select('id,conversation_id,sender_id,body,created_at').single();if(error)throw error;setMessages(prev=>prev.some(m=>m.id===data.id)?prev:[...prev,data]);setDraft('');}catch(e){setError(e.message);}finally{setBusy(false);}}
  return <><div className="view-heading"><div><div className="eyebrow">REAL CONVERSATIONS</div><h1>Messages</h1><p>Private conversations between Ofsocio members.</p></div><button className="button primary" type="button" onClick={()=>{setPeer(null);setUsername('');setError('');document.getElementById('ofsocio-new-chat')?.scrollIntoView({behavior:'smooth'});}}>＋ New message</button></div>
    <form id="ofsocio-new-chat" className="live-feature-form panel" onSubmit={findPerson}><label>Start a conversation by username<input value={username} onChange={e=>setUsername(e.target.value)} placeholder="Enter username" maxLength={30}/></label><button className="button outline" disabled={searchBusy}>{searchBusy?'Searching…':'Find member'}</button>{peer&&<div className="live-feature-result"><strong>{peer.display_name||peer.username}</strong><span>@{peer.username}</span><button type="button" className="button primary" onClick={startChat} disabled={busy}>{busy?'Opening…':'Message'}</button></div>}</form><Notice>{error}</Notice>
    <div className="live-message-layout panel"><aside className="live-message-list"><h2>Your conversations</h2>{conversations.length?conversations.map(c=><button key={c.id} className={`live-conversation ${selected===c.id?'active':''}`} onClick={()=>setSelected(c.id)}><strong>{c.peer?.display_name||c.peer?.username||'Ofsocio member'}</strong><span>{c.last?.body||'Conversation started'}</span></button>):<Empty title="No conversations yet" body="Find a member by username above to start a private conversation."/>}</aside><section className="live-chat"><header><strong>{active?.peer?.display_name||active?.peer?.username||'Select a conversation'}</strong></header><div className="live-chat-history">{messages.map(m=><article className={`live-chat-bubble ${m.sender_id===user.id?'mine':''}`} key={m.id}><p>{m.body}</p><time>{new Date(m.created_at).toLocaleString()}</time></article>)}{active&&!messages.length&&<Empty title="Conversation started" body="Send the first message to begin."/>}</div><form className="live-chat-compose" onSubmit={send}><input value={draft} onChange={e=>setDraft(e.target.value)} placeholder={active?'Write a message…':'Choose a conversation first'} disabled={!active||busy} maxLength={5000}/><button className="button primary" disabled={!active||!draft.trim()||busy}>Send</button></form></section></div></>;
}

export function LiveGroupsView({supabase,user,onNotice}) {
 const [groups,setGroups]=useState([]),[joined,setJoined]=useState([]),[requests,setRequests]=useState([]),[query,setQuery]=useState(''),[name,setName]=useState(''),[description,setDescription]=useState(''),[visibility,setVisibility]=useState('public'),[creating,setCreating]=useState(false),[busy,setBusy]=useState(''),[error,setError]=useState('');
 const load=async()=>{const {data,error}=await supabase.from('groups').select('id,owner_id,name,description,visibility,created_at').or(`visibility.eq.public,owner_id.eq.${user.id}`).order('created_at',{ascending:false}).limit(100);if(error)throw error;setGroups(data||[]);const {data:m,error:me}=await supabase.from('group_members').select('group_id,status').eq('user_id',user.id);if(me)throw me;setJoined(m||[]);
 const owned=(data||[]).filter(g=>g.owner_id===user.id).map(g=>g.id);
 if(owned.length){const {data:r,error:re}=await supabase.from('group_members').select('group_id,user_id,role,status,created_at').in('group_id',owned).eq('status','pending');if(re)throw re;setRequests(r||[]);}else setRequests([]);
};
 useEffect(()=>{load().catch(e=>setError(e.message));},[supabase,user?.id]);
 const filtered=useMemo(()=>groups.filter(g=>`${g.name} ${g.description||''}`.toLowerCase().includes(query.toLowerCase())),[groups,query]);
 async function create(e){e.preventDefault();if(!name.trim())return;setCreating(true);setError('');try{const {data,error}=await supabase.from('groups').insert({owner_id:user.id,name:name.trim(),description:description.trim()||null,visibility}).select().single();if(error)throw error;setGroups(g=>[data,...g]);setName('');setDescription('');setVisibility('public');onNotice?.('Your group was created and saved.');}catch(e){setError(e.message);}finally{setCreating(false);}}
 async function join(g){setBusy(g.id);setError('');try{const status=g.visibility==='public'?'active':'pending';const {error}=await supabase.from('group_members').insert({group_id:g.id,user_id:user.id,role:'member',status});if(error)throw error;setJoined(m=>[...m,{group_id:g.id,status}]);onNotice?.(status==='active'?'You joined the group.':'Your join request was sent.');}catch(e){setError(e.message);}finally{setBusy('');}}
 async function reviewRequest(r,approve){
  setBusy(r.user_id);setError('');
  try{
    if(approve){
      const {error}=await supabase.from('group_members').update({status:'active'}).eq('group_id',r.group_id).eq('user_id',r.user_id);
      if(error)throw error;
    }else{
      const {error}=await supabase.from('group_members').delete().eq('group_id',r.group_id).eq('user_id',r.user_id);
      if(error)throw error;
    }
    setRequests(prev=>prev.filter(x=>x.user_id!==r.user_id||x.group_id!==r.group_id));
    onNotice?.(approve?'Member request approved.':'Member request declined.');
  }catch(e){setError(e.message);}finally{setBusy('');}
 }
 return <><div className="view-heading"><div><div className="eyebrow">COMMUNITY, BUILT TOGETHER</div><h1>Groups</h1><p>Discover real communities, join discussions and create your own circle.</p></div></div><form className="live-feature-form panel" onSubmit={create}><h2>Create a group</h2><label>Group name<input value={name} onChange={e=>setName(e.target.value)} maxLength={80} required placeholder="e.g. Aba Creators Network"/></label><label>Description<textarea value={description} onChange={e=>setDescription(e.target.value)} maxLength={500} placeholder="What is this group about?"/></label><label>Membership<select value={visibility} onChange={e=>setVisibility(e.target.value)}><option value="public">Public — anyone can join</option></select></label><button className="button primary" disabled={creating||!name.trim()}>{creating?'Creating…':'Create group'}</button><p className="live-feature-note">Public groups are enabled. Private group invitations and request-to-join flows will be enabled after the invite and moderation workflow is complete.</p></form><Notice>{error}</Notice>{requests.length>0&&<section className="panel live-feature-form"><h2>Group join requests ({requests.length})</h2>{requests.map(r=><div className="live-feature-result" key={`${r.group_id}-${r.user_id}`}><strong>Member request</strong><span>{r.user_id.slice(0,8)}…</span><button className="button outline" disabled={busy===r.user_id} onClick={()=>reviewRequest(r,false)}>Decline</button><button className="button primary" disabled={busy===r.user_id} onClick={()=>reviewRequest(r,true)}>Approve</button></div>)}</section>}<div className="live-feature-toolbar"><h2>Discover groups</h2><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search groups by name or topic"/></div><div className="live-feature-grid">{filtered.map(g=>{const membership=joined.find(m=>m.group_id===g.id);const isOwner=g.owner_id===user.id;return <article className="live-feature-card panel" key={g.id}><span className="live-feature-kicker">{g.visibility==='public'?'PUBLIC GROUP':'PRIVATE GROUP'}</span><h3>{g.name}</h3><p>{g.description||'A community for people with shared interests.'}</p><button className="button outline" disabled={isOwner||!!membership||busy===g.id} onClick={()=>join(g)}>{isOwner?'You own this group':membership?membership.status==='pending'?'Request pending':'Joined':busy===g.id?'Joining…':g.visibility==='private'?'Request to join':'Join group'}</button></article>;})}{!filtered.length&&<Empty title="No groups found" body="Try another search, or create the first group for this topic."/>}</div></>;
}

export function LiveBusinessView({supabase,user,onNotice}) {
 const [items,setItems]=useState([]),[name,setName]=useState(''),[description,setDescription]=useState(''),[website,setWebsite]=useState(''),[country,setCountry]=useState('NG'),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const load=async()=>{const {data,error}=await supabase.from('businesses').select('id,owner_id,name,description,website_url,country_code,created_at').order('created_at',{ascending:false}).limit(100);if(error)throw error;setItems(data||[]);};
 useEffect(()=>{load().catch(e=>setError(e.message));},[supabase,user?.id]);
 async function create(e){e.preventDefault();setBusy(true);setError('');try{if(website&&!/^https?:\/\/.+/i.test(website))throw new Error('Website must start with https:// or http://');const {data,error}=await supabase.from('businesses').insert({owner_id:user.id,name:name.trim(),description:description.trim()||null,website_url:website.trim()||null,country_code:country}).select().single();if(error)throw error;setItems(prev=>[data,...prev]);setName('');setDescription('');setWebsite('');onNotice?.('Your business page was created and saved.');}catch(e){setError(e.message);}finally{setBusy(false);}}
 return <><div className="view-heading"><div><div className="eyebrow">BUSINESS, MADE DISCOVERABLE</div><h1>Business</h1><p>Create a real business presence and discover independent brands.</p></div></div><form className="live-feature-form panel" onSubmit={create}><h2>Create your business page</h2><label>Business name<input value={name} onChange={e=>setName(e.target.value)} required maxLength={120} placeholder="Your business or organisation"/></label><label>About your business<textarea value={description} onChange={e=>setDescription(e.target.value)} maxLength={1000} placeholder="Describe your products, services or mission"/></label><label>Website or business link<input type="url" value={website} onChange={e=>setWebsite(e.target.value)} placeholder="https://example.com"/></label><label>Country code<input value={country} onChange={e=>setCountry(e.target.value.toUpperCase())} maxLength={2} required placeholder="NG"/></label><button className="button primary" disabled={busy||!name.trim()}>{busy?'Creating…':'Create business page'}</button></form><Notice>{error}</Notice><div className="live-feature-toolbar"><h2>Businesses on Ofsocio</h2><span>{items.length} pages</span></div><div className="live-feature-grid">{items.map(b=><article className="live-feature-card panel" key={b.id}><span className="live-feature-kicker">{b.owner_id===user.id?'YOUR BUSINESS':'BUSINESS PAGE'} · {b.country_code||'GLOBAL'}</span><h3>{b.name}</h3><p>{b.description||'Business profile on Ofsocio.'}</p>{b.website_url&&<a href={b.website_url} target="_blank" rel="noreferrer">{b.website_url}</a>}</article>)}{!items.length&&<Empty title="No business pages yet" body="Create your business page above. It will appear here once saved."/>}</div></>;
}
