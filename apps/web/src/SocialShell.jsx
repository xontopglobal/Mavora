import React, { useEffect, useRef, useState } from 'react';
import './social.css';
import './design-system.css';
import './feed-replies.css';
import './mobile-typography.css';
import { loadOwnProfile, saveOwnPrivacy, saveOwnProfile, uploadOwnAvatar } from './lib/profileService';
import { listMemberSuggestions } from './lib/memberSuggestionService';
import { followUser } from './lib/circleService';
import BusinessView from './components/BusinessView';
import GroupsView from './components/GroupsView';
import CirclesView from './components/CirclesView';
import MessagesView from './components/MessagesView';
import StoriesPanel from './components/StoriesPanel';
import ReelsView from './components/ReelsView';
import SupportCenter from './components/SupportCenter';
import { createFeedPost, createPostComment, deleteFeedPost, editFeedPost, listFeedPosts, listPostComments, togglePostAppreciation } from './lib/feedService';
import { reportContent } from './lib/reportService';

async function apiRequest(path, accessToken, { method = 'GET', body } = {}) {
  const base = (import.meta.env.VITE_API_URL || 'http://localhost:8787').replace(/\/$/, '');
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { authorization: `Bearer ${accessToken}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'The Ofsocio API request failed.');
  return result;
}

const navigation = [
  { section: 'YOUR SPACE', items: [['home', '⌂', 'For you'], ['friends', '◉', 'Circles'], ['reels', '▶', 'Reels'], ['messages', '✉', 'Messages']] },
  { section: 'COMMUNITIES', items: [['groups', '◫', 'Groups'], ['business', '◇', 'Business'] ] },
  { section: 'ACCOUNT', items: [['profile', '◍', 'Your profile'], ['membership', '✦', 'Membership'], ['kyc', '▧', 'Verification']] },
  { section: 'CARE', items: [['support', '?', 'AI Support'], ['faq', '≡', 'Help & FAQ'], ['security', '⌑', 'Security Centre'], ['privacy', '◈', 'Privacy Centre']] }
];

const imageUrl = (id, width = 120, height = width) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&h=${height}&q=82`;
const currentProfileName = (profile) => profile?.display_name?.trim() || profile?.username || 'Ofsocio member';
const currentProfileAvatar = (profile) => profile?.avatar_display_url || (/^https?:\/\//i.test(profile?.avatar_url || '') ? profile.avatar_url : null);

function Avatar({ image, name, size = 'normal' }) {
  const source = /^https?:\/\//i.test(image || '') ? image : image?.startsWith('photo-') ? imageUrl(image) : null;
  if (source) return <img className={`avatar ${size}`} src={source} alt={name} />;
  const initials = (name || 'Ofsocio member').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  return <span className={`avatar avatar-fallback ${size}`} aria-label={name || 'Ofsocio member'}>{initials}</span>;
}

function IconButton({ children, label, className = '' }) {
  return <button className={`icon-button ${className}`} type="button" aria-label={label} title={`${label} is not connected yet.`} disabled>{children}</button>;
}

function HomeView({ remotePosts = [], feedLoading, feedError, onRetry, onCreatePost, onEditPost, onDeletePost, onReportPost, onToggleLike, onListComments, onCreateComment, onReplyCountChange, currentProfile, userId, focusComposer = false }) {
  const [draft, setDraft] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [notice, setNotice] = useState('');
  const [noticeError, setNoticeError] = useState(false);
  const [liking, setLiking] = useState(null);
  const [replyPostId, setReplyPostId] = useState(null);
  const [commentsByPost, setCommentsByPost] = useState({});
  const [replyDrafts, setReplyDrafts] = useState({});
  const [replyBusy, setReplyBusy] = useState(null);
  const [editingPostId, setEditingPostId] = useState(null);
  const [editDraft, setEditDraft] = useState('');
  const [editBusy, setEditBusy] = useState(null);
  const [postMenuId, setPostMenuId] = useState(null);
  const [reportPostId, setReportPostId] = useState(null);
  const [reportReason, setReportReason] = useState('spam');
  const [reportDescription, setReportDescription] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  const posts = remotePosts || [];

  useEffect(() => {
    const match = window.location.hash.match(/^#post-(.+)$/);
    if (!match || !posts.some((post) => post.id === match[1])) return undefined;
    const frame = window.requestAnimationFrame(() => document.getElementById(`post-${match[1]}`)?.scrollIntoView({ block: 'center' }));
    return () => window.cancelAnimationFrame(frame);
  }, [posts]);

  async function publish() {
    const content = draft.trim();
    if (!content || publishing) return;
    setPublishing(true);
    setNotice('');
    setNoticeError(false);
    try {
      await onCreatePost(content);
      setDraft('');
      setNotice('Your post was shared.');
    } catch (error) {
      setNotice(error.message || 'Your post could not be shared.');
      setNoticeError(true);
    } finally {
      setPublishing(false);
    }
  }

  async function appreciate(postId) {
    if (liking) return;
    setLiking(postId);
    setNotice('');
    setNoticeError(false);
    try {
      await onToggleLike(postId);
    } catch (error) {
      setNotice(error.message || 'Appreciation could not be saved.');
      setNoticeError(true);
    } finally {
      setLiking(null);
    }
  }

  async function toggleReplies(postId) {
    setReplyPostId((current) => current === postId ? null : postId);
    if (commentsByPost[postId]) return;
    setReplyBusy(postId);
    try {
      const comments = await onListComments(postId);
      setCommentsByPost((current) => ({ ...current, [postId]: comments }));
    } catch (error) {
      setNotice(error.message || 'Replies could not be loaded.');
      setNoticeError(true);
    } finally {
      setReplyBusy(null);
    }
  }

  async function sendReply(postId) {
    const body = replyDrafts[postId] || '';
    if (!body.trim() || replyBusy) return;
    setReplyBusy(postId);
    try {
      await onCreateComment(postId, body);
      const comments = await onListComments(postId);
      setCommentsByPost((current) => ({ ...current, [postId]: comments }));
      setReplyDrafts((current) => ({ ...current, [postId]: '' }));
      setRemoteReplyCount(postId, comments.length);
    } catch (error) {
      setNotice(error.message || 'Your reply could not be sent.');
      setNoticeError(true);
    } finally {
      setReplyBusy(null);
    }
  }

  function setRemoteReplyCount(postId, count) {
    if (typeof onReplyCountChange === 'function') onReplyCountChange(postId, count);
  }

  async function savePostEdit(postId) {
    if (!editDraft.trim() || editBusy) return;
    setEditBusy(postId);
    setNotice('');
    setNoticeError(false);
    try {
      await onEditPost(postId, editDraft);
      setEditingPostId(null);
      setEditDraft('');
      setNotice('Your post was updated.');
    } catch (error) {
      setNotice(error.message || 'Your post could not be updated.');
      setNoticeError(true);
    } finally {
      setEditBusy(null);
    }
  }

  async function removePost(postId) {
    if (!window.confirm('Delete this post? This also removes its replies and cannot be undone.')) return;
    setEditBusy(postId);
    setNotice('');
    setNoticeError(false);
    try {
      await onDeletePost(postId);
      setPostMenuId(null);
      setNotice('Your post was deleted.');
    } catch (error) {
      setNotice(error.message || 'Your post could not be deleted.');
      setNoticeError(true);
    } finally {
      setEditBusy(null);
    }
  }

  async function sharePost(postId) {
    const postUrl = new URL(window.location.href);
    postUrl.hash = `post-${encodeURIComponent(postId)}`;
    const shareData = { title: 'Ofsocio post', text: 'Take a look at this post on Ofsocio.', url: postUrl.toString() };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        setNotice('Post shared.');
      }
      else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(postUrl.toString());
        setNotice('Post link copied.');
      } else throw new Error('Sharing is unavailable in this browser.');
      setNoticeError(false);
    } catch (error) {
      if (error.name === 'AbortError') return;
      setNotice(error.message || 'The post link could not be shared.');
      setNoticeError(true);
    }
  }

  async function submitReport(event) {
    event.preventDefault();
    if (!reportPostId || reportBusy) return;
    setReportBusy(true);
    setNotice('');
    setNoticeError(false);
    try {
      await onReportPost(reportPostId, reportReason, reportDescription);
      setReportPostId(null);
      setReportDescription('');
      setNotice('Your report was received for review.');
    } catch (error) {
      setNotice(error.message || 'Your report could not be submitted.');
      setNoticeError(true);
    } finally {
      setReportBusy(false);
    }
  }

  return <>
    <div className="view-heading"><div><div className="eyebrow">YOUR OFSOCIO COMMUNITY</div><h1>The near &amp; now</h1><p>Posts from members, loaded from your account.</p></div><span className="live-mark"><i /> LIVE FEED</span></div>
    <StoriesPanel userId={userId}/>
    <section className="composer panel"><Avatar image={currentProfile?.avatar_display_url} name={currentProfileName(currentProfile)} /><div className="composer-main"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="What would you like to share?" aria-label="Write a post" maxLength={5000} autoFocus={focusComposer} /><div className="composer-actions"><div className="composer-tools"><button type="button" disabled title="Photo posts are not connected yet.">▧ <span>Photo</span></button><button type="button" disabled title="Stories are not connected yet.">◷ <span>Story</span></button><button type="button" disabled title="Posts are currently shared publicly.">◈ <span>Audience: Public</span></button></div><button className="button primary small-button" type="button" onClick={() => void publish()} disabled={!draft.trim() || publishing}>{publishing ? 'Sharing…' : 'Share'} <span>↗</span></button></div></div></section>
    {notice && <p className={noticeError ? 'profile-error' : 'profile-save-message'} role="status" aria-live="polite">{notice}</p>}
    <div className="feed-toolbar"><div><span className="eyebrow">YOUR FEED</span><h2>Published posts</h2></div><button type="button" className="quiet-button" disabled title="Feed sorting is not connected yet.">For you <span>⌄</span></button></div>
    {feedError && <div className="business-feedback error" role="alert">{feedError} <button className="text-link" type="button" onClick={() => void onRetry()}>Retry</button></div>}
    {feedLoading ? <div className="business-state panel" role="status">Loading your feed…</div>
      : posts.length ? <div className="feed-list">{posts.map((post) => {
        const authorName = post.author?.display_name || post.author?.username || 'Ofsocio member';
        const isOwnPost = post.author_id === userId;
        return <article className="post panel" id={`post-${post.id}`} tabIndex="-1" key={post.id}>
          <header className="post-header"><Avatar image={post.author?.avatar_url} name={authorName} /><div className="post-by"><strong>{authorName}</strong><span>{post.created_at ? new Date(post.created_at).toLocaleString() : 'Recently'} · {post.visibility}</span></div><div className="post-menu-wrap"><button className="more-button" type="button" aria-label="Post options" aria-expanded={postMenuId === post.id} onClick={() => setPostMenuId((current) => current === post.id ? null : post.id)}>•••</button>{postMenuId === post.id && <div className="post-menu">{isOwnPost && <><button type="button" onClick={() => { setEditDraft(post.body || ''); setEditingPostId(post.id); setPostMenuId(null); }}>Edit post</button><button type="button" className="post-delete-action" onClick={() => void removePost(post.id)} disabled={editBusy === post.id}>Delete post</button></>}<button type="button" onClick={() => { setReportPostId(post.id); setReportDescription(''); setPostMenuId(null); }}>Report post</button></div>}</div></header>
          {editingPostId === post.id ? <form className="post-edit-form" onSubmit={(event) => { event.preventDefault(); void savePostEdit(post.id); }}><label htmlFor={`edit-post-${post.id}`}>Edit your post</label><textarea id={`edit-post-${post.id}`} value={editDraft} onChange={(event) => setEditDraft(event.target.value)} maxLength={5000} required/><div><button className="button outline" type="button" onClick={() => { setEditingPostId(null); setEditDraft(''); }}>Cancel</button><button className="button primary" type="submit" disabled={editBusy === post.id || !editDraft.trim()}>{editBusy === post.id ? 'Saving…' : 'Save changes'}</button></div></form> : <p className="post-copy">{post.body}</p>}{post.media_urls?.filter((url) => /^https?:\/\//i.test(url)).map((url) => <div className="post-image" key={url}><img src={url} alt="Post attachment" /></div>)}
          <div className="post-reactions"><span className="reaction-stack"><i>♥</i></span><span>{post.appreciation_count || 0} appreciations</span><span className="reply-count">{post.reply_count || 0} replies</span></div>
          <div className="post-actions"><button type="button" className={post.appreciated_by_me ? 'is-liked' : ''} onClick={() => void appreciate(post.id)} disabled={liking === post.id}><span>♡</span>{liking === post.id ? 'Saving…' : 'Appreciate'}</button><button type="button" aria-expanded={replyPostId === post.id} onClick={() => void toggleReplies(post.id)}><span>◯</span> Reply</button><button type="button" onClick={() => void sharePost(post.id)}><span>↗</span> Share</button><button type="button" className="save-action" disabled title="Saved posts are not connected yet."><span>◇</span> Save</button></div>
          {replyPostId === post.id && <section className="post-replies" aria-label="Replies">
            {replyBusy === post.id && !commentsByPost[post.id] ? <p role="status">Loading replies…</p> : <>
              {(commentsByPost[post.id] || []).map((comment) => <article className="post-reply" key={comment.id}><Avatar image={comment.author?.avatar_url} name={comment.author?.display_name || comment.author?.username || 'Ofsocio member'} size="small"/><div><strong>{comment.author?.display_name || comment.author?.username || 'Ofsocio member'}</strong><p>{comment.body}</p></div></article>)}
              {!commentsByPost[post.id]?.length && <p className="reply-empty">No replies yet. Start the conversation.</p>}
              <form className="reply-form" onSubmit={(event) => { event.preventDefault(); void sendReply(post.id); }}><input value={replyDrafts[post.id] || ''} onChange={(event) => setReplyDrafts((current) => ({ ...current, [post.id]: event.target.value }))} maxLength={2000} aria-label="Write a reply" placeholder="Write a thoughtful reply…"/><button className="button primary small-button" type="submit" disabled={replyBusy === post.id || !replyDrafts[post.id]?.trim()}>{replyBusy === post.id ? 'Sending…' : 'Send'}</button></form>
            </>}
          </section>}
        </article>;
      })}</div> : <div className="business-state panel">No published posts are available yet. Your posts will appear here after you share them.</div>}
    {reportPostId && <div className="report-dialog-backdrop"><form className="report-dialog panel" role="dialog" aria-modal="true" aria-labelledby="report-dialog-title" onSubmit={(event) => void submitReport(event)}><h2 id="report-dialog-title">Report this post</h2><p>Your report will be sent to Ofsocio moderators for review.</p><label htmlFor="report-reason">Reason</label><select id="report-reason" value={reportReason} onChange={(event) => setReportReason(event.target.value)}><option value="spam">Spam or scam</option><option value="harassment">Harassment</option><option value="hate_or_discrimination">Hate or discrimination</option><option value="violence_or_threats">Violence or threats</option><option value="impersonation">Impersonation</option><option value="other">Other</option></select><label htmlFor="report-description">What should our moderators review?</label><textarea id="report-description" value={reportDescription} onChange={(event) => setReportDescription(event.target.value)} minLength={10} maxLength={2000} rows={4} required placeholder="Add details that will help us review this report."/><div className="report-dialog-actions"><button className="button outline" type="button" onClick={() => { setReportPostId(null); setReportDescription(''); }} disabled={reportBusy}>Cancel</button><button className="button primary" type="submit" disabled={reportBusy || reportDescription.trim().length < 10}>{reportBusy ? 'Sending…' : 'Submit report'}</button></div></form></div>}
  </>;
}


function MembershipView({ catalog, profile, onCheckout }) {
  const hasLiveCatalog = Boolean(catalog?.plans?.length && catalog?.prices);
  const currentStatus = profile?.membership_status;
  return <><div className="view-heading"><div><div className="eyebrow">YOUR OFSOCIO MEMBERSHIP</div><h1>Membership</h1><p>Plan details and access are shown only when the live membership service is available.</p></div></div><section className="business-state panel" role="status">{hasLiveCatalog && onCheckout ? `Live plan catalog is available${currentStatus ? ` · status: ${currentStatus}` : ''}, but checkout is not connected in this build.` : 'Membership plans, current status, and checkout are not connected to this account. No sample plans or payment actions are shown.'}</section></>;
}

function KycView({ applications = [], onSubmitApplication }) {
  const getStatus = (type) => applications.find((item) => item.application_type === type)?.status || 'not_started';
  const submit = (type) => onSubmitApplication?.(type);
  const individualStatus = getStatus('individual');
  const businessStatus = getStatus('business');
  const statusLabel = (status) => status === 'not_started' ? 'Not started' : status.replaceAll('_', ' ');
  return <><div className="view-heading"><div><div className="eyebrow">IDENTITY, HANDLED WITH CARE</div><h1>Verification</h1><p>Only required for selected services. Your documents are never collected in this preview.</p></div></div><div className="verification-layout"><section className="verification-card panel"><div className="verification-icon">▧</div><span className="eyebrow">INDIVIDUAL VERIFICATION</span><h2>Verify your identity</h2><p>Securely confirm your identity to access eligible Premium features. A vetted provider handles document checks in production.</p><div className="status-line"><span>Status</span><strong className={`status-pill ${individualStatus === 'not_started' ? '' : 'pending'}`}>{statusLabel(individualStatus)}</strong></div><button className="button primary full-button" onClick={() => submit('individual')} disabled={!onSubmitApplication || individualStatus === 'submitted' || individualStatus === 'in_review'} title={!onSubmitApplication ? 'Verification is not connected yet.' : undefined}>{individualStatus === 'not_started' ? 'Start secure verification' : 'Application submitted'}</button><small>Provider, retention and regional availability are confirmed before launch.</small></section><section className="verification-card panel"><div className="verification-icon business-icon">◇</div><span className="eyebrow">BUSINESS VERIFICATION</span><h2>Verify an organisation</h2><p>Confirm your organisation and authorised representative before activating Business / Pro tools.</p><div className="status-line"><span>Status</span><strong className={`status-pill ${businessStatus === 'not_started' ? '' : 'pending'}`}>{statusLabel(businessStatus)}</strong></div><button className="button outline full-button" onClick={() => submit('business')} disabled={!onSubmitApplication || businessStatus === 'submitted' || businessStatus === 'in_review'} title={!onSubmitApplication ? 'Verification is not connected yet.' : undefined}>Prepare business verification</button></section></div><div className="privacy-callout"><span>◈</span><p><strong>Minimal by design.</strong> Ofsocio stores the verification outcome and provider reference where possible, not raw identity documents.</p></div></>;
}

function ApprovalView({ preview, applications = [] }) {
  const items = applications.map((application) => ({
    id: application.id,
    name: `${application.application_type === 'business' ? 'Business' : 'Individual'} · ${application.applicant_id.slice(0, 8)}`,
    type: application.application_type === 'business' ? 'Business verification' : 'Individual verification',
    detail: `${application.status.replaceAll('_', ' ')} · ${new Date(application.submitted_at).toLocaleString()}`
  }));
  return <><div className="view-heading"><div><div className="eyebrow">{preview ? 'STAFF PREVIEW' : 'RESTRICTED STAFF WORKSPACE'}</div><h1>Verification review</h1><p>{preview ? 'This preview does not contain sample or live review records.' : 'Read-only queue. Review decisions are disabled until atomic audit-backed actions are implemented.'}</p></div>{!preview && <span className="queue-count">{items.length} in queue</span>}</div>{preview ? <div className="business-state panel" role="status">Sign in with an authorized staff account to load the real verification queue.</div> : <div className="approval-layout"><section className="approval-queue panel"><div className="section-title"><div><span className="eyebrow">VERIFICATION QUEUE</span><h2>Applications</h2></div></div>{items.length ? items.map((item) => <article className="approval-item" key={item.id}><Avatar name={item.name}/><div className="approval-info"><strong>{item.name}</strong><span>{item.type}</span><small>{item.detail}</small></div></article>) : <div className="empty-state">No verification applications are available.</div>}</section></div>}</>;
}

function StaffWorkspace({ capabilities, section, reports, applications, auditEvents, error, loading, onSection, userId }) {
  const title = section === 'reports' ? 'Content reports' : section === 'audit' ? 'Audit log' : section === 'verification' ? 'Verification review' : 'Customer service';
  const rows = section === 'reports' ? reports : auditEvents;
  return <><div className="view-heading"><div><div className="eyebrow">RESTRICTED STAFF WORKSPACE</div><h1>{title}</h1><p>Access is checked against your signed-in account and current server-side role permissions.</p></div></div><div className="segmented" role="tablist" aria-label="Staff workspaces">{capabilities.includes('reports.read') && <button type="button" aria-selected={section === 'reports'} onClick={() => onSection('reports')}>Reports</button>}{capabilities.includes('kyc.read') && <button type="button" aria-selected={section === 'verification'} onClick={() => onSection('verification')}>Verification</button>}{capabilities.includes('audit.read') && <button type="button" aria-selected={section === 'audit'} onClick={() => onSection('audit')}>Audit log</button>}{capabilities.includes('support.read') && <button type="button" aria-selected={section === 'support'} onClick={() => onSection('support')}>Customer service</button>}</div>{error && <div className="business-state panel" role="alert">{error}</div>}{loading && <div className="business-state panel" role="status">Loading authorized staff records…</div>}{section === 'support' && <SupportCenter userId={userId} staff canReply={capabilities.includes('support.reply')} />}{section === 'reports' && !loading && !error && <section className="approval-queue panel"><div className="section-title"><div><span className="eyebrow">REPORT QUEUE</span><h2>{reports.length} loaded</h2></div></div>{reports.length ? reports.map((report) => <article className="approval-item" key={report.id}><div className="approval-info"><strong>{report.target_type} · {report.status.replaceAll('_', ' ')}</strong><span>{report.reason.replaceAll('_', ' ')}</span><p>{report.description}</p><small>Target {report.target_id} · received {new Date(report.created_at).toLocaleString()}</small></div></article>) : <div className="empty-state">No reports are available.</div>}<p className="disclaimer">Moderation decisions and account restrictions are not enabled in this read-only stage.</p></section>}{section === 'verification' && !loading && !error && <ApprovalView applications={applications} />}{section === 'audit' && !loading && !error && <section className="approval-queue panel"><div className="section-title"><div><span className="eyebrow">AUDIT EVENTS</span><h2>{auditEvents.length} loaded</h2></div></div>{auditEvents.length ? auditEvents.map((event) => <article className="approval-item" key={event.id}><div className="approval-info"><strong>{event.action}</strong><span>{event.target_type} · {event.target_id}</span><small>Actor {event.actor_id || 'system'} · {new Date(event.created_at).toLocaleString()}</small></div></article>) : <div className="empty-state">No audit events are available.</div>}</section>}</>;
}

function ProfileView({ profile, loading, error, onSave, onUploadAvatar, onRetry }) {
  const [tab, setTab] = useState('Posts');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageError, setMessageError] = useState(false);
  const [draft, setDraft] = useState(null);
  const displayName = profile?.display_name?.trim() || profile?.username || 'Ofsocio member';
  const avatar = profile?.avatar_display_url || (/^https?:\/\//i.test(profile?.avatar_url || '') ? profile.avatar_url : null);

  useEffect(() => {
    if (profile) setDraft({
      username: profile.username || '',
      display_name: profile.display_name || '',
      bio: profile.bio || '',
      country_code: profile.country_code?.trim() || '',
      preferred_language: profile.preferred_language || 'en',
      preferred_currency: profile.preferred_currency?.trim() || '',
      timezone: profile.timezone || ''
    });
  }, [profile]);

  function updateField(event) {
    const value = event.target.name === 'country_code' ? event.target.value.toUpperCase() : event.target.value;
    setDraft((current) => ({ ...current, [event.target.name]: value }));
  }

  async function changePhoto(event) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    setMessage('');
    setMessageError(false);
    try {
      const updated = await onUploadAvatar(file);
      setMessage(updated.avatar_cleanup_warning || 'Profile photo updated.');
      setMessageError(Boolean(updated.avatar_cleanup_warning));
    } catch (uploadError) {
      setMessage(uploadError.message || 'Profile photo could not be updated.');
      setMessageError(true);
    } finally {
      setPhotoUploading(false);
      input.value = '';
    }
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setMessageError(false);
    try {
      await onSave(draft);
      setEditing(false);
      setMessage('Your profile has been saved.');
    } catch (error) {
      setMessage(error.message || 'Your profile could not be saved.');
      setMessageError(true);
    } finally {
      setSaving(false);
    }
  }

  const field = (label, name, options = {}) => <label className="profile-field" key={name}>
    <span>{label}</span>
    {options.multiline
      ? <textarea name={name} value={draft?.[name] || ''} onChange={updateField} maxLength={options.maxLength} rows="4" />
      : <input name={name} value={draft?.[name] || ''} onChange={updateField} maxLength={options.maxLength} required={options.required} pattern={options.pattern} title={options.title} placeholder={options.placeholder} autoCapitalize={options.autoCapitalize} autoComplete={options.autoComplete || 'off'} />}
  </label>;

  return <><div className="profile-cover"><div className="cover-lines"/><button className="profile-edit" type="button" onClick={() => { setMessage(''); setMessageError(false); setEditing((value) => !value); }} disabled={loading || !profile}>{editing ? 'Cancel editing' : 'Edit profile ↗'}</button></div>
    <section className="profile-summary panel"><div className="profile-avatar-control"><Avatar image={avatar} name={displayName} size="profile"/><label className="profile-photo-upload">{photoUploading ? 'Uploading…' : 'Change photo'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={changePhoto} disabled={loading || photoUploading || !profile} aria-label="Upload a profile photo"/></label></div><div className="profile-details"><div className="profile-name-row"><div><h1>{displayName}</h1><span>{profile?.username ? `@${profile.username}` : 'Choose a username'}{profile?.country_code ? ` · ${profile.country_code.trim()}` : ''}</span></div><span className="profile-schema-note">{profile ? (profile.is_private ? 'Private profile' : 'Public profile') : 'Privacy status unavailable'}</span></div><p>{profile?.bio || 'Add a short introduction to tell your circles about yourself.'}</p><div className="profile-stats"><span>{loading ? 'Loading profile…' : 'Profile details are synced to your account'}</span></div></div></section>
    {editing && draft && <form className="profile-editor panel" onSubmit={submit}>
      <div className="profile-editor-heading"><div><span className="eyebrow">YOUR ACCOUNT DETAILS</span><h2>Edit profile</h2><p>Changes save to your Ofsocio profile.</p></div></div>
      <div className="profile-editor-grid">{field('Display name', 'display_name', { maxLength: 80, required: true })}{field('Username', 'username', { maxLength: 30, required: true, pattern: '[A-Za-z0-9_.]{3,30}', title: 'Use 3–30 letters, numbers, periods, or underscores.' })}{field('Country / region code (ISO alpha-2)', 'country_code', { maxLength: 2, pattern: '[A-Za-z]{2}', title: 'Enter the two-letter ISO country code, for example NG or GB.', placeholder: 'e.g. NG' })}{field('Preferred language', 'preferred_language', { maxLength: 10 })}{field('Preferred currency', 'preferred_currency', { maxLength: 3, pattern: '[A-Za-z]{3}', title: 'Enter a three-letter currency code.' })}{field('Timezone', 'timezone', { maxLength: 64 })}{field('Bio', 'bio', { multiline: true, maxLength: 280 })}</div>
      <div className="profile-editor-footer"><span className={messageError ? "profile-error" : "profile-save-message"} role="status" aria-live="polite">{message}</span><button className="button primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button></div>
    </form>}
    {error && <p className="profile-error" role="alert">{error} <button className="text-link" type="button" onClick={onRetry}>Retry</button></p>}
    {message && !editing && <p className={messageError ? 'profile-error' : 'profile-save-message'} role="status" aria-live="polite">{message}</p>}

    <div className="profile-tabs">{['Posts', 'Stories', 'About', 'Friends'].map((item) => <button type="button" className={tab === item ? 'active' : ''} onClick={() => setTab(item)} key={item} disabled={item !== 'About'} title={item !== 'About' ? `${item} are not connected yet.` : undefined}>{item}</button>)}</div><div className="profile-content panel"><span className="eyebrow">{tab.toUpperCase()}</span><h2>Your profile details</h2><p>Your editable profile details are shown above. Posts, stories, and circle activity are not connected yet.</p></div></>;
}
function CentreView({ privacy = false, profile, onSavePrivacy }) {
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [privacyError, setPrivacyError] = useState('');
  const [privacyNotice, setPrivacyNotice] = useState('');
  async function submitPrivacy(event) {
    event.preventDefault();
    if (!profile || savingPrivacy) return;
    const form = new FormData(event.currentTarget);
    setSavingPrivacy(true);
    setPrivacyError('');
    setPrivacyNotice('');
    try {
      await onSavePrivacy({ is_private: form.get('is_private') === 'private', follower_list_visibility: form.get('follower_list_visibility') });
      setPrivacyNotice('Your privacy settings were saved.');
    } catch (error) {
      setPrivacyError(error.message || 'Your privacy settings could not be saved.');
    } finally {
      setSavingPrivacy(false);
    }
  }
  if (privacy) return <><div className="view-heading"><div><div className="eyebrow">YOUR DATA, YOUR DECISIONS</div><h1>Privacy Centre</h1><p>These choices are saved to your profile and enforced by the database visibility rules.</p></div></div><form key={profile ? `${profile.is_private}-${profile.follower_list_visibility}` : 'loading'} className="settings-list panel" onSubmit={submitPrivacy}><div className="setting-row"><div className="setting-icon">◈</div><div className="setting-description"><strong>Profile visibility</strong><span>Private profiles require an approved follow before other members can view protected profile content.</span></div><label className="privacy-choice"><span className="sr-only">Profile visibility</span><select name="is_private" defaultValue={profile?.is_private ? 'private' : 'public'} disabled={!profile || savingPrivacy}><option value="public">Public</option><option value="private">Private</option></select></label></div><div className="setting-row"><div className="setting-icon">◉</div><div className="setting-description"><strong>Who can see your follower list</strong><span>This setting is enforced when members request your follower list.</span></div><label className="privacy-choice"><span className="sr-only">Follower list visibility</span><select name="follower_list_visibility" defaultValue={profile?.follower_list_visibility || 'followers'} disabled={!profile || savingPrivacy}><option value="public">Everyone</option><option value="followers">Approved followers</option><option value="friends">Friends</option><option value="only_me">Only me</option></select></label></div>{privacyError && <p className="profile-error" role="alert">{privacyError}</p>}{privacyNotice && <p className="profile-save-message" role="status">{privacyNotice}</p>}<button className="button primary" type="submit" disabled={!profile || savingPrivacy}>{savingPrivacy ? 'Saving…' : 'Save privacy settings'}</button></form><aside className="security-card panel"><div className="security-emblem">◈</div><span className="eyebrow">BACKEND ENFORCED</span><h2>Privacy follows your account</h2><p>Changing profile visibility affects profile, post, Story, and Reel access according to their database policies. Already approved followers retain access until you remove them.</p></aside></>;
  const groups = privacy ? [
    { title: 'Account visibility', detail: 'Your current privacy setting is not available here.', key: 'privateAccount' },
    { title: 'Message requests', detail: 'Message-request controls are not connected.', key: 'messageRequests' },
    { title: 'Personalized discovery', detail: 'Discovery preferences are not connected.', key: 'personalizedDiscovery' },
    { title: 'Your data', detail: 'Request a copy or manage account deletion.', key: 'data', value: 'Manage' }
  ] : [
    { title: 'Two-step verification', detail: 'Two-step verification is not connected.', key: 'twoFactor' },
    { title: 'Login alerts', detail: 'Login alerts are not connected.', key: 'loginAlerts' },
    { title: 'Active sessions', detail: 'Session management is not connected.', key: 'sessions' },
    { title: 'Connected apps', detail: 'Review services with account access.', key: 'apps', value: 'Manage' }
  ];
  return <><div className="view-heading"><div><div className="eyebrow">A QUIETER KIND OF CONFIDENCE</div><h1>Security Centre</h1><p>Review account-security information.</p></div></div><div className="centre-layout"><section className="settings-list panel">{groups.map((item) => <div className="setting-row" key={item.key}><div className="setting-icon">⌑</div><div className="setting-description"><strong>{item.title}</strong><span>{item.detail}</span></div><span className="setting-unavailable">Not connected</span></div>)}</section><aside className="security-card panel"><div className="security-emblem">✦</div><span className="eyebrow">SECURITY INFORMATION</span><h2>Security controls unavailable</h2><p>These controls are not connected. No security setting is represented as active.</p></aside></div></>;
}

function Sidebar({ view, setView, onSignOut, preview, exitLabel, staffAccess, currentProfile }) {
  return <aside className="desktop-sidebar"><a className="wordmark" href="#home" onClick={(event) => { event.preventDefault(); setView('home'); }}>OFSOCIO<small>social</small></a><button className="account-chip" type="button" onClick={() => setView('profile')}><Avatar image={currentProfileAvatar(currentProfile)} name={currentProfileName(currentProfile)}/><span><strong>{currentProfileName(currentProfile)}</strong><small>{preview ? 'Local preview' : 'Your account'}</small></span><b>⌄</b></button><div className="side-nav">{navigation.map((group) => <div className="nav-group" key={group.section}><div className="nav-caption">{group.section}</div>{group.items.map(([id, icon, label]) => <button className={`side-link ${view === id ? 'active' : ''}`} type="button" key={id} onClick={() => setView(id)}><span className="side-icon">{icon}</span>{label}</button>)}</div>)}{staffAccess && <div className="nav-group"><div className="nav-caption">STAFF WORKSPACE</div><button className={`side-link ${view === 'staff' ? 'active' : ''}`} type="button" onClick={() => setView('staff')}><span className="side-icon">⌑</span>Staff dashboard</button></div>}</div><div className="sidebar-bottom"><button className="side-link" onClick={() => setView('privacy')} type="button"><span className="side-icon">◈</span>Privacy settings</button><button className="side-link" onClick={onSignOut} type="button"><span className="side-icon">↗</span>{exitLabel || (preview ? 'Exit preview' : 'Sign out')}</button></div></aside>;
}

function RightRail({ currentProfile, userId, onNavigate, onSearch }) {
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionLoading, setSuggestionLoading] = useState(true);
  const [suggestionError, setSuggestionError] = useState('');
  const [followingId, setFollowingId] = useState('');
  const [suggestionNotice, setSuggestionNotice] = useState('');
  useEffect(() => {
    let active = true;
    setSuggestionLoading(true);
    setSuggestionError('');
    listMemberSuggestions(userId)
      .then((rows) => { if (active) setSuggestions(rows); })
      .catch((error) => { if (active) setSuggestionError(error.message || 'Member suggestions could not be loaded.'); })
      .finally(() => { if (active) setSuggestionLoading(false); });
    return () => { active = false; };
  }, [userId]);

  async function followSuggestion(profile) {
    setFollowingId(profile.id);
    setSuggestionError('');
    setSuggestionNotice('');
    try {
      await followUser(userId, profile.id);
      setSuggestions((current) => current.filter((item) => item.id !== profile.id));
      setSuggestionNotice(`You are now following @${profile.username}.`);
    } catch (error) {
      setSuggestionError(error.message || 'Could not follow this member.');
    } finally {
      setFollowingId('');
    }
  }

  function openSuggestion(profile) {
    onSearch(profile.username ? `@${profile.username}` : '');
    onNavigate('friends');
  }

  const required = [currentProfile?.username, currentProfile?.display_name, currentProfile?.bio, currentProfile?.country_code, currentProfile?.avatar_url];
  const complete = required.filter((value) => Boolean(String(value || '').trim())).length;
  const percent = Math.round((complete / required.length) * 100);
  return <aside className="right-rail"><div className="rail-block profile-nudge"><div className="rail-heading"><span className="eyebrow">YOUR SPACE</span><button type="button" className="text-link" onClick={() => onNavigate('profile')}>Edit</button></div><div className="mini-profile"><Avatar image={currentProfileAvatar(currentProfile)} name={currentProfileName(currentProfile)} size="large"/><div><strong>{currentProfileName(currentProfile)}</strong><span>{currentProfile?.country_code?.trim() || 'Your profile'}</span></div></div><div className="profile-progress"><div><span>Profile details</span><strong>{complete} of {required.length}</strong></div><div className="progress-track" role="progressbar" aria-label="Profile completeness" aria-valuemin="0" aria-valuemax="100" aria-valuenow={percent}><i style={{ width: `${percent}%` }}/></div><small>Based on saved profile fields.</small></div></div><div className="rail-block"><div className="rail-heading"><div><span className="eyebrow">GOOD PEOPLE</span><h3>Suggested for you</h3></div><button type="button" className="text-link" onClick={() => onNavigate('friends')}>Discover</button></div>{suggestionLoading ? <div className="business-state" role="status">Loading suggestions…</div> : suggestionError ? <div className="business-feedback error" role="alert">{suggestionError}<button type="button" className="text-link" onClick={() => { setSuggestionError(''); setSuggestionLoading(true); listMemberSuggestions(userId).then(setSuggestions).catch((error) => setSuggestionError(error.message || 'Member suggestions could not be loaded.')).finally(() => setSuggestionLoading(false)); }}>Retry</button></div> : suggestions.length ? <div className="suggestions-list">{suggestions.map((profile) => <div className="suggested-person" key={profile.id}><Avatar image={profile.avatar_display_url} name={profile.display_name || profile.username}/><button type="button" className="suggestion-profile-link" onClick={() => openSuggestion(profile)}>{profile.display_name?.trim() || `@${profile.username}`}</button><button type="button" className="suggestion-follow" aria-label={`Follow @${profile.username}`} disabled={followingId === profile.id} onClick={() => void followSuggestion(profile)}>{followingId === profile.id ? '…' : '＋'}</button></div>)}</div> : <div className="business-state">No public member suggestions are available right now.</div>}{suggestionNotice && <p className="profile-save-message" role="status">{suggestionNotice}</p>}</div><footer className="rail-footer">About · Community · Privacy · Terms<br/>© 2026 Ofsocio Social</footer></aside>;
}

export default function SocialShell({ preview, onExit, accessToken, exitLabel, userId }) {
  const [view, setView] = useState('home');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [search, setSearch] = useState('');
  const [remoteProfile, setRemoteProfile] = useState(null);
  const [accountProfile, setAccountProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const profileRetryInFlight = useRef(false);
  const [remotePosts, setRemotePosts] = useState([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState('');
  const [membershipCatalog, setMembershipCatalog] = useState(null);
  const [kycApplications, setKycApplications] = useState([]);
  const [capabilities, setCapabilities] = useState([]);
  const [approvalApplications, setApprovalApplications] = useState([]);
  const [staffReports, setStaffReports] = useState([]);
  const [auditEvents, setAuditEvents] = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffSection, setStaffSection] = useState('');
  const [apiNotice, setApiNotice] = useState('');
  const mobileItems = [['home', '⌂', 'Home'], ['friends', '◉', 'Circles'], ['create', '＋', 'Create'], ['messages', '✉', 'Inbox'], ['profile', '◍', 'You']];

  useEffect(() => {
    if (!userId) {
      setAccountProfile(null);
      return undefined;
    }
    let active = true;
    setProfileLoading(true);
    setProfileError('');
    loadOwnProfile(userId)
      .then((profile) => { if (active) setAccountProfile(profile); })
      .catch((error) => { if (active) setProfileError(error.message || 'Your profile could not be loaded.'); })
      .finally(() => { if (active) setProfileLoading(false); });
    return () => { active = false; };
  }, [userId]);

  async function saveProfile(values) {
    setProfileError('');
    const savedProfile = await saveOwnProfile(userId, values);
    setAccountProfile(savedProfile);
    return savedProfile;
  }

  async function savePrivacy(values) {
    const savedProfile = await saveOwnPrivacy(userId, values);
    setAccountProfile(savedProfile);
    return savedProfile;
  }

  async function retryProfile() {
    if (!userId || profileRetryInFlight.current) return;
    profileRetryInFlight.current = true;
    setProfileError('');
    setProfileLoading(true);
    try {
      const profile = await loadOwnProfile(userId);
      setAccountProfile(profile);
      setProfileError('');
    } catch (error) {
      setProfileError(error.message || 'Your profile could not be loaded.');
    } finally {
      profileRetryInFlight.current = false;
      setProfileLoading(false);
    }
  }

  async function refreshFeed() {
    if (!userId) {
      setRemotePosts([]);
      setFeedError("Sign in to see your feed.");
      setFeedLoading(false);
      return;
    }
    setFeedLoading(true);
    setFeedError("");
    try {
      setRemotePosts(await listFeedPosts(userId));
    } catch (error) {
      setFeedError(error.message || "Your feed could not be loaded.");
    } finally {
      setFeedLoading(false);
    }
  }

  useEffect(() => { void refreshFeed(); }, [userId]);

  async function publishPost(body) {
    await createFeedPost(userId, body);
    await refreshFeed();
  }

  async function updateFeedPost(postId, body) {
    const updated = await editFeedPost(userId, postId, body);
    setRemotePosts((current) => current.map((post) => post.id === postId ? { ...post, ...updated } : post));
  }

  async function removeFeedPost(postId) {
    await deleteFeedPost(userId, postId);
    setRemotePosts((current) => current.filter((post) => post.id !== postId));
  }

  async function reportPostContent(postId, reason, description) {
    return reportContent(userId, 'post', postId, reason, description);
  }

  async function appreciatePost(postId) {
    const appreciated = await togglePostAppreciation(userId, postId);
    setRemotePosts((current) => current.map((post) => post.id === postId ? {
      ...post,
      appreciated_by_me: appreciated,
      appreciation_count: Math.max(0, (post.appreciation_count || 0) + (appreciated ? 1 : -1))
    } : post));
  }

  async function loadPostComments(postId) {
    return listPostComments(userId, postId);
  }

  async function publishComment(postId, body) {
    await createPostComment(userId, postId, body);
  }

  function updateReplyCount(postId, count) {
    setRemotePosts((current) => current.map((post) => post.id === postId ? { ...post, reply_count: count } : post));
  }


  useEffect(() => {
    if (preview || !accessToken) { setCapabilities([]); return undefined; }
    let active = true;
    apiRequest('/api/me/capabilities', accessToken)
      .then((result) => { if (active) setCapabilities(Array.isArray(result.capabilities) ? result.capabilities : []); })
      .catch((error) => { if (active) { setCapabilities([]); setApiNotice(error.message); } });
    return () => { active = false; };
  }, [accessToken, preview]);

  useEffect(() => {
    if (preview || view !== 'staff' || !accessToken) return undefined;
    const preferred = capabilities.includes('reports.read') ? 'reports' : capabilities.includes('kyc.read') ? 'verification' : capabilities.includes('audit.read') ? 'audit' : 'support';
    const section = staffSection || preferred;
    if ((section === 'reports' && !capabilities.includes('reports.read')) || (section === 'verification' && !capabilities.includes('kyc.read')) || (section === 'audit' && !capabilities.includes('audit.read')) || (section === 'support' && !capabilities.includes('support.read'))) return undefined;
    let active = true;
    setStaffLoading(section !== 'support');
    setApiNotice('');
    const routes = { reports: '/api/admin/reports', verification: '/api/admin/kyc', audit: '/api/admin/audit' };
    if (routes[section]) apiRequest(routes[section], accessToken)
      .then((result) => { if (!active) return; if (section === 'reports') setStaffReports(result.reports || []); if (section === 'verification') setApprovalApplications(result.applications || []); if (section === 'audit') setAuditEvents(result.events || []); })
      .catch((error) => { if (active) setApiNotice(error.message); })
      .finally(() => { if (active) setStaffLoading(false); });
    return () => { active = false; };
  }, [accessToken, capabilities, preview, staffSection, view]);

  function navigate(next) {
    setView(next);
    setMobileMenu(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function createPost(body) {
    if (preview || !accessToken) return;
    setApiNotice('');
    try {
      const result = await apiRequest('/api/social/posts', accessToken, {
        method: 'POST',
        body: { body, visibility: 'friends', mediaUrls: [] }
      });
      const post = result.post;
      setRemotePosts((current) => [{
        id: post.id,
        authorId: post.author_id,
        body: post.body,
        mediaUrls: post.media_urls,
        visibility: post.visibility,
        createdAt: post.created_at,
        author: { display_name: remoteProfile?.display_name || 'You' }
      }, ...(current || [])]);
    } catch (error) {
      setApiNotice(error.message);
    }
  }

  async function submitKyc(applicationType) {
    if (preview || !accessToken) return;
    setApiNotice('');
    try {
      const result = await apiRequest('/api/me/kyc', accessToken, {
        method: 'POST',
        body: { applicationType }
      });
      setKycApplications((current) => [result.application, ...current]);
    } catch (error) {
      setApiNotice(error.message);
    }
  }

  async function startCheckout(planCode, billingPeriod) {
    if (preview || !accessToken) return;
    const countryCode = remoteProfile?.country_code?.trim();
    const price = membershipCatalog?.prices?.find((item) => item.plan_code === planCode
      && item.country_code === countryCode && item.billing_period === billingPeriod
      && (!remoteProfile?.preferred_currency || item.currency === remoteProfile.preferred_currency));
    if (!price) {
      setApiNotice('Regional pricing is not configured for this plan yet.');
      return;
    }
    try {
      const result = await apiRequest('/api/billing/checkout', accessToken, {
        method: 'POST',
        body: { planCode, billingPeriod, currency: price.currency }
      });
      window.location.assign(result.checkoutUrl);
    } catch (error) {
      setApiNotice(error.message);
    }
  }

  React.useEffect(() => {
    const handler = (event) => navigate(event.detail);
    window.addEventListener('ofsocio:navigate', handler);
    return () => window.removeEventListener('ofsocio:navigate', handler);
  }, []);

  const staffAccess = capabilities.some((permission) => ['reports.read', 'kyc.read', 'audit.read', 'support.read', 'accounts.restrict'].includes(permission));
  const titles = { home: 'For you', friends: 'Circles', reels: 'Reels', messages: 'Messages', groups: 'Groups', business: 'Business', profile: 'Your profile', membership: 'Membership', kyc: 'Verification', approvals: 'Verification review', staff: 'Staff dashboard', support: 'AI Support', faq: 'Help & FAQ', security: 'Security Centre', privacy: 'Privacy Centre' };

  return <div className="ofsocio-app">
    <Sidebar view={view} setView={navigate} onSignOut={onExit} preview={preview} exitLabel={exitLabel} staffAccess={staffAccess} currentProfile={accountProfile}/>
    <div className="app-body"><header className="topbar"><button className="mobile-brand" onClick={() => navigate('home')} type="button">OFSOCIO</button><div className="global-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') navigate('friends'); }} placeholder="Search people" aria-label="Search people"/><kbd>↵</kbd></div><div className="top-actions"><button className="top-create" onClick={() => navigate('create')} type="button"><span>＋</span> Create</button><IconButton label="Notifications" className="notification-button">◌<i/></IconButton><button className="top-avatar" onClick={() => navigate('profile')} type="button"><Avatar image={currentProfileAvatar(accountProfile)} name={currentProfileName(accountProfile)}/></button></div></header>
      {!preview && apiNotice && <div className="backend-notice" role="status">Backend notice: {apiNotice}</div>}
      <div className="workspace"><main className="main-column" aria-label={titles[view]}>
        {view === 'home' && <HomeView remotePosts={remotePosts} feedLoading={feedLoading} feedError={feedError} onRetry={refreshFeed} onCreatePost={publishPost} onEditPost={updateFeedPost} onDeletePost={removeFeedPost} onReportPost={reportPostContent} onToggleLike={appreciatePost} onListComments={loadPostComments} onCreateComment={publishComment} onReplyCountChange={updateReplyCount} currentProfile={accountProfile} userId={userId}/>}
        {view === 'friends' && <CirclesView userId={userId} search={search} onSearchChange={setSearch}/>}
        {view === 'messages' && <MessagesView userId={userId}/>}
        {view === 'groups' && <GroupsView userId={userId}/>}
        {view === 'reels' && <ReelsView userId={userId}/>}
        {view === 'business' && <BusinessView userId={userId}/>}
        {view === 'membership' && <MembershipView catalog={membershipCatalog} profile={remoteProfile}/>}
        {view === 'kyc' && <KycView applications={kycApplications}/>}
        {view === 'approvals' && preview && <ApprovalView preview applications={[]}/>}
        {view === 'staff' && !preview && staffAccess && <StaffWorkspace userId={userId} capabilities={capabilities} section={staffSection || (capabilities.includes('reports.read') ? 'reports' : capabilities.includes('kyc.read') ? 'verification' : capabilities.includes('audit.read') ? 'audit' : 'support')} reports={staffReports} applications={approvalApplications} auditEvents={auditEvents} error={apiNotice} loading={staffLoading} onSection={(section) => { setStaffSection(section); setApiNotice(''); }} />}
        {view === 'support' && <SupportCenter userId={userId}/>}
        {view === 'faq' && <SupportCenter userId={userId} faqOnly/>}
        {view === 'profile' && <ProfileView profile={accountProfile} loading={profileLoading} error={profileError} onRetry={retryProfile} onSave={saveProfile} onUploadAvatar={(file) => uploadOwnAvatar(userId, file).then((updated) => { setAccountProfile(updated); return updated; })}/>}
        {view === 'security' && <CentreView/>}
        {view === 'privacy' && <CentreView privacy profile={accountProfile} onSavePrivacy={savePrivacy}/>}
        {view === 'create' && <HomeView remotePosts={remotePosts} feedLoading={feedLoading} feedError={feedError} onRetry={refreshFeed} onCreatePost={publishPost} onEditPost={updateFeedPost} onDeletePost={removeFeedPost} onReportPost={reportPostContent} onToggleLike={appreciatePost} onListComments={loadPostComments} onCreateComment={publishComment} onReplyCountChange={updateReplyCount} currentProfile={accountProfile} userId={userId} focusComposer/>}
      </main><RightRail currentProfile={accountProfile} userId={userId} onNavigate={navigate} onSearch={setSearch}/></div>
      <nav className="mobile-nav" aria-label="Primary navigation">{mobileItems.map(([id, icon, label]) => <button className={view === id ? 'active' : ''} key={id} type="button" onClick={() => navigate(id)}><span>{icon}</span>{label}</button>)}</nav>
      <button className="mobile-more" onClick={() => setMobileMenu(!mobileMenu)} type="button" aria-label="More sections">{mobileMenu ? '×' : '···'}</button>
      {mobileMenu && <div className="mobile-menu">{navigation.flatMap((group) => group.items).map(([id, icon, label]) => <button key={id} type="button" onClick={() => navigate(id)}><span>{icon}</span>{label}</button>)}{preview && <button type="button" onClick={() => navigate('approvals')}><span>⌑</span>Approval preview</button>}{!preview && staffAccess && <button type="button" onClick={() => navigate('staff')}><span>⌑</span>Staff dashboard</button>}</div>}
    </div>
  </div>;
}
