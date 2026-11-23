import React, { useEffect, useMemo, useRef, useState } from "react";
import { listMessages, listConversations, sendMessage, startOrOpenConversation } from "../lib/messageService.js";
import { searchPeople } from "../lib/circleService.js";
import { supabase } from "../lib/supabase.js";

function personName(person) {
  return person?.display_name?.trim() || (person?.username ? `@${person.username}` : "Ofsocio member");
}

function messageError(error) {
  if (error?.code === "PGRST202" && /get_my_conversations|create_or_get_conversation/i.test(`${error.message || ""} ${error.details || ""}`)) {
    return "Messaging is not enabled in this deployment yet. Apply the secure_direct_messaging migration, then refresh the page.";
  }
  return error?.message || "Messages could not be loaded.";
}

export default function MessagesView({ userId }) {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [newMessageOpen, setNewMessageOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [realtimeStatus, setRealtimeStatus] = useState("connecting");
  const listRef = useRef(null);
  const sequence = useRef(0);
  const activeConversation = useMemo(() => conversations.find((item) => item.conversation_id === activeId), [conversations, activeId]);

  async function refreshConversations(preferredId = "") {
    setError("");
    try {
      const rows = await listConversations(userId);
      setConversations(rows);
      const nextId = preferredId || (rows.some((row) => row.conversation_id === activeId) ? activeId : rows[0]?.conversation_id || "");
      setActiveId(nextId);
      return rows;
    } catch (loadError) {
      setError(messageError(loadError));
      return [];
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    listConversations(userId)
      .then((rows) => {
        if (!active) return;
        setConversations(rows);
        setActiveId((current) => rows.some((row) => row.conversation_id === current) ? current : rows[0]?.conversation_id || "");
        setError("");
      })
      .catch((loadError) => { if (active) setError(messageError(loadError)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId]);

  useEffect(() => {
    const requestId = ++sequence.current;
    let active = true;
    if (!activeId) {
      setMessages([]);
      setMessagesLoading(false);
      return () => { active = false; };
    }
    setMessagesLoading(true);
    listMessages(userId, activeId)
      .then((rows) => { if (active && requestId === sequence.current) setMessages(rows); })
      .catch((loadError) => { if (active && requestId === sequence.current) setError(messageError(loadError)); })
      .finally(() => { if (active && requestId === sequence.current) setMessagesLoading(false); });
    return () => { active = false; };
  }, [userId, activeId]);

  useEffect(() => {
    if (!activeId || !supabase) return undefined;
    let active = true;
    const channel = supabase.channel(`ofsocio-messages-${activeId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${activeId}`
      }, async () => {
        try {
          const rows = await listMessages(userId, activeId);
          if (active) setMessages(rows);
          if (active) await refreshConversations(activeId);
        } catch (loadError) {
          if (active) setError(messageError(loadError));
        }
      })
      .subscribe((status) => { if (active) setRealtimeStatus(status.toLowerCase()); });
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [userId, activeId]);

  useEffect(() => {
    const query = search.trim();
    let active = true;
    if (!newMessageOpen || query.length < 2) {
      setSearchResults([]);
      setSearchError("");
      setSearching(false);
      return () => { active = false; };
    }
    setSearching(true);
    setSearchError("");
    const timer = window.setTimeout(async () => {
      try {
        const rows = await searchPeople(userId, query);
        if (active) setSearchResults(rows);
      } catch (searchLoadError) {
        if (active) setSearchError(searchLoadError.message || "Member search failed.");
      } finally {
        if (active) setSearching(false);
      }
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [newMessageOpen, search, userId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, activeId]);

  async function openConversation(person) {
    setError("");
    try {
      const conversationId = await startOrOpenConversation(userId, person.id);
      await refreshConversations(conversationId);
      setNewMessageOpen(false);
      setSearch("");
      setSearchResults([]);
      setActiveId(conversationId);
    } catch (openError) {
      setError(messageError(openError));
    }
  }

  async function submitMessage(event) {
    event.preventDefault();
    if (!draft.trim() || sending || !activeId) return;
    setSending(true);
    setError("");
    try {
      const saved = await sendMessage(userId, activeId, draft);
      setMessages((current) => [...current, saved]);
      setDraft("");
      await refreshConversations(activeId);
    } catch (sendError) {
      setError(messageError(sendError));
    } finally {
      setSending(false);
    }
  }

  return <>
    <div className="view-heading"><div><div className="eyebrow">PRIVATE BY DESIGN</div><h1>Messages</h1><p>Only conversation participants can read or send messages.</p></div><button className="button primary" type="button" onClick={() => setNewMessageOpen((open) => !open)} aria-expanded={newMessageOpen}>＋ New message</button></div>
    {error && <div className="business-feedback error" role="alert">{error}<button className="text-link" type="button" onClick={() => void refreshConversations()}>Retry</button></div>}
    {newMessageOpen && <section className="message-search panel" aria-label="Start a conversation"><label htmlFor="message-member-search">Find a member</label><input id="message-member-search" value={search} onChange={(event) => setSearch(event.target.value)} maxLength={70} placeholder="Search by name or username" autoComplete="off"/><p className="small">Search for at least two characters. Private accounts appear only when their username matches.</p>{searchError && <p className="profile-error" role="alert">{searchError}</p>}{searching && <p role="status">Searching members…</p>}{searchResults.length > 0 && <div className="message-search-results">{searchResults.map((person) => <button type="button" key={person.id} onClick={() => void openConversation(person)}><span className="avatar avatar-fallback">{personName(person).replace(/^@/, "").slice(0, 1).toUpperCase()}</span><span><strong>{personName(person)}</strong><small>{person.is_private ? "Private account" : "Ofsocio member"}</small></span><b>Message</b></button>)}</div>}{search.trim().length >= 2 && !searching && !searchError && !searchResults.length && <p role="status">No visible members matched that search.</p>}</section>}
    <section className="messages-screen panel" aria-label="Your conversations">
      <aside className="messages-sidebar"><div className="messages-list-heading"><h2>Inbox</h2><button className="quiet-button" type="button" onClick={() => void refreshConversations()} disabled={loading}>Refresh</button></div>{loading ? <p role="status">Loading conversations…</p> : conversations.length ? <div className="messages-conversations">{conversations.map((conversation) => <button type="button" key={conversation.conversation_id} className={`messages-conversation ${activeId === conversation.conversation_id ? "active" : ""}`} onClick={() => setActiveId(conversation.conversation_id)} aria-current={activeId === conversation.conversation_id ? "true" : undefined}><span className="avatar avatar-fallback">{personName(conversation).replace(/^@/, "").slice(0, 1).toUpperCase()}</span><span className="messages-conversation-copy"><strong>{personName(conversation)}</strong><small>{conversation.last_message || "Start a conversation"}</small></span><time>{conversation.last_message_at ? new Date(conversation.last_message_at).toLocaleDateString() : ""}</time></button>)}</div> : <p className="messages-empty">Your inbox is empty. Start a conversation with a member.</p>}</aside>
      <div className="messages-thread">
        {activeConversation ? <>
          <header className="messages-thread-header"><div className="avatar avatar-fallback">{personName(activeConversation).replace(/^@/, "").slice(0, 1).toUpperCase()}</div><div><strong>{personName(activeConversation)}</strong><small>{activeConversation.username ? `@${activeConversation.username}` : "Ofsocio member"}</small></div><span className={`realtime-indicator ${realtimeStatus === "subscribed" ? "connected" : ""}`} aria-label={realtimeStatus === "subscribed" ? "Live updates connected" : "Live updates reconnecting"} title={realtimeStatus === "subscribed" ? "Live updates connected" : "Live updates reconnecting"}>●</span></header>
          <div className="messages-thread-list" ref={listRef} aria-live="polite">{messagesLoading ? <p role="status">Loading messages…</p> : messages.length ? messages.map((message) => <article key={message.id} className={`message-bubble ${message.sender_id === userId ? "mine" : "theirs"}`}><p>{message.body}</p><time dateTime={message.created_at}>{new Date(message.created_at).toLocaleString()}</time></article>) : <p className="messages-empty">This conversation is ready. Send the first message.</p>}</div>
          {realtimeStatus !== "subscribed" && <p className="messages-live-note" role="status">Live updates are reconnecting. Refresh the inbox to check for new messages.</p>}
          <form className="messages-compose" onSubmit={submitMessage}><label className="visually-hidden" htmlFor="message-draft">Write a message</label><textarea id="message-draft" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={5000} rows={2} placeholder="Write a message…"/><button className="button primary" type="submit" disabled={sending || !draft.trim()}>{sending ? "Sending…" : "Send"}</button></form>
        </> : <div className="messages-thread-empty"><span aria-hidden="true">✉</span><h2>{loading ? "Opening your inbox…" : "Choose a conversation"}</h2><p>Select a conversation or start a new one to message another Ofsocio member.</p></div>}
      </div>
    </section>
  </>;
}
