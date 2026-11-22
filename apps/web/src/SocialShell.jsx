import React, { useEffect, useRef, useState } from 'react';
import './social.css';
import { loadOwnProfile, saveOwnProfile, uploadOwnAvatar } from './lib/profileService';
import BusinessView from './components/BusinessView';
import GroupsView from './components/GroupsView';
import { createFeedPost, listFeedPosts, togglePostAppreciation } from './lib/feedService';

async function apiRequest() {
  throw new Error('Backend features are not connected in this UI preview.');
}

const navigation = [
  { section: 'YOUR SPACE', items: [['home', '⌂', 'For you'], ['friends', '◉', 'Circles'], ['reels', '▶', 'Reels'], ['messages', '✉', 'Messages']] },
  { section: 'COMMUNITIES', items: [['groups', '◫', 'Groups'], ['business', '◇', 'Business'] ] },
  { section: 'ACCOUNT', items: [['profile', '◍', 'Your profile'], ['membership', '✦', 'Membership'], ['kyc', '▧', 'Verification']] },
  { section: 'CARE', items: [['support', '?', 'AI Support'], ['faq', '≡', 'Help & FAQ'], ['security', '⌑', 'Security Centre'], ['privacy', '◈', 'Privacy Centre']] }
];

const people = [
  { name: 'Nia Adebayo', detail: 'Designer · Accra', image: 'photo-1524504388940-b1c1722653e1' },
  { name: 'Malik Bello', detail: 'Photographer · Lagos', image: 'photo-1500648767791-00dcc994a43e' },
  { name: 'Emeka Obi', detail: 'Building in public', image: 'photo-1506794778202-cad84cf45f1d' }
];

const initialMessages = [
  { name: 'Nia Adebayo', text: 'Sent you the studio photos ✨', time: '2m', image: 'photo-1524504388940-b1c1722653e1' },
  { name: 'Ofsocio Creators', text: 'Ada: Sunday photo walk?', time: '18m', image: 'photo-1517841905240-472988babdf9' },
  { name: 'Malik Bello', text: 'That light was unreal.', time: '1h', image: 'photo-1500648767791-00dcc994a43e' }
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

function HomeView({ remotePosts = [], feedLoading, feedError, onRetry, onCreatePost, onToggleLike, currentProfile, focusComposer = false }) {
  const [draft, setDraft] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [notice, setNotice] = useState('');
  const [noticeError, setNoticeError] = useState(false);
  const [liking, setLiking] = useState(null);
  const posts = remotePosts || [];

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

  return <>
    <div className="view-heading"><div><div className="eyebrow">YOUR OFSOCIO COMMUNITY</div><h1>The near &amp; now</h1><p>Posts from members, loaded from your account.</p></div><span className="live-mark"><i /> LIVE FEED</span></div>
    <div className="stories-strip"><div className="story create-story" aria-label="Stories are not connected yet"><span className="story-ring add-ring">＋</span><span>Stories soon</span></div></div>
    <section className="composer panel"><Avatar image={currentProfile?.avatar_display_url} name={currentProfileName(currentProfile)} /><div className="composer-main"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="What would you like to share?" aria-label="Write a post" maxLength={5000} autoFocus={focusComposer} /><div className="composer-actions"><div className="composer-tools"><button type="button" disabled title="Photo posts are not connected yet.">▧ <span>Photo</span></button><button type="button" disabled title="Stories are not connected yet.">◷ <span>Story</span></button><button type="button" disabled title="Posts are currently shared publicly.">◈ <span>Audience: Public</span></button></div><button className="button primary small-button" type="button" onClick={() => void publish()} disabled={!draft.trim() || publishing}>{publishing ? 'Sharing…' : 'Share'} <span>↗</span></button></div></div></section>
    {notice && <p className={noticeError ? 'profile-error' : 'profile-save-message'} role="status" aria-live="polite">{notice}</p>}
    <div className="feed-toolbar"><div><span className="eyebrow">YOUR FEED</span><h2>Published posts</h2></div><button type="button" className="quiet-button" disabled title="Feed sorting is not connected yet.">For you <span>⌄</span></button></div>
    {feedError && <div className="business-feedback error" role="alert">{feedError} <button className="text-link" type="button" onClick={() => void onRetry()}>Retry</button></div>}
    {feedLoading ? <div className="business-state panel" role="status">Loading your feed…</div>
      : posts.length ? <div className="feed-list">{posts.map((post) => {
        const authorName = post.author?.display_name || post.author?.username || 'Ofsocio member';
        return <article className="post panel" key={post.id}>
          <header className="post-header"><Avatar image={post.author?.avatar_url} name={authorName} /><div className="post-by"><strong>{authorName}</strong><span>{post.created_at ? new Date(post.created_at).toLocaleString() : 'Recently'} · {post.visibility}</span></div><button className="more-button" type="button" aria-label="Post options" disabled title="Post options are not connected yet.">•••</button></header>
          <p className="post-copy">{post.body}</p>{post.media_urls?.filter((url) => /^https?:\/\//i.test(url)).map((url) => <div className="post-image" key={url}><img src={url} alt="Post attachment" /></div>)}
          <div className="post-reactions"><span className="reaction-stack"><i>♥</i></span><span>{post.appreciation_count || 0} appreciations</span><span className="reply-count">{post.reply_count || 0} replies</span></div>
          <div className="post-actions"><button type="button" className={post.appreciated_by_me ? 'is-liked' : ''} onClick={() => void appreciate(post.id)} disabled={liking === post.id}><span>♡</span>{liking === post.id ? 'Saving…' : 'Appreciate'}</button><button type="button" disabled title="Replies are not connected yet."><span>◯</span> Reply</button><button type="button" disabled title="Sharing is not connected yet."><span>↗</span> Share</button><button type="button" className="save-action" disabled title="Saved posts are not connected yet."><span>◇</span> Save</button></div>
        </article>;
      })}</div> : <div className="business-state panel">No published posts are available yet. Your posts will appear here after you share them.</div>}
  </>;
}

function FriendsView() {
  return <><div className="view-heading"><div><div className="eyebrow">YOUR PEOPLE, YOUR PACE</div><h1>Circles</h1><p>People search and follow requests are not connected yet.</p></div><button className="button primary" type="button" disabled title="People search is not connected yet.">Find people <span>⌕</span></button></div><div className="business-state panel">No sample members are shown. People discovery will appear here when its backend flow is connected.</div></>;
}

function MessagesView() {
  return <><div className="view-heading"><div><div className="eyebrow">PRIVATE BY DESIGN</div><h1>Messages</h1><p>Messaging is not connected to the backend yet.</p></div><IconButton label="New message">＋</IconButton></div><div className="business-state panel">Your inbox will show real conversations when messaging is connected. No sample messages are displayed.</div></>;
}

function ReelsView() {
  return <><div className="view-heading"><div><div className="eyebrow">SHORT STORIES, FULL FEELING</div><h1>Reels</h1><p>Reels are not connected to the backend yet.</p></div><button className="button outline" type="button" disabled title="Reel filters are not connected yet.">Following <span>⌄</span></button></div><div className="business-state panel">Published reels will appear here when the reels feature is connected.</div></>;
}


function MembershipView({ catalog, profile, onCheckout }) {
  const [selected, setSelected] = useState('Ofsocio Free');
  const [billingPeriod, setBillingPeriod] = useState('monthly');
  const countryCode = profile?.country_code?.trim();
  const plans = [
    { code: 'free', name: 'Ofsocio Free', stage: 'STAGE 01 · PERSONAL', color: 'free', features: ['Your profile, feed and circles', 'Groups, discovery and messaging', 'Privacy and safety controls'] },
    { code: 'premium', name: 'Ofsocio Premium', stage: 'STAGE 02 · CREATOR', color: 'premium', features: ['Premium profile and creator tools', 'Enhanced content insights', 'Identity verification required'] },
    { code: 'business_pro', name: 'Ofsocio Business / Pro', stage: 'STAGE 03 · BUSINESS', color: 'pro', features: ['Verified business profile', 'Products, services and insights', 'Business verification required'] }
  ];
  return <><div className="view-heading"><div><div className="eyebrow">THREE WAYS TO GROW WITH OFSOCIO</div><h1>Membership</h1><p>Sample plans only. Membership and checkout are not connected in this UI preview.</p></div></div><div className="segmented billing-period">{['monthly', 'annual'].map((period) => <button className={billingPeriod === period ? 'active' : ''} onClick={() => setBillingPeriod(period)} key={period} type="button">{period === 'monthly' ? 'Monthly' : 'Annual'}</button>)}</div><div className="membership-grid">{plans.map((plan) => {
    const configuredPlan = catalog?.plans?.find((item) => item.code === plan.code);
    const price = catalog?.prices?.find((item) => item.plan_code === plan.code && item.country_code === countryCode && item.billing_period === billingPeriod && (!profile?.preferred_currency || item.currency === profile.preferred_currency));
    const priceLabel = plan.code === 'free' ? 'Always free' : price ? `${price.currency} ${Number(price.amount).toLocaleString()} / ${billingPeriod}` : 'Regional pricing';
    return <article className={`plan-card panel ${selected === plan.name ? 'selected' : ''}`} key={plan.code}><div className={`plan-symbol ${plan.color}`}>{plan.color === 'free' ? '○' : plan.color === 'premium' ? '✦' : '◇'}</div><span className="eyebrow">{configuredPlan ? `STAGE 0${configuredPlan.stage} · ${plan.stage.split('·')[1].trim().split(' ')[0]}` : plan.stage}</span><h2>{configuredPlan?.display_name || plan.name}</h2><p className="plan-price">{priceLabel}</p><ul>{plan.features.map((feature) => <li key={feature}><span>✓</span>{feature}</li>)}</ul><button className={`button ${plan.color === 'free' ? 'outline' : 'primary'} full-button`} type="button" disabled title="Membership actions are not connected yet.">{plan.color === 'free' ? 'Current stage' : onCheckout ? price ? 'Continue to checkout' : 'Pricing unavailable' : selected === plan.name ? 'Selected for review' : 'Explore this stage'}</button></article>;
  })}</div><div className="notice panel"><span>ⓘ</span><p>Payment integration is not connected. No checkout will start from this preview.</p></div></>;
}

function KycView({ applications = [], onSubmitApplication }) {
  const getStatus = (type) => applications.find((item) => item.application_type === type)?.status || 'not_started';
  const submit = (type) => onSubmitApplication?.(type);
  const individualStatus = getStatus('individual');
  const businessStatus = getStatus('business');
  const statusLabel = (status) => status === 'not_started' ? 'Not started' : status.replaceAll('_', ' ');
  return <><div className="view-heading"><div><div className="eyebrow">IDENTITY, HANDLED WITH CARE</div><h1>Verification</h1><p>Only required for selected services. Your documents are never collected in this preview.</p></div></div><div className="verification-layout"><section className="verification-card panel"><div className="verification-icon">▧</div><span className="eyebrow">INDIVIDUAL VERIFICATION</span><h2>Verify your identity</h2><p>Securely confirm your identity to access eligible Premium features. A vetted provider handles document checks in production.</p><div className="status-line"><span>Status</span><strong className={`status-pill ${individualStatus === 'not_started' ? '' : 'pending'}`}>{statusLabel(individualStatus)}</strong></div><button className="button primary full-button" onClick={() => submit('individual')} disabled={!onSubmitApplication || individualStatus === 'submitted' || individualStatus === 'in_review'} title={!onSubmitApplication ? 'Verification is not connected yet.' : undefined}>{individualStatus === 'not_started' ? 'Start secure verification' : 'Application submitted'}</button><small>Provider, retention and regional availability are confirmed before launch.</small></section><section className="verification-card panel"><div className="verification-icon business-icon">◇</div><span className="eyebrow">BUSINESS VERIFICATION</span><h2>Verify an organisation</h2><p>Confirm your organisation and authorised representative before activating Business / Pro tools.</p><div className="status-line"><span>Status</span><strong className={`status-pill ${businessStatus === 'not_started' ? '' : 'pending'}`}>{statusLabel(businessStatus)}</strong></div><button className="button outline full-button" onClick={() => submit('business')} disabled={!onSubmitApplication || businessStatus === 'submitted' || businessStatus === 'in_review'} title={!onSubmitApplication ? 'Verification is not connected yet.' : undefined}>Prepare business verification</button></section></div><div className="privacy-callout"><span>◈</span><p><strong>Minimal by design.</strong> Ofsocio stores the verification outcome and provider reference where possible, not raw identity documents.</p></div></>;
}

function ApprovalView({ preview, applications = [], onReview }) {
  const [demoItems, setDemoItems] = useState([
    { name: 'Abeni Objects', type: 'Business / Pro', detail: 'Business verification complete · 2 days ago', image: 'photo-1490312278390-ab64016e0aa9' },
    { name: 'Kofi Mensah', type: 'Premium', detail: 'Individual verification complete · 4 hours ago', image: 'photo-1506794778202-cad84cf45f1d' }
  ]);
  const items = preview ? demoItems : applications.map((application) => ({
    id: application.id,
    name: `${application.application_type === 'business' ? 'Business' : 'Individual'} · ${application.applicant_id.slice(0, 8)}`,
    type: application.application_type === 'business' ? 'Business verification' : 'Individual verification',
    detail: `${application.status.replaceAll('_', ' ')} · ${new Date(application.submitted_at).toLocaleString()}`,
    image: 'photo-1500648767791-00dcc994a43e'
  }));
  function decide(item, decision, reasonCategory = null) {
    if (preview) setDemoItems((current) => current.filter((entry) => entry.name !== item.name));
    else onReview?.(item.id, decision, reasonCategory);
  }
  return <><div className="view-heading"><div><div className="eyebrow">{preview ? 'LOCAL PREVIEW · SAMPLE QUEUE' : 'RESTRICTED STAFF WORKSPACE'}</div><h1>Approval desk</h1><p>{preview ? 'Sample decisions only. Nothing is sent to Ofsocio.' : 'Decisions are permission-checked and audited by the server.'}</p></div><span className="queue-count">{items.length} in review</span></div><div className="approval-layout"><section className="approval-queue panel"><div className="section-title"><div><span className="eyebrow">VERIFICATION QUEUE</span><h2>Needs a decision</h2></div><button className="quiet-button">All requests⌄</button></div>{items.length ? items.map((item) => <article className="approval-item" key={item.id || item.name}><Avatar image={item.image} name={item.name}/><div className="approval-info"><strong>{item.name}</strong><span>{item.type}</span><small>{item.detail}</small></div><div className="approval-buttons"><button type="button" className="button outline small-button" onClick={() => decide(item, 'needs_more_information', 'additional_information')}>Request info</button><button type="button" className="button outline small-button" onClick={() => decide(item, 'rejected', 'verification_failed')}>Reject</button><button type="button" className="button primary small-button" onClick={() => decide(item, 'verified')}>Approve</button></div></article>) : <div className="empty-state">The review queue is clear.</div>}</section><aside className="audit-card panel"><span className="eyebrow">AUDIT FIRST</span><h2>Every decision leaves a trail.</h2><p>Production decisions require a separate reviewer, a reason category, timestamp and audit record.</p><div className="audit-stat"><strong>{String(items.length).padStart(2, '0')}</strong><span>pending reviews</span></div><div className="audit-stat"><strong>API</strong><span>permission checked</span></div></aside></div></>;
}

function SupportView({ faqOnly = false }) {
  const faqs = [
    ['How do I make my profile private?', 'Privacy controls are not connected yet. Check this page again after account privacy settings are implemented.'],
    ['How does identity verification work?', 'Verification is not connected yet. Ofsocio will explain the verified provider and data handling before enabling submissions.'],
    ['How do I report a suspicious account?', 'Reporting tools are not connected yet. Please do not treat this prototype as a reporting channel.']
  ];
  return <><div className="view-heading"><div><div className="eyebrow">{faqOnly ? 'ANSWERS, WITHOUT THE RUNAROUND' : 'HERE WHEN YOU NEED A HAND'}</div><h1>{faqOnly ? 'Help & FAQ' : 'AI Support'}</h1><p>{faqOnly ? 'Help information currently available in Ofsocio.' : 'AI and human support are not connected yet.'}</p></div></div><section className="support-main panel">{faqOnly ? <div className="faq-list">{faqs.map(([question, answer], index) => <details key={question}><summary><span>0{index + 1}</span>{question}<b>＋</b></summary><p>{answer}</p></details>)}</div> : <div className="business-state">Support requests are not sent anywhere yet. For urgent issues, use the contact channel provided by the Ofsocio team.</div>}</section></>;
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
    setDraft((current) => ({ ...current, [event.target.name]: event.target.value }));
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
      : <input name={name} value={draft?.[name] || ''} onChange={updateField} maxLength={options.maxLength} required={options.required} pattern={options.pattern} title={options.title} autoComplete={options.autoComplete || 'off'} />}
  </label>;

  return <><div className="profile-cover"><div className="cover-lines"/><button className="profile-edit" type="button" onClick={() => { setMessage(''); setMessageError(false); setEditing((value) => !value); }} disabled={loading || !profile}>{editing ? 'Cancel editing' : 'Edit profile ↗'}</button></div>
    <section className="profile-summary panel"><div className="profile-avatar-control"><Avatar image={avatar} name={displayName} size="profile"/><label className="profile-photo-upload">{photoUploading ? 'Uploading…' : 'Change photo'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={changePhoto} disabled={loading || photoUploading || !profile} aria-label="Upload a profile photo"/></label></div><div className="profile-details"><div className="profile-name-row"><div><h1>{displayName}</h1><span>{profile?.username ? `@${profile.username}` : 'Choose a username'}{profile?.country_code ? ` · ${profile.country_code.trim()}` : ''}</span></div><span className="profile-schema-note">Profile privacy settings are not connected</span></div><p>{profile?.bio || 'Add a short introduction to tell your circles about yourself.'}</p><div className="profile-stats"><span>{loading ? 'Loading profile…' : 'Profile details are synced to your account'}</span></div></div></section>
    {editing && draft && <form className="profile-editor panel" onSubmit={submit}>
      <div className="profile-editor-heading"><div><span className="eyebrow">YOUR ACCOUNT DETAILS</span><h2>Edit profile</h2><p>Changes save to your Ofsocio profile.</p></div></div>
      <div className="profile-editor-grid">{field('Display name', 'display_name', { maxLength: 80, required: true })}{field('Username', 'username', { maxLength: 30, required: true, pattern: '[A-Za-z0-9_.]{3,30}', title: 'Use 3–30 letters, numbers, periods, or underscores.' })}{field('Country code', 'country_code', { maxLength: 2, pattern: '[A-Za-z]{2}', title: 'Enter a two-letter country code.' })}{field('Preferred language', 'preferred_language', { maxLength: 10 })}{field('Preferred currency', 'preferred_currency', { maxLength: 3, pattern: '[A-Za-z]{3}', title: 'Enter a three-letter currency code.' })}{field('Timezone', 'timezone', { maxLength: 64 })}{field('Bio', 'bio', { multiline: true, maxLength: 280 })}</div>
      <div className="profile-editor-footer"><span className={messageError ? "profile-error" : "profile-save-message"} role="status" aria-live="polite">{message}</span><button className="button primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button></div>
    </form>}
    {error && <p className="profile-error" role="alert">{error} <button className="text-link" type="button" onClick={onRetry}>Retry</button></p>}
    {message && !editing && <p className={messageError ? 'profile-error' : 'profile-save-message'} role="status" aria-live="polite">{message}</p>}

    <div className="profile-tabs">{['Posts', 'Stories', 'About', 'Friends'].map((item) => <button type="button" className={tab === item ? 'active' : ''} onClick={() => setTab(item)} key={item} disabled={item !== 'About'} title={item !== 'About' ? `${item} are not connected yet.` : undefined}>{item}</button>)}</div><div className="profile-content panel"><span className="eyebrow">{tab.toUpperCase()}</span><h2>Your profile details</h2><p>Your editable profile details are shown above. Posts, stories, and circle activity are not connected yet.</p></div></>;
}
function CentreView({ privacy = false, isPrivate, setIsPrivate }) {
  const [settings, setSettings] = useState({ twoFactor: true, loginAlerts: true, messageRequests: false, activityStatus: false, personalizedDiscovery: true });
  const groups = privacy ? [
    { title: 'Account visibility', detail: isPrivate ? 'Only approved followers can view protected posts.' : 'Anyone can discover your public posts.', key: 'privateAccount' },
    { title: 'Message requests', detail: 'Let people outside your circles contact you.', key: 'messageRequests', value: 'People you follow' },
    { title: 'Personalized discovery', detail: 'Use your activity to improve suggestions.', key: 'personalizedDiscovery', value: 'On' },
    { title: 'Your data', detail: 'Request a copy or manage account deletion.', key: 'data', value: 'Manage' }
  ] : [
    { title: 'Two-step verification', detail: 'Add another check when you sign in.', key: 'twoFactor', value: 'Authenticator app' },
    { title: 'Login alerts', detail: 'Get notified about unfamiliar sign-ins.', key: 'loginAlerts', value: 'Email and in-app' },
    { title: 'Active sessions', detail: 'Review devices signed in to your account.', key: 'sessions', value: '2 devices' },
    { title: 'Connected apps', detail: 'Review services with account access.', key: 'apps', value: 'Manage' }
  ];
  return <><div className="view-heading"><div><div className="eyebrow">{privacy ? 'YOUR DATA, YOUR DECISIONS' : 'A QUIETER KIND OF CONFIDENCE'}</div><h1>{privacy ? 'Privacy Centre' : 'Security Centre'}</h1><p>{privacy ? 'Understand and shape how Ofsocio uses your information.' : 'A clear view of your account protection and recent activity.'}</p></div></div><div className="centre-layout"><section className="settings-list panel">{groups.map((item) => <div className="setting-row" key={item.key}><div className="setting-icon">{privacy ? '◈' : '⌑'}</div><div className="setting-description"><strong>{item.title}</strong><span>{item.detail}</span></div>{item.key === 'data' || item.key === 'sessions' || item.key === 'apps' ? <button className="text-link" type="button" disabled title={`${item.title} is not connected yet.`}>{item.value} ↗</button> : item.key === 'privateAccount' ? <button className={`switch ${isPrivate ? 'enabled' : ''}`} role="switch" aria-checked={isPrivate} aria-label={item.title} onClick={() => setIsPrivate?.(!isPrivate)} disabled={!setIsPrivate} title="Account privacy settings are not connected yet."><i /></button> : <button className={`switch ${settings[item.key] ? 'enabled' : ''}`} role="switch" aria-checked={settings[item.key]} aria-label={item.title} onClick={() => setSettings({ ...settings, [item.key]: !settings[item.key] })} disabled title="This security setting is not connected yet."><i /></button>}</div>)}</section><aside className="security-card panel"><div className="security-emblem">{privacy ? '◈' : '✦'}</div><span className="eyebrow">{privacy ? 'PRIVACY SNAPSHOT' : 'ACCOUNT HEALTH'}</span><h2>{privacy ? 'You’re in control.' : 'Your account is in good shape.'}</h2><p>{privacy ? 'Review visibility and data choices at any time. Changes should be clear, reversible and respected.' : 'Security settings are a visual preview and are not connected or enforced.'}</p><button className="text-link" type="button" disabled title="This link is not available yet.">{privacy ? 'Read privacy notice' : 'Review recent activity'} ↗</button></aside></div><p className="disclaimer">Controls shown here are prototype interactions. Production settings must be enforced by authenticated server policies.</p></>;
}

function Sidebar({ view, setView, onSignOut, preview, exitLabel, staffAccess, currentProfile }) {
  return <aside className="desktop-sidebar"><a className="wordmark" href="#home" onClick={(event) => { event.preventDefault(); setView('home'); }}>OFSOCIO<small>social</small></a><button className="account-chip" type="button" onClick={() => setView('profile')}><Avatar image={currentProfileAvatar(currentProfile)} name={currentProfileName(currentProfile)}/><span><strong>{currentProfileName(currentProfile)}</strong><small>{preview ? 'Local preview' : 'Your account'}</small></span><b>⌄</b></button><div className="side-nav">{navigation.map((group) => <div className="nav-group" key={group.section}><div className="nav-caption">{group.section}</div>{group.items.map(([id, icon, label]) => <button className={`side-link ${view === id ? 'active' : ''}`} type="button" key={id} onClick={() => setView(id)}><span className="side-icon">{icon}</span>{label}{id === 'messages' && <i className="unread-dot"/>}</button>)}</div>)}{(preview || staffAccess) && <div className="nav-group"><div className="nav-caption">{preview ? 'STAFF PREVIEW' : 'STAFF WORKSPACE'}</div><button className={`side-link ${view === 'approvals' ? 'active' : ''}`} type="button" onClick={() => setView('approvals')}><span className="side-icon">⌑</span>Approval desk{preview && <span className="staff-badge">DEMO</span>}</button></div>}</div><div className="sidebar-bottom"><button className="side-link" onClick={() => setView('privacy')} type="button"><span className="side-icon">◈</span>Privacy settings</button><button className="side-link" onClick={onSignOut} type="button"><span className="side-icon">↗</span>{exitLabel || (preview ? 'Exit preview' : 'Sign out')}</button></div></aside>;
}

function RightRail({ currentProfile }) {
  return <aside className="right-rail"><div className="rail-block profile-nudge"><div className="rail-heading"><span className="eyebrow">YOUR SPACE</span><button type="button" className="text-link" onClick={() => window.dispatchEvent(new CustomEvent('ofsocio:navigate', { detail: 'profile' }))}>Edit</button></div><div className="mini-profile"><Avatar image={currentProfileAvatar(currentProfile)} name={currentProfileName(currentProfile)} size="large"/><div><strong>{currentProfileName(currentProfile)}</strong><span>{currentProfile?.country_code?.trim() || 'Your profile'}</span></div></div><div className="profile-progress"><div><span>Profile</span><strong>Saved</strong></div><div className="progress-track"><i/></div><small>Your profile details are stored in your account.</small></div></div><div className="rail-block"><div className="rail-heading"><div><span className="eyebrow">GOOD PEOPLE</span><h3>Suggested for you</h3></div></div><div className="business-state">Member suggestions are not connected yet.</div></div><footer className="rail-footer">About · Community · Privacy · Terms<br/>© 2026 Ofsocio Social</footer></aside>;
}

export default function SocialShell({ preview, onExit, accessToken, exitLabel, userId }) {
  const [view, setView] = useState('home');
  const [isPrivate, setIsPrivate] = useState(false);
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

  async function appreciatePost(postId) {
    const appreciated = await togglePostAppreciation(userId, postId);
    setRemotePosts((current) => current.map((post) => post.id === postId ? {
      ...post,
      appreciated_by_me: appreciated,
      appreciation_count: Math.max(0, (post.appreciation_count || 0) + (appreciated ? 1 : -1))
    } : post));
  }


  useEffect(() => {
    if (preview || !accessToken || view !== 'approvals' || !capabilities.includes('kyc.read')) return undefined;
    let active = true;
    apiRequest('/api/admin/kyc', accessToken)
      .then((result) => { if (active) setApprovalApplications(result.applications || []); })
      .catch((error) => { if (active) setApiNotice(error.message); });
    return () => { active = false; };
  }, [accessToken, capabilities, preview, view]);

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

  async function reviewKyc(applicationId, decision, reasonCategory) {
    try {
      await apiRequest(`/api/admin/kyc/${applicationId}/review`, accessToken, {
        method: 'POST',
        body: { decision, reasonCategory }
      });
      setApprovalApplications((current) => current.filter((application) => application.id !== applicationId));
      setApiNotice('KYC decision recorded and audited.');
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

  const titles = { home: 'For you', friends: 'Circles', reels: 'Reels', messages: 'Messages', groups: 'Groups', business: 'Business', profile: 'Your profile', membership: 'Membership', kyc: 'Verification', approvals: 'Approval desk', support: 'AI Support', faq: 'Help & FAQ', security: 'Security Centre', privacy: 'Privacy Centre' };

  return <div className="ofsocio-app">
    <Sidebar view={view} setView={navigate} onSignOut={onExit} preview={preview} exitLabel={exitLabel} staffAccess={capabilities.includes('kyc.read')} currentProfile={accountProfile}/>
    <div className="app-body"><header className="topbar"><button className="mobile-brand" onClick={() => navigate('home')} type="button">OFSOCIO</button><div className="global-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search people, circles and ideas" aria-label="Search Ofsocio" disabled title="People search is not connected yet."/><kbd>⌘ K</kbd></div><div className="top-actions"><button className="top-create" onClick={() => navigate('create')} type="button"><span>＋</span> Create</button><IconButton label="Notifications" className="notification-button">◌<i/></IconButton><button className="top-avatar" onClick={() => navigate('profile')} type="button"><Avatar image={currentProfileAvatar(accountProfile)} name={currentProfileName(accountProfile)}/></button></div></header>
      {!preview && apiNotice && <div className="backend-notice" role="status">Backend notice: {apiNotice}</div>}
      <div className="workspace"><main className="main-column" aria-label={titles[view]}>
        {view === 'home' && <HomeView remotePosts={remotePosts} feedLoading={feedLoading} feedError={feedError} onRetry={refreshFeed} onCreatePost={publishPost} onToggleLike={appreciatePost} currentProfile={accountProfile}/>}
        {view === 'friends' && <FriendsView/>}
        {view === 'messages' && <MessagesView/>}
        {view === 'groups' && <GroupsView userId={userId}/>}
        {view === 'reels' && <ReelsView/>}
        {view === 'business' && <BusinessView userId={userId}/>}
        {view === 'membership' && <MembershipView catalog={membershipCatalog} profile={remoteProfile}/>}
        {view === 'kyc' && <KycView applications={kycApplications}/>}
        {view === 'approvals' && (preview || capabilities.includes('kyc.read')) && <ApprovalView preview={preview} applications={approvalApplications} onReview={reviewKyc}/>}
        {view === 'support' && <SupportView/>}
        {view === 'faq' && <SupportView faqOnly/>}
        {view === 'profile' && <ProfileView profile={accountProfile} loading={profileLoading} error={profileError} onRetry={retryProfile} onSave={saveProfile} onUploadAvatar={(file) => uploadOwnAvatar(userId, file).then((updated) => { setAccountProfile(updated); return updated; })}/>}
        {view === 'security' && <CentreView/>}
        {view === 'privacy' && <CentreView privacy isPrivate={isPrivate}/>}
        {view === 'create' && <HomeView remotePosts={remotePosts} feedLoading={feedLoading} feedError={feedError} onRetry={refreshFeed} onCreatePost={publishPost} onToggleLike={appreciatePost} currentProfile={accountProfile} focusComposer/>}
      </main><RightRail currentProfile={accountProfile}/></div>
      <nav className="mobile-nav" aria-label="Primary navigation">{mobileItems.map(([id, icon, label]) => <button className={view === id ? 'active' : ''} key={id} type="button" onClick={() => navigate(id)}><span>{icon}</span>{label}</button>)}</nav>
      <button className="mobile-more" onClick={() => setMobileMenu(!mobileMenu)} type="button" aria-label="More sections">{mobileMenu ? '×' : '···'}</button>
      {mobileMenu && <div className="mobile-menu">{navigation.flatMap((group) => group.items).map(([id, icon, label]) => <button key={id} type="button" onClick={() => navigate(id)}><span>{icon}</span>{label}</button>)}{(preview || capabilities.includes('kyc.read')) && <button type="button" onClick={() => navigate('approvals')}><span>⌑</span>Approval desk</button>}</div>}
    </div>
  </div>;
}
