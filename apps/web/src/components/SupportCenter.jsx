import React, { useEffect, useState } from "react";
import {
  createSupportTicket,
  listSupportTicketMessages,
  listSupportTickets,
  replyToSupportTicket,
  sendSupportMessage,
  setSupportTicketStatus
} from "../lib/supportService.js";

const faqItems = [
  { topic: "Account", question: "How do I update my profile?", answer: "Open Your profile and edit the details available there. Use the sign-in screen’s password recovery option if you cannot access your account." },
  { topic: "Privacy", question: "Who can see my Circles activity?", answer: "Follow requests and follow relationships are protected by your account’s privacy rules. The privacy controls page is still being connected, so contact support if you need help with a specific privacy issue." },
  { topic: "Business", question: "Why is my business listing not visible?", answer: "New business profiles and catalog items start as drafts. Publish the listing from Business after saving it. Discovery only shows published records." },
  { topic: "Catalog", question: "How do I add a product or service?", answer: "Create a business profile first, then use the Product or Service controls in your account catalog. Listings are tied to your account owner in the current schema." },
  { topic: "Messaging", question: "Why can’t I start a conversation?", answer: "Messaging requires the secure direct-messaging migration to be enabled in the connected Supabase project. If the inbox reports that it is unavailable, contact support with the project reference shown by your deployment administrator." },
  { topic: "Circles", question: "Why can’t I load follow requests?", answer: "Confirm the deployed frontend uses the intended Supabase project. If the project contains the Circles migration but reports a schema-cache error, an administrator can refresh the PostgREST schema cache and reload the app." },
  { topic: "Stories & Reels", question: "What media can I upload?", answer: "Stories accept JPEG, PNG, WebP, MP4, or WebM within the on-screen size limits. Reels accept MP4 or WebM up to 100 MB. Uploads require the private social-media bucket and matching database migration to be enabled." },
  { topic: "Payments", question: "What should I include in a payment support request?", answer: "Include the plan name, approximate date, and provider transaction reference. Never include your password, full card number, CVV, or one-time verification code." },
  { topic: "Safety", question: "How do I report a post?", answer: "Open the post menu and choose Report post. The report is sent to the moderation queue. If you need to report another issue, choose Safety in the support request form." }
];

function statusLabel(status) {
  return (status || "open").replaceAll("_", " ");
}

export default function SupportCenter({ userId, faqOnly = false, staff = false, canReply = false }) {
  const [tickets, setTickets] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [ticketForm, setTicketForm] = useState({ subject: "", category: "technical", description: "" });
  const [reply, setReply] = useState("");
  const [search, setSearch] = useState("");
  const [contactOpen, setContactOpen] = useState(false);
  const selected = tickets.find((ticket) => ticket.id === selectedId);
  const visibleFaqs = faqItems.filter((item) => `${item.topic} ${item.question} ${item.answer}`.toLowerCase().includes(search.trim().toLowerCase()));

  async function refreshTickets(preferredId = "") {
    setLoading(true);
    setError("");
    try {
      const rows = await listSupportTickets(userId);
      setTickets(rows);
      const next = preferredId || (rows.some((ticket) => ticket.id === selectedId) ? selectedId : rows[0]?.id || "");
      setSelectedId(next);
      return rows;
    } catch (loadError) {
      setError(loadError.message || "Support requests could not be loaded.");
      return [];
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (faqOnly && !contactOpen) return undefined;
    let active = true;
    setLoading(true);
    listSupportTickets(userId)
      .then((rows) => {
        if (!active) return;
        setTickets(rows);
        setSelectedId((current) => rows.some((ticket) => ticket.id === current) ? current : rows[0]?.id || "");
      })
      .catch((loadError) => { if (active) setError(loadError.message || "Support requests could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId, faqOnly, contactOpen]);

  useEffect(() => {
    if (!selectedId || (faqOnly && !contactOpen)) {
      setMessages([]);
      return undefined;
    }
    let active = true;
    setMessagesLoading(true);
    listSupportTicketMessages(userId, selectedId)
      .then((rows) => { if (active) setMessages(rows); })
      .catch((loadError) => { if (active) setError(loadError.message || "Ticket messages could not be loaded."); })
      .finally(() => { if (active) setMessagesLoading(false); });
    return () => { active = false; };
  }, [userId, selectedId, faqOnly, contactOpen]);

  async function submitTicket(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const ticket = await createSupportTicket(userId, ticketForm);
      setTicketForm({ subject: "", category: "technical", description: "" });
      setContactOpen(true);
      setNotice(`Support request received. Reference: ${ticket.id}`);
      await refreshTickets(ticket.id);
    } catch (submitError) {
      setError(submitError.message || "Your support request could not be submitted.");
    } finally {
      setSaving(false);
    }
  }

  async function submitReply(event) {
    event.preventDefault();
    if (!selected || !reply.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      if (staff) await replyToSupportTicket(userId, selected.id, reply);
      else await sendSupportMessage(userId, selected.id, reply);
      setReply("");
      setMessages(await listSupportTicketMessages(userId, selected.id));
      await refreshTickets(selected.id);
      setNotice(staff ? "Your reply was recorded in the audit log." : "Your reply was sent.");
    } catch (replyError) {
      setError(replyError.message || "Your reply could not be sent.");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(status) {
    if (!selected || saving) return;
    setSaving(true);
    setError("");
    try {
      await setSupportTicketStatus(userId, selected.id, status);
      await refreshTickets(selected.id);
      setNotice(`Request marked ${statusLabel(status)}. The change was audit logged.`);
    } catch (statusError) {
      setError(statusError.message || "The request status could not be changed.");
    } finally {
      setSaving(false);
    }
  }

  return <>
    {!staff && <div className="view-heading"><div><div className="eyebrow">{faqOnly ? "ANSWERS, WITHOUT THE RUNAROUND" : "HERE WHEN YOU NEED A HAND"}</div><h1>{faqOnly ? "Help & FAQ" : "AI Support"}</h1><p>{faqOnly ? "Search practical help topics or send a support request." : "AI responses are unavailable in this deployment. A human support request is available below."}</p></div></div>}
    {!staff && <section className="faq-section panel"><div className="faq-heading"><div><span className="eyebrow">HELP CENTRE</span><h2>Frequently asked questions</h2></div><label className="faq-search"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search help topics" aria-label="Search FAQ"/></label></div>{visibleFaqs.length ? <div className="faq-list">{visibleFaqs.map((item) => <details key={item.topic}><summary><span>{item.topic}</span>{item.question}</summary><p>{item.answer}</p></details>)}</div> : <p className="business-state">No help topics matched that search.</p>}</section>}
    {!staff && <section className="support-contact panel"><div><span className="eyebrow">HUMAN SUPPORT</span><h2>Contact the support team</h2><p>Describe the issue and we’ll create a private support request tied to your account.</p></div><button className="button primary" type="button" onClick={() => setContactOpen((open) => !open)} aria-expanded={contactOpen}>{contactOpen ? "Hide requests" : "Contact support"}</button></section>}
    {!staff && contactOpen && <section className="support-ticket-create panel"><form onSubmit={submitTicket}><h2>New support request</h2><label>Subject<input value={ticketForm.subject} onChange={(event) => setTicketForm((current) => ({ ...current, subject: event.target.value }))} maxLength={120} minLength={3} required/></label><label>Category<select value={ticketForm.category} onChange={(event) => setTicketForm((current) => ({ ...current, category: event.target.value }))}><option value="account">Account</option><option value="privacy">Privacy</option><option value="business">Business</option><option value="payments">Payments</option><option value="safety">Safety</option><option value="technical">Technical issue</option><option value="other">Other</option></select></label><label>What happened?<textarea value={ticketForm.description} onChange={(event) => setTicketForm((current) => ({ ...current, description: event.target.value }))} minLength={10} maxLength={5000} rows={5} required/></label><button className="button primary" type="submit" disabled={saving}>{saving ? "Submitting…" : "Submit request"}</button></form></section>}
    {(staff || contactOpen) && <section className="support-ticket-workspace panel" aria-label={staff ? "Customer support queue" : "Your support requests"}>
      <aside className="support-ticket-list"><div className="support-ticket-list-heading"><h2>{staff ? "Support queue" : "Your requests"}</h2><button className="quiet-button" type="button" onClick={() => void refreshTickets()} disabled={loading}>Refresh</button></div>{loading ? <p role="status">Loading support requests…</p> : tickets.length ? tickets.map((ticket) => <button type="button" key={ticket.id} className={`support-ticket-item ${selectedId === ticket.id ? "active" : ""}`} onClick={() => setSelectedId(ticket.id)}><strong>{ticket.subject}</strong><span>{ticket.category} · {statusLabel(ticket.status)}</span><small>{new Date(ticket.updated_at).toLocaleString()}</small></button>) : <p className="business-state">{staff ? "There are no support requests in the queue." : "You have not submitted a support request yet."}</p>}</aside>
      <div className="support-ticket-detail">{selected ? <><header><div><span className="eyebrow">{selected.category.toUpperCase()}</span><h2>{selected.subject}</h2><p>Reference {selected.id} · {statusLabel(selected.status)}</p></div>{staff && canReply && <label className="support-status-field">Status<select value={selected.status} onChange={(event) => void updateStatus(event.target.value)} disabled={saving}><option value="open">Open</option><option value="in_progress">In progress</option><option value="escalated">Escalated</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select></label>}</header><div className="support-ticket-messages" aria-live="polite">{messagesLoading ? <p role="status">Loading replies…</p> : messages.length ? messages.map((message) => <article className={`support-message ${message.sender_kind}`} key={message.id}><span>{message.sender_kind === "staff" ? "Ofsocio Support" : message.sender_id === userId ? "You" : "Customer"}</span><p>{message.body}</p><time dateTime={message.created_at}>{new Date(message.created_at).toLocaleString()}</time></article>) : <p className="business-state">The request description is above. Replies will appear here.</p>}</div><div className="support-ticket-description"><strong>Original request</strong><p>{selected.description || "The request description is available to authorized support staff."}</p></div>{(staff ? canReply : ["open","in_progress","escalated"].includes(selected.status)) && <form className="support-reply-form" onSubmit={submitReply}><label className="visually-hidden" htmlFor="support-reply">{staff ? "Reply to customer" : "Add information"}</label><textarea id="support-reply" value={reply} onChange={(event) => setReply(event.target.value)} maxLength={5000} rows={3} placeholder={staff ? "Write a support reply…" : "Add information to your request…"} required/><button className="button primary" type="submit" disabled={saving || !reply.trim()}>{saving ? "Sending…" : staff ? "Send audited reply" : "Send reply"}</button></form>}{staff && !canReply && <p className="business-state">Your staff role is read-only for support tickets.</p>}</> : <div className="support-ticket-placeholder"><h2>{staff ? "Choose a support request" : "No request selected"}</h2><p>{staff ? "Authorized support requests appear here." : "Submit a request to keep its replies and status in one place."}</p></div>}</div>
    </section>}
    {error && <div className="business-feedback error" role="alert">{error}</div>}
    {notice && <div className="business-feedback success" role="status">{notice}</div>}
    {!staff && <div className="support-ai-note panel" role="status"><strong>AI support unavailable</strong><p>No AI provider is configured in this deployment. Ofsocio will not show automated replies unless a provider is connected.</p></div>}
  </>;
}
