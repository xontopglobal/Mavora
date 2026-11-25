import React, { useEffect, useState } from 'react';

export default function LiveCirclesView({ supabase, user, onNotice }) {
  const [tab, setTab] = useState('Following');
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState('');
  async function load() {
    if (!supabase || !user?.id) return;
    if (tab === 'Requests') {
      const { data, error } = await supabase.rpc('get_my_follow_requests');
      if (error) throw error;
      const ids=[...new Set((data||[]).map(row=>row.profile_id))];
      const {data:profiles,error:profileError}=ids.length?await supabase.from('profiles').select('id,username,display_name,bio,avatar_url').in('id',ids):{data:[],error:null};
      if(profileError)throw profileError;
      const map=new Map((profiles||[]).map(profile=>[profile.id,profile]));
      setRows((data||[]).map(row=>({...row,profile:map.get(row.profile_id)||{}}))); return;
    }
    const column = tab === 'Followers' ? 'followed_id' : 'follower_id';
    const target = tab === 'Followers' ? 'follower_id' : 'followed_id';
    const { data, error } = await supabase.from('follows').select('follower_id,followed_id,created_at').eq(column, user.id).order('created_at',{ascending:false}).limit(200);
    if (error) throw error;
    const ids = (data || []).map(row => row[target]);
    if (!ids.length) { setRows([]); return; }
    const { data: profiles, error: profileError } = await supabase.from('profiles').select('id,username,display_name,bio,avatar_url,is_private').in('id',ids);
    if (profileError) throw profileError;
    const map = new Map((profiles||[]).map(profile=>[profile.id,profile]));
    setRows((data||[]).map(row=>({...row,profile:map.get(row[target])||{}})));
  }
  useEffect(()=>{load().catch(error=>onNotice?.(error.message));},[tab,supabase,user?.id]);
  async function respond(request, decision) {
    setBusy(request.request_id);
    try {
      const { error } = await supabase.rpc('respond_to_ofsocio_follow_request',{p_request_id:request.request_id,p_decision:decision});
      if (error) throw error; await load(); onNotice?.(decision==='accept'?'Follow request accepted.':'Follow request updated.');
    } catch(error){onNotice?.(error.message);} finally{setBusy('');}
  }
  async function cancel(request) {
    setBusy(request.request_id);
    try { const { error }=await supabase.rpc('cancel_ofsocio_follow_request',{p_request_id:request.request_id}); if(error)throw error; await load(); }
    catch(error){onNotice?.(error.message);}finally{setBusy('');}
  }
  return <><div className="view-heading"><div><div className="eyebrow">YOUR PEOPLE, YOUR PACE</div><h1>Circles</h1><p>Manage following, followers, and private-account requests.</p></div></div><div className="live-profile-tabs">{['Following','Followers','Requests'].map(name=><button key={name} className={tab===name?'active':''} onClick={()=>setTab(name)}>{name}</button>)}</div><section className="panel admin-report-panel">{rows.length?rows.map(row=>{const profile=row.profile||row; const id=row.followed_id||row.follower_id||row.profile_id; return <article className="admin-report-row circle-row" key={id||row.request_id}><div><strong>{profile.display_name||profile.username||'Ofsocio member'}</strong><p>{profile.username?`@${profile.username}`:''}{profile.bio?` · ${profile.bio}`:''}</p></div>{tab==='Requests'&&row.direction==='incoming'?<div className="admin-report-actions"><button className="button outline small-button" disabled={busy===row.request_id} onClick={()=>respond(row,'reject')}>Decline</button><button className="button primary small-button" disabled={busy===row.request_id} onClick={()=>respond(row,'accept')}>Accept</button></div>:tab==='Requests'&&row.direction==='outgoing'?<button className="button outline small-button" disabled={busy===row.request_id} onClick={()=>cancel(row)}>Cancel request</button>:null}</article>}) : <div className="empty-state">{tab==='Requests'?'No pending follow requests.':`No ${tab.toLowerCase()} yet.`}</div>}</section></>;
}
