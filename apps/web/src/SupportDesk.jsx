import React, { useEffect, useState } from 'react';

const statusOptions = ['open','in_progress','waiting_customer','escalated','resolved','closed'];
const pretty = value => String(value || '').replaceAll('_',' ');

export default function SupportDesk({ supabase, user, staff = false, canReviewReports = false, onNotice }) {
  const [tickets, setTickets] = useState([]);
  const [ticketFilter, setTicketFilter] = useState('active');
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('account');
  const [description, setDescription] = useState('');
  const [reply, setReply] = useState('');
  const [status, setStatus] = useState('open');
  const [busy, setBusy] = useState(false);
  const [reports, setReports] = useState([]);
  const [mode, setMode] = useState(staff ? 'tickets' : 'my-tickets');
  const [aiMessages, setAiMessages] = useState([{ role: 'assistant', content: 'Hi! I’m Ofsocio AI Support. I can help with account setup, profiles, posts, privacy, troubleshooting and how to contact our support team. I cannot access private account records or make account/payment changes.' }]);
  const [aiDraft, setAiDraft] = useState('');
  const [aiBusy, setAiBusy] = useState(false);


  async function loadTickets() {
    if (!supabase || !user?.id) return;
    let query = supabase.from('support_tickets').select('id,requester_id,subject,category,description,status,assigned_to,created_at,updated_at').order('updated_at', { ascending: false }).limit(100);
    if (!staff) query = query.eq('requester_id', user.id);
    const { data, error } = await query;
    if (error) throw error;
    console.debug('[SupportDesk] Loaded tickets for user', user.id, { count: (data || []).length, staff });
    const requesterIds = [...new Set((data || []).map(ticket => ticket.requester_id).filter(Boolean))];
    let requesterProfiles = [];
    if (requesterIds.length) {
      const profileResult = await supabase.from('profiles').select('id,username,display_name').in('id', requesterIds);
      if (profileResult.error) throw profileResult.error;
      requesterProfiles = profileResult.data || [];
    }
    const requesterMap = new Map(requesterProfiles.map(profile => [profile.id, profile]));
    setTickets((data || []).map(ticket => ({ ...ticket, requester: requesterMap.get(ticket.requester_id) || null })));
    if (selected) {
      const current = (data || []).find(t => t.id === selected.id);
      if (current) setSelected(current);
    }
  }

  async function loadReports() {
    if (!staff || !canReviewReports || !supabase) return;
    const { data, error } = await supabase.from('content_reports').select('id,reporter_id,target_type,target_id,reason,description,status,created_at').order('created_at', { ascending: false }).limit(100);
    if (error) throw error;
    setReports(data || []);
  }

  async function loadMessages(ticket) {
    setSelected(ticket); setStatus(ticket.status);
    const { data, error } = await supabase.from('support_ticket_messages').select('id,ticket_id,sender_id,sender_kind,body,created_at').eq('ticket_id', ticket.id).order('created_at', { ascending: true });
    if (error) throw error;
    setMessages(data || []);
  }

  useEffect(() => { Promise.all([loadTickets(), canReviewReports ? loadReports() : Promise.resolve()]).catch(error => onNotice?.(error.message)); }, [supabase, user?.id, staff, canReviewReports]);

  async function createTicket(event) {
    event.preventDefault();
    const normalizedSubject = subject.trim();
    const normalizedDescription = description.trim();
    console.debug('[SupportDesk] Ticket form submitted', { subject: normalizedSubject, category, descriptionLength: normalizedDescription.length, userId: user?.id });
    if (busy) return;
    if (!supabase) { onNotice?.('Support is unavailable because the server connection is not configured.'); return; }
    if (!user?.id) { onNotice?.('Sign in to submit a support ticket.'); return; }
    if (normalizedSubject.length < 3 || normalizedDescription.length < 10) { onNotice?.('Subject must be at least 3 characters and the description at least 10 characters.'); return; }
    setBusy(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const authenticatedUser = sessionData?.session?.user;
      console.debug('[SupportDesk] Authenticated user for ticket submission', { id: authenticatedUser?.id, matchesCurrentUser: authenticatedUser?.id === user.id });
      if (!authenticatedUser?.id || authenticatedUser.id !== user.id) throw new Error('Your session is missing or no longer matches your signed-in account. Please sign in again.');
      const rpcArgs = { p_subject: normalizedSubject, p_category: category, p_description: normalizedDescription };
      console.debug('[SupportDesk] Calling support_create_ticket_with_message', rpcArgs);
      const { data, error } = await supabase.rpc('support_create_ticket_with_message', rpcArgs);
      console.debug('[SupportDesk] Ticket RPC response', { data, error });
      if (error) throw error;
      const createdTicket = Array.isArray(data) ? data[0] : data;
      if (!createdTicket?.id) throw new Error('The ticket request completed but did not return a ticket. Please reload your tickets before retrying.');
      setSubject(''); setDescription('');
      await loadTickets();
      await loadMessages(createdTicket);
      onNotice?.('Support ticket created.');
    } catch (error) {
      console.error('[SupportDesk] Ticket submission failed', error);
      const detail = [error?.message, error?.details, error?.hint, error?.code && `Code: ${error.code}`].filter(Boolean).join(' — ');
      onNotice?.(`Could not submit support ticket: ${detail || 'Unknown Supabase error'}`);
    }
    finally { setBusy(false); }
  }

  async function sendReply(event) {
    event.preventDefault();
    if (!selected || !reply.trim()) return;
    setBusy(true);
    try {
      const { error } = await supabase.from('support_ticket_messages').insert({ ticket_id: selected.id, sender_id: user.id, sender_kind: staff ? 'staff' : 'customer', body: reply.trim() });
      if (error) throw error;
      setReply('');
      await loadMessages(selected); await loadTickets(); onNotice?.('Reply sent.');
    } catch (error) { onNotice?.(error.message); }
    finally { setBusy(false); }
  }

  async function updateTicket() {
    if (!selected || !staff) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('ofsocio_staff_update_support_ticket', { p_ticket_id: selected.id, p_status: status, p_assigned_to: selected.assigned_to || user.id });
      if (error) throw error;
      setSelected(data); await loadTickets(); onNotice?.('Ticket status updated and logged.');
    } catch (error) { onNotice?.(error.message); }
    finally { setBusy(false); }
  }

  async function assignTicketToMe() {
    if (!selected || !staff || !user?.id) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('ofsocio_staff_update_support_ticket', { p_ticket_id: selected.id, p_status: status, p_assigned_to: user.id });
      if (error) throw error;
      setSelected(data); await loadTickets(); onNotice?.('Ticket assigned to you and recorded.');
    } catch (error) { onNotice?.(error.message); }
    finally { setBusy(false); }
  }

  async function askAiSupport(event) {
    event.preventDefault();
    const question = aiDraft.trim();
    if (!question || aiBusy) return;
    if (question.length > 1200) { onNotice?.('Please keep your question under 1,200 characters.'); return; }
    if (!supabase || !user?.id) { onNotice?.('Sign in to use Ofsocio AI Support.'); return; }
    const next = [...aiMessages, { role: 'user', content: question }];
    setAiMessages(next);
    setAiDraft('');
    setAiBusy(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Your session expired. Please sign in again.');
      const apiBase = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');
      if (!apiBase) throw new Error('AI Support API is not configured. Set VITE_API_URL to your deployed Render API.');
      const response = await fetch(`${apiBase}/api/ai/support`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: next.filter(item => item.role === 'user').slice(-6) })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `AI Support request failed (${response.status}).`);
      setAiMessages(current => [...current, { role: 'assistant', content: result.reply || 'I could not prepare a response. Please contact customer service.' }]);
    } catch (error) {
      setAiMessages(current => [...current, { role: 'assistant', content: `I couldn't reach AI Support: ${error.message}. You can still open a customer service ticket below.` }]);
    } finally { setAiBusy(false); }
  }

  const visibleTickets = staff ? tickets.filter(ticket => ticketFilter === 'all' || (ticketFilter === 'active' ? ['open','in_progress','waiting_customer','escalated'].includes(ticket.status) : ticket.status === ticketFilter)) : tickets;

  return <section className="support-desk">
    <div className="view-heading"><div><div className="eyebrow">{staff ? 'STAFF OPERATIONS' : 'PERSONAL SUPPORT'}</div><h1>{staff ? 'Admin & Customer Service' : 'Customer Service'}</h1><p>{staff ? 'Manage member support and review reported content with permission checks.' : 'Create a support request and continue the conversation here.'}</p></div></div>
    <section className="ofsocio-ai-support panel" aria-label="Ofsocio AI support">
      <div className="ofsocio-ai-heading"><div><span className="eyebrow">AI ASSISTANT</span><h2>Ask Ofsocio AI Support</h2><p>Quick guidance for common questions. For private account issues, open a support ticket.</p></div><span className="ai-support-badge">AI · Beta</span></div>
      <div className="ofsocio-ai-transcript" aria-live="polite">
        {aiMessages.slice(-8).map((item,index)=><article className={`ofsocio-ai-message ${item.role}`} key={`${index}-${item.role}`}><strong>{item.role==='assistant'?'Ofsocio AI':'You'}</strong><p>{item.content}</p></article>)}
        {aiBusy&&<div className="ofsocio-ai-message assistant"><strong>Ofsocio AI</strong><p>Thinking…</p></div>}
      </div>
      <form className="ofsocio-ai-form" onSubmit={askAiSupport}><textarea value={aiDraft} onChange={event=>setAiDraft(event.target.value)} placeholder="Ask about using Ofsocio…" rows={2} maxLength={1200} disabled={aiBusy}/><button className="button primary" disabled={aiBusy||!aiDraft.trim()}>{aiBusy?'Sending…':'Ask AI'}</button></form>
      <small className="support-note">AI answers may be imperfect. Do not share passwords, verification codes, payment details or sensitive personal information.</small>
    </section>
    {staff && <div className="live-profile-tabs"><button className={mode==='tickets'?'active':''} onClick={()=>setMode('tickets')}>Support queue ({tickets.length})</button>{canReviewReports&&<button className={mode==='reports'?'active':''} onClick={()=>setMode('reports')}>Content reports ({reports.length})</button>}</div>}
    {(!staff || mode==='tickets') && <div className="support-desk-layout">
      {!staff && <form className="live-profile-edit panel" onSubmit={createTicket}><h2>Open a support ticket</h2><label>Subject<input value={subject} onChange={e=>setSubject(e.target.value)} maxLength={120} required/></label><label>Category<select value={category} onChange={e=>setCategory(e.target.value)}><option value="account">Account</option><option value="technical">Technical issue</option><option value="payments">Membership / payments</option><option value="safety">Safety / report</option><option value="other">Other</option></select></label><label>Describe the issue<textarea value={description} onChange={e=>setDescription(e.target.value)} rows={5} maxLength={5000} required/></label><button type="submit" className="button primary" onClick={() => console.debug('[SupportDesk] Submit ticket button clicked', { busy, userId: user?.id })} disabled={busy}>{busy?'Submitting…':'Submit ticket'}</button></form>}
      <section className="support-ticket-list panel"><div className="support-queue-head"><h2>{staff?'Customer service queue':'Your tickets'}</h2>{staff && <label className="support-queue-filter">Filter<select value={ticketFilter} onChange={event=>setTicketFilter(event.target.value)}><option value="active">Active queue</option><option value="open">Open</option><option value="in_progress">In progress</option><option value="waiting_customer">Waiting for member</option><option value="escalated">Escalated</option><option value="resolved">Resolved</option><option value="closed">Closed</option><option value="all">All statuses</option></select></label>}</div>{visibleTickets.length ? visibleTickets.map(ticket=><button className={`support-ticket-row ${selected?.id===ticket.id?'selected':''}`} key={ticket.id} onClick={()=>loadMessages(ticket)}><strong>{ticket.subject}</strong><span>{ticket.category} · {pretty(ticket.status)}</span>{staff && <small>Member: {ticket.requester?.display_name || ticket.requester?.username || ticket.requester_id || 'Member'}{ticket.requester?.username ? ` · @${ticket.requester.username}` : ''}</small>}<small>Updated {new Date(ticket.updated_at).toLocaleString()}</small></button>) : <div className="empty-state">No tickets in this queue.</div>}</section>
      <section className="support-thread panel"><h2>{selected?.subject || 'Ticket conversation'}</h2>{selected ? <><div className="support-thread-messages">{messages.map(message=><article className={`support-thread-message ${message.sender_kind}`} key={message.id}><strong>{message.sender_kind==='staff'?'Ofsocio Support':'Member'}</strong><p>{message.body}</p><time>{new Date(message.created_at).toLocaleString()}</time></article>)}</div>{staff && <div className="support-status-control"><label>Status<select value={status} onChange={e=>setStatus(e.target.value)}>{statusOptions.map(option=><option value={option} key={option}>{pretty(option)}</option>)}</select></label><button type="button" className="button outline small-button" onClick={assignTicketToMe} disabled={busy}>Assign to me</button><button type="button" className="button outline small-button" onClick={updateTicket} disabled={busy}>Save status</button></div>}<form className="support-reply-form" onSubmit={sendReply}><textarea value={reply} onChange={e=>setReply(e.target.value)} placeholder="Write a reply…" rows={3} maxLength={5000} required/><button className="button primary" disabled={busy}>{busy?'Sending…':'Send reply'}</button></form></> : <div className="empty-state">Select a ticket to view its messages.</div>}</section>
    </div>}
    {staff && canReviewReports && mode==='reports' && <section className="support-ticket-list panel"><h2>Reported content</h2>{reports.length ? reports.map(report=><article className="live-activity-card" key={report.id}><strong>{pretty(report.target_type)} · {pretty(report.status)}</strong><p>{report.reason}</p>{report.description && <p>{report.description}</p>}<small>Reported {new Date(report.created_at).toLocaleString()} · Target ID: {report.target_id}</small><p className="support-note">Report is visible to authorized staff. Resolution actions require the secured moderation workflow.</p></article>) : <div className="empty-state">No reports available or your role does not have report-review permission.</div>}</section>}
  </section>;
}
