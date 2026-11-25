import React, { useEffect, useState } from 'react';
import LiveProfileView from './LiveProfileView';
import CreatePostView from './CreatePostView';
import SupportDesk from './SupportDesk';
import LiveCirclesView from './LiveCirclesView';
import { LiveMessagesView, LiveGroupsView, LiveBusinessView } from './LiveSocialFeatures';
import './social.css';

const navigation = [
  { section: 'YOUR SPACE', items: [['home', '⌂', 'For you'], ['friends', '◉', 'Circles'], ['reels', '▶', 'Reels'], ['messages', '✉', 'Messages']] },
  { section: 'COMMUNITIES', items: [['groups', '◫', 'Groups'], ['business', '◇', 'Business'] ] },
  { section: 'ACCOUNT', items: [['profile', '◍', 'Your profile'], ['membership', '✦', 'Membership'], ['kyc', '▧', 'Verification']] },
  { section: 'CARE', items: [['support', '?', 'Customer Service'], ['faq', '≡', 'Help & FAQ'], ['security', '⌑', 'Security Centre'], ['privacy', '◈', 'Privacy Centre']] }
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

function Avatar({ image, name, size = 'normal' }) {
  const source = image?.startsWith('https://') ? image : imageUrl(image);
  return <img className={`avatar ${size}`} src={source} alt={name} />;
}

function IconButton({ children, label, className = '' }) {
  return <button className={`icon-button ${className}`} type="button" aria-label={label} title={label}>{children}</button>;
}

function HomeView({ liked, setLiked, following, toggleFollowing, remotePosts = null, remoteStories = [], onCreatePost, onToggleLike, userAvatar, userName, supabase, currentUser, onCommentAdded }) {
  const [draft, setDraft] = useState('');
  const [storyViewer, setStoryViewer] = useState(null);
  const [commentPost, setCommentPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentBusy, setCommentBusy] = useState(false);
  const [reportPost, setReportPost] = useState(null);
  const [reportReason, setReportReason] = useState('spam');
  const [reportDescription, setReportDescription] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  const [mediaFile, setMediaFile] = useState(null);

  function publish() {
    if (!draft.trim() && !mediaFile) return;
    if (onCreatePost) {
      const content = draft.trim();
      setDraft('');
      onCreatePost(content, mediaFile);
      setMediaFile(null);
      return;
    }
    window.dispatchEvent(new CustomEvent('ofsocio:notice',{detail:'Publishing is unavailable until you sign in to a connected Ofsocio account.'}));
  }

  async function openComments(post) {
    if (!supabase || !currentUser?.id) return;
    setCommentPost(post); setComments([]);
    try {
      const { data, error } = await supabase.from('comments').select('id,post_id,author_id,body,created_at').eq('post_id',post.id).order('created_at',{ascending:true}).limit(100);
      if(error)throw error;
      const ids=[...new Set((data||[]).map(row=>row.author_id))];let profiles=[];
      if(ids.length){const result=await supabase.from('profiles').select('id,display_name,username').in('id',ids);if(result.error)throw result.error;profiles=result.data||[];}
      const map=new Map(profiles.map(profile=>[profile.id,profile]));setComments((data||[]).map(row=>({...row,author:map.get(row.author_id)||{}})));
    }catch(error){window.dispatchEvent(new CustomEvent('ofsocio:notice',{detail:error.message}));}
  }

  async function submitComment(event) {
    event.preventDefault(); if(!commentPost||!commentDraft.trim())return;
    setCommentBusy(true);
    try{
      const {data,error}=await supabase.from('comments').insert({post_id:commentPost.id,author_id:currentUser.id,body:commentDraft.trim()}).select('id,post_id,author_id,body,created_at').single();
      if(error)throw error;
      setComments(rows=>[...rows,{...data,author:{display_name:userName||currentUser.email?.split('@')[0]||'You'}}]);setCommentDraft('');onCommentAdded?.(commentPost.id);
    }catch(error){window.dispatchEvent(new CustomEvent('ofsocio:notice',{detail:error.message}));}
    finally{setCommentBusy(false);}
  }

  async function submitReport(event) {
    event.preventDefault(); if(!reportPost||!supabase||!currentUser?.id)return;
    setReportBusy(true);
    try{
      const {error}=await supabase.from('content_reports').insert({reporter_id:currentUser.id,target_type:'post',target_id:reportPost.id,reason:reportReason,description:reportDescription.trim(),status:'open'});
      if(error)throw error;
      setReportPost(null);setReportDescription('');window.dispatchEvent(new CustomEvent('ofsocio:notice',{detail:'Report submitted to the Ofsocio safety team.'}));
    }catch(error){window.dispatchEvent(new CustomEvent('ofsocio:notice',{detail:error.message}));}
    finally{setReportBusy(false);}
  }

  async function sharePost(post) {
    const url=`${window.location.origin}/?post=${post.id}`;
    try{if(navigator.share)await navigator.share({title:'Ofsocio post',url});else{await navigator.clipboard.writeText(url);window.dispatchEvent(new CustomEvent('ofsocio:notice',{detail:'Post link copied.'}));}}
    catch(error){if(error?.name!=='AbortError')window.dispatchEvent(new CustomEvent('ofsocio:notice',{detail:error.message||'Could not share this post.'}));}
  }

  const visiblePosts = remotePosts === null ? [] : remotePosts.map((post) => ({
    id: post.id,
    createdAt: post.created_at || post.createdAt,
    name: post.author?.display_name || post.author?.username || 'Ofsocio member',
    location: post.createdAt ? new Date(post.createdAt).toLocaleString() : 'Recently',
    image: post.author?.avatar_url || 'photo-1534528741775-53994a69daeb',
    text: post.body || '',
    photo: 'photo-1473116763249-2faaef81ccda',
    photoUrl: post.mediaUrls?.[0] || null,
    caption: post.mediaUrls?.length ? 'Shared with your circle' : '',
    likes: String(post.likeCount ?? 0),
    replies: String(post.replyCount ?? 0)
  }));

  return <>
    <div className="view-heading"><div><div className="eyebrow">{new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'}).toUpperCase()}</div><h1>The near &amp; now</h1><p>Your people, in their own words.</p></div><span className="live-mark"><i /> YOUR CIRCLE</span></div>
    <div className="stories-strip"><button className="story create-story" type="button" onClick={()=>window.dispatchEvent(new CustomEvent('ofsocio:navigate',{detail:'profile'}))}><span className="story-ring add-ring">＋</span><span>Your story</span></button>{remoteStories.map(story=><button className="story" key={story.id} type="button" onClick={()=>setStoryViewer(story)}><span className="story-ring tone-0"><Avatar image={story.author?.avatar_url||'photo-1534528741775-53994a69daeb'} name={story.author?.display_name||story.author?.username||'Member'}/></span><span>{(story.author?.display_name||story.author?.username||'Member').split(' ')[0]}</span></button>)}</div>
    <section className="composer panel"><Avatar image={userAvatar || 'photo-1534528741775-53994a69daeb'} name={userName || 'You'} /><div className="composer-main"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="What would you like to share?" aria-label="Write a post" /><div className="composer-actions"><div className="composer-tools"><label className="composer-file-button">▧ <span>Photo/video</span><input type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm" hidden onChange={event=>setMediaFile(event.target.files?.[0]||null)}/></label><button type="button" onClick={()=>window.dispatchEvent(new CustomEvent('ofsocio:navigate',{detail:'profile'}))}>◷ <span>Story</span></button><button type="button">◈ <span>Audience: Public</span></button></div><button className="button primary small-button" type="button" onClick={publish} disabled={!draft.trim()&&!mediaFile}>Share <span>↗</span></button></div></div></section>
    <div className="feed-toolbar"><div><span className="eyebrow">YOUR FEED</span><h2>From your circles</h2></div><button type="button" className="quiet-button">For you <span>⌄</span></button></div>
    <div className="feed-list">{visiblePosts.map((post) => <article className="post panel" key={post.id}>
      <header className="post-header"><Avatar image={post.image} name={post.name} /><div className="post-by"><strong>{post.name} <span className="verified">✦</span></strong><span>{post.location}</span></div><button className="more-button" type="button" aria-label="Report post" title="Report post" onClick={()=>setReportPost(post)}>•••</button></header>
      <p className="post-copy">{post.text}</p>{(post.photoUrl || post.caption) && <div className="post-image"><img src={post.photoUrl || imageUrl(post.photo, 900, 600)} alt={post.caption} />{post.caption && <span className="image-caption">{post.caption}</span>}</div>}
      <div className="post-reactions"><span className="reaction-stack"><i>♥</i><i>✦</i></span><span>{post.likes} appreciations</span><span className="reply-count">{post.replies} replies</span></div>
      <div className="post-actions"><button type="button" className={liked.includes(post.id) ? 'is-liked' : ''} onClick={() => onToggleLike ? onToggleLike(post.id, liked.includes(post.id)) : setLiked((current) => current.includes(post.id) ? current.filter((id) => id !== post.id) : [...current, post.id])}><span>♡</span> Appreciate</button><button type="button" onClick={()=>openComments(remotePosts?.find(item=>item.id===post.id)||post)}><span>◯</span> Reply</button><button type="button" onClick={()=>sharePost(post)}><span>↗</span> Share</button></div>
    </article>)}</div>
    <aside className="mobile-suggestions panel"><div className="section-title"><div><span className="eyebrow">DISCOVER</span><h2>Find your next circle</h2></div><button className="text-link" type="button" onClick={()=>window.dispatchEvent(new CustomEvent('ofsocio:navigate',{detail:'friends'}))}>Search members ↗</button></div></aside>
    {reportPost&&<div className="comments-overlay" role="dialog" aria-modal="true"><section className="comments-modal panel report-modal"><header><h2>Report this post</h2><button type="button" onClick={()=>setReportPost(null)} aria-label="Close report">×</button></header><p className="support-note">Reports are reviewed by authorized Ofsocio staff. Please report content that violates community rules.</p><form onSubmit={submitReport}><label>Reason<select value={reportReason} onChange={e=>setReportReason(e.target.value)}><option value="spam">Spam or misleading</option><option value="harassment">Harassment or bullying</option><option value="hate">Hate or abusive content</option><option value="scam">Scam or fraud</option><option value="unsafe">Unsafe content</option><option value="other">Other</option></select></label><textarea value={reportDescription} onChange={e=>setReportDescription(e.target.value)} placeholder="Additional details (optional)" maxLength={2000}/><button className="button primary" disabled={reportBusy}>{reportBusy?'Submitting…':'Submit report'}</button></form></section></div>}
    {commentPost&&<div className="comments-overlay" role="dialog" aria-modal="true"><section className="comments-modal panel"><header><h2>Replies</h2><button type="button" onClick={()=>setCommentPost(null)} aria-label="Close replies">×</button></header><div className="comments-list">{comments.length?comments.map(comment=><article className="comment-row" key={comment.id}><strong>{comment.author?.display_name||comment.author?.username||'Ofsocio member'}</strong><p>{comment.body}</p><small>{new Date(comment.created_at).toLocaleString()}</small></article>):<div className="empty-state">No replies yet. Start the conversation.</div>}</div><form onSubmit={submitComment}><textarea value={commentDraft} onChange={e=>setCommentDraft(e.target.value)} placeholder="Write a reply…" maxLength={2000} required/><button className="button primary" disabled={commentBusy}>{commentBusy?'Sending…':'Reply'}</button></form></section></div>}
    {storyViewer&&<div className="story-viewer" role="dialog" aria-modal="true"><button className="story-viewer-close" onClick={()=>setStoryViewer(null)} type="button" aria-label="Close story">×</button>{storyViewer.media_type==='video'?<video src={storyViewer.signed_url} controls autoPlay/>:<img src={storyViewer.signed_url} alt={storyViewer.caption||'Story'}/>}<div className="story-viewer-caption"><strong>{storyViewer.author?.display_name||storyViewer.author?.username||'Ofsocio member'}</strong><p>{storyViewer.caption}</p><small>Expires {new Date(storyViewer.expires_at).toLocaleString()}</small></div></div>}
  </>;
}

function FriendsView({ following, toggleFollowing }) {
  const [tab, setTab] = useState('Discover');
  return <><div className="view-heading"><div><div className="eyebrow">YOUR PEOPLE, YOUR PACE</div><h1>Circles</h1><p>Friendship and following, kept intentionally separate.</p></div><button className="button primary">Find people <span>⌕</span></button></div><div className="segmented">{['Discover', 'Requests', 'Following', 'Followers'].map((item) => <button className={tab === item ? 'active' : ''} onClick={() => setTab(item)} key={item} type="button">{item}{item === 'Requests' && <b>2</b>}</button>)}</div><div className="people-grid">{(tab === 'Requests' ? people.slice(1) : people).map((person, index) => <article className="person-card panel" key={person.name}><div className={`person-cover cover-${index}`} /><Avatar image={person.image} name={person.name} size="large" /><div className="person-info"><h3>{person.name}</h3><span>{person.detail}</span><p>{index === 0 ? 'Collecting places, people and small moments.' : 'Good conversations start somewhere.'}</p><div className="mutuals"><span className="mini-faces">●●●</span> {12 + index * 6} mutuals</div><button className={`button ${following.includes(person.name) ? 'outline' : 'primary'} full-button`} onClick={() => toggleFollowing(person.name)} type="button">{following.includes(person.name) ? 'Following' : tab === 'Requests' ? 'Accept request' : '＋ Follow'}</button>{tab === 'Requests' && <button className="text-button" type="button">Decline</button>}</div></article>)}</div></>;
}

function MessagesView(props) { return <LiveMessagesView {...props}/>; }

function GroupsView(props) { return <LiveGroupsView {...props}/>; }

function ReelsView() {
  return <><div className="view-heading"><div><div className="eyebrow">SHORT-FORM VIDEO</div><h1>Reels</h1><p>Discover short videos shared by real Ofsocio members.</p></div></div><section className="live-feature-card panel"><span className="live-feature-kicker">FEATURE NOT CONNECTED</span><h3>Reels publishing and playback are not live yet</h3><p>We are not showing stock videos, fake creators or simulated engagement as real content. Reels will appear here when video upload, playback, moderation and feed storage are connected.</p></section></>;
}

function BusinessView(props) { return <LiveBusinessView {...props}/>; }

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
    return <article className={`plan-card panel ${selected === plan.name ? 'selected' : ''}`} key={plan.code}><div className={`plan-symbol ${plan.color}`}>{plan.color === 'free' ? '○' : plan.color === 'premium' ? '✦' : '◇'}</div><span className="eyebrow">{configuredPlan ? `STAGE 0${configuredPlan.stage} · ${plan.stage.split('·')[1].trim().split(' ')[0]}` : plan.stage}</span><h2>{configuredPlan?.display_name || plan.name}</h2><p className="plan-price">{priceLabel}</p><ul>{plan.features.map((feature) => <li key={feature}><span>✓</span>{feature}</li>)}</ul><button className={`button ${plan.color === 'free' ? 'outline' : 'primary'} full-button`} onClick={() => { setSelected(plan.name); if (plan.code !== 'free') onCheckout?.(plan.code, billingPeriod); }} type="button">{plan.color === 'free' ? 'Current stage' : onCheckout ? price ? 'Continue to checkout' : 'Pricing unavailable' : selected === plan.name ? 'Selected for review' : 'Explore this stage'}</button></article>;
  })}</div><div className="notice panel"><span>ⓘ</span><p>Payment integration is not connected. No checkout will start from this preview.</p></div></>;
}

function KycView({ applications = [], onSubmitApplication }) {
  const getStatus = (type) => applications.find((item) => item.application_type === type)?.status || 'not_started';
  const submit = (type) => onSubmitApplication?.(type);
  const individualStatus = getStatus('individual');
  const businessStatus = getStatus('business');
  const statusLabel = (status) => status === 'not_started' ? 'Not started' : status.replaceAll('_', ' ');
  return <><div className="view-heading"><div><div className="eyebrow">IDENTITY, HANDLED WITH CARE</div><h1>Verification</h1><p>Only required for selected services. No identity documents are collected until a verified provider workflow is available.</p></div></div><div className="verification-layout"><section className="verification-card panel"><div className="verification-icon">▧</div><span className="eyebrow">INDIVIDUAL VERIFICATION</span><h2>Verify your identity</h2><p>Securely confirm your identity to access eligible Premium features. A vetted provider handles document checks in production.</p><div className="status-line"><span>Status</span><strong className={`status-pill ${individualStatus === 'not_started' ? '' : 'pending'}`}>{statusLabel(individualStatus)}</strong></div><button className="button primary full-button" onClick={() => submit('individual')} disabled={true}>{individualStatus === 'not_started' ? 'Verification unavailable' : 'Application submitted'}</button><small>Verification is disabled until a vetted provider and audited backend workflow are connected.</small></section><section className="verification-card panel"><div className="verification-icon business-icon">◇</div><span className="eyebrow">BUSINESS VERIFICATION</span><h2>Verify an organisation</h2><p>Confirm your organisation and authorised representative before activating Business / Pro tools.</p><div className="status-line"><span>Status</span><strong className={`status-pill ${businessStatus === 'not_started' ? '' : 'pending'}`}>{statusLabel(businessStatus)}</strong></div><button className="button outline full-button" onClick={() => submit('business')} disabled={true}>Verification unavailable</button></section></div><div className="privacy-callout"><span>◈</span><p><strong>Minimal by design.</strong> Ofsocio stores the verification outcome and provider reference where possible, not raw identity documents.</p></div></>;
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
  return <><div className="view-heading"><div><div className="eyebrow">{preview ? 'LOCAL PREVIEW · SAMPLE QUEUE' : 'RESTRICTED STAFF WORKSPACE'}</div><h1>Admin Dashboard</h1><p>{preview ? 'Sample decisions only. Nothing is sent to Ofsocio.' : 'Decisions are permission-checked and audited by the server.'}</p></div><span className="queue-count">{items.length} in review</span></div><div className="approval-layout"><section className="approval-queue panel"><div className="section-title"><div><span className="eyebrow">VERIFICATION QUEUE</span><h2>Needs a decision</h2></div><button className="quiet-button">All requests⌄</button></div>{items.length ? items.map((item) => <article className="approval-item" key={item.id || item.name}><Avatar image={item.image} name={item.name}/><div className="approval-info"><strong>{item.name}</strong><span>{item.type}</span><small>{item.detail}</small></div><div className="approval-buttons"><button type="button" className="button outline small-button" onClick={() => decide(item, 'needs_more_information', 'additional_information')}>Request info</button><button type="button" className="button outline small-button" onClick={() => decide(item, 'rejected', 'verification_failed')}>Reject</button><button type="button" className="button primary small-button" onClick={() => decide(item, 'verified')}>Approve</button></div></article>) : <div className="empty-state">The review queue is clear.</div>}</section><aside className="audit-card panel"><span className="eyebrow">AUDIT FIRST</span><h2>Every decision leaves a trail.</h2><p>Production decisions require a separate reviewer, a reason category, timestamp and audit record.</p><div className="audit-stat"><strong>{String(items.length).padStart(2, '0')}</strong><span>pending reviews</span></div><div className="audit-stat"><strong>API</strong><span>permission checked</span></div></aside></div></>;
}

function SupportView({ faqOnly = false }) {
  const [question, setQuestion] = useState('');
  const [asked, setAsked] = useState([]);
  const faqs = ['How do I make my profile private?', 'How does identity verification work?', 'How do I report a suspicious account?'];
  return <><div className="view-heading"><div><div className="eyebrow">{faqOnly ? 'ANSWERS, WITHOUT THE RUNAROUND' : 'HERE WHEN YOU NEED A HAND'}</div><h1>{faqOnly ? 'Help & FAQ' : 'AI Support'}</h1><p>{faqOnly ? 'Clear answers about your account, safety and membership.' : 'Ask about Ofsocio. For sensitive issues, we’ll help you reach a person.'}</p></div></div><div className="support-layout"><section className="support-main panel"><div className="support-head"><div className="support-spark">✦</div><div><strong>{faqOnly ? 'Frequently asked' : 'Ofsocio Support'}</strong><span>{faqOnly ? 'Sample FAQ · Preview content' : 'UI preview · AI and human support not connected'}</span></div></div>{faqOnly ? <div className="faq-list">{faqs.map((item, index) => <details key={item}><summary><span>0{index + 1}</span>{item}<b>＋</b></summary><p>{index === 0 ? 'Open Your profile, choose Privacy, then set account visibility to Private. Existing followers remain approved until you remove them.' : index === 1 ? 'Verification is required only for selected services. A reviewed provider handles identity checks; Ofsocio stores the minimum verification outcome needed.' : 'Open the account or content menu and choose Report. You can also block the account immediately from its profile.'}</p></details>)}</div> : <><div className="assistant-message"><span className="assistant-avatar">✦</span><p>Hi Ada. I can help you find settings, understand membership, or get support with a safety concern. What’s on your mind?</p></div>{asked.map((item, index) => <React.Fragment key={index}><div className="user-message">{item}</div><div className="assistant-message"><span className="assistant-avatar">✦</span><p>I can point you in the right direction. For account-specific or sensitive issues, please use the human support path in Security Centre.</p></div></React.Fragment>)}<div className="prompt-chips">{['Privacy settings', 'Premium plans', 'Report a scam'].map((item) => <button type="button" onClick={() => setAsked([...asked, item])} key={item}>{item} ↗</button>)}</div><form className="support-input" onSubmit={(event) => { event.preventDefault(); if (question.trim()) { setAsked([...asked, question.trim()]); setQuestion(''); } }}><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask a question..."/><button type="submit" aria-label="Send question">↗</button></form><small className="support-note">AI-generated guidance can be wrong. It cannot decide KYC, fraud, account enforcement or payment disputes.</small></>}</section><aside className="support-sidebar panel"><span className="eyebrow">POPULAR TOPICS</span>{['Your account', 'Privacy & safety', 'Membership & billing', 'Groups & community'].map((item, index) => <button className="topic-link" key={item} type="button"><span>{['◍', '◈', '✦', '◫'][index]}</span>{item}<b>↗</b></button>)}<div className="human-help"><span>PERSONAL SUPPORT</span><strong>Need a human?</strong><p>Reach our support team for account-specific help.</p><button className="text-link" type="button">Open a support case ↗</button></div></aside></div></>;
}

function ProfileView({ isPrivate, setIsPrivate, following }) {
  const [tab, setTab] = useState('Posts');
  return <><div className="profile-cover"><div className="cover-lines"/><span className="profile-edit">Edit profile ↗</span></div><section className="profile-summary panel"><Avatar image="photo-1534528741775-53994a69daeb" name="Ada Okafor" size="profile"/><div className="profile-details"><div className="profile-name-row"><div><h1>Ada Okafor <span className="verified">✦</span></h1><span>@adaokafor · Lagos, Nigeria</span></div><button className={`privacy-toggle ${isPrivate ? 'on' : ''}`} onClick={() => setIsPrivate(!isPrivate)} type="button"><span>{isPrivate ? '◈' : '◎'}</span>{isPrivate ? 'Private account' : 'Public account'}<i /></button></div><p>Collecting places, people and small moments. Designer, occasional ocean chaser.</p><div className="profile-stats"><span><strong>128</strong> posts</span><span><strong>2.4k</strong> followers</span><span><strong>{following.length}</strong> following</span></div></div></section><div className="profile-tabs">{['Posts', 'Stories', 'About', 'Friends'].map((item) => <button type="button" className={tab === item ? 'active' : ''} onClick={() => setTab(item)} key={item}>{item}</button>)}</div><div className="profile-content panel"><span className="eyebrow">{tab.toUpperCase()}</span><h2>{tab === 'Posts' ? 'A little more of Ada.' : tab === 'Stories' ? 'The last 24 hours.' : tab === 'About' ? 'The details that make a person.' : 'People in Ada’s circle.'}</h2><p>{isPrivate ? 'Your account is private. Only approved followers can see protected posts and profile details.' : 'Your profile is public. Posts still follow their own audience settings.'}</p><div className="profile-photo-grid">{['photo-1473116763249-2faaef81ccda', 'photo-1500530855697-b586d89ba3ee', 'photo-1470252649378-9c29740c9fa8'].map((image) => <img src={imageUrl(image, 400, 400)} alt="Ada’s recent post" key={image}/>)}</div></div></>;
}

function CentreView({ privacy = false, isPrivate, setIsPrivate }) {
  return <><div className="view-heading"><div><div className="eyebrow">{privacy ? 'YOUR DATA, YOUR DECISIONS' : 'ACCOUNT PROTECTION'}</div><h1>{privacy ? 'Privacy Centre' : 'Security Centre'}</h1><p>{privacy ? 'Manage the privacy control currently connected to your account.' : 'Only controls connected to real account security are shown as active.'}</p></div></div>
    <div className="live-feature-grid">
      {privacy ? <article className="live-feature-card panel"><span className="live-feature-kicker">CONNECTED SETTING</span><h3>Account visibility</h3><p>{isPrivate?'Your account is private. Follow requests require approval.':'Your account is public and can be discovered.'}</p><button className="button primary" type="button" onClick={()=>setIsPrivate(!isPrivate)}>{isPrivate?'Make account public':'Make account private'}</button></article>
      : <article className="live-feature-card panel"><span className="live-feature-kicker">SECURITY STATUS</span><h3>Security activity is not connected yet</h3><p>Ofsocio will show verified sign-in activity, active sessions and two-step verification here only after those controls are implemented and enforced by the authentication backend.</p><p className="live-feature-note">No simulated device count, fake alerts or decorative security switches are displayed.</p></article>}
      {privacy&&<article className="live-feature-card panel"><span className="live-feature-kicker">PRIVACY COMMITMENT</span><h3>Clear and accountable</h3><p>Privacy controls must reflect the actual database policy. We will not show local-only toggles for message requests, discovery tracking or data deletion as if they were saved.</p></article>}
    </div>
  </>;
}

function SearchResults({ term, supabase, currentUser, onNotice }) {
  const [peopleResults, setPeopleResults] = useState([]);
  const [postResults, setPostResults] = useState([]);
  const [followingIds, setFollowingIds] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [busyId, setBusyId] = useState('');
  useEffect(() => {
    if (!supabase || !term.trim()) return undefined;
    let active = true;
    const safe = term.trim().replace(/[%,_]/g, ' ').slice(0, 60);
    Promise.all([
      supabase.from('profiles').select('id,username,display_name,bio,avatar_url').ilike('username', `%${safe}%`).limit(20),
      supabase.from('profiles').select('id,username,display_name,bio,avatar_url').ilike('display_name', `%${safe}%`).limit(20),
      supabase.from('posts').select('id,author_id,body,created_at,visibility').ilike('body', `%${safe}%`).order('created_at',{ascending:false}).limit(20),
      supabase.from('follows').select('followed_id').eq('follower_id',currentUser.id),
      supabase.rpc('get_my_follow_requests')
    ]).then(([usernames,names,posts,follows,requests])=>{
      if(!active) return;
      if(usernames.error) throw usernames.error; if(names.error) throw names.error; if(posts.error) throw posts.error; if(follows.error) throw follows.error; if(requests.error) throw requests.error;
      const combinedPeople = [...(usernames.data||[]),...(names.data||[])];
      setPeopleResults([...new Map(combinedPeople.map(person=>[person.id,person])).values()]); setPostResults(posts.data||[]); setFollowingIds((follows.data||[]).map(x=>x.followed_id)); setPendingRequests((requests.data||[]).filter(x=>x.direction==='outgoing').map(x=>x.profile_id));
    }).catch(error=>{ if(active) onNotice?.(error.message); });
    return ()=>{active=false;};
  },[term,supabase,currentUser?.id]);
  async function toggleFollow(id){
    setBusyId(id);
    try{
      if(followingIds.includes(id)){
        const {error}=await supabase.from('follows').delete().eq('follower_id',currentUser.id).eq('followed_id',id); if(error)throw error;
        setFollowingIds(ids=>ids.filter(x=>x!==id));
      }else if(pendingRequests.includes(id)){
        const {data,error}=await supabase.rpc('get_my_follow_requests'); if(error)throw error;
        const request=(data||[]).find(item=>item.direction==='outgoing'&&item.profile_id===id);
        if(request){const result=await supabase.rpc('cancel_ofsocio_follow_request',{p_request_id:request.request_id});if(result.error)throw result.error;}
        setPendingRequests(ids=>ids.filter(x=>x!==id));
      }else{
        const {data,error}=await supabase.rpc('request_ofsocio_follow',{p_target_id:id}); if(error)throw error;
        if(data==='following')setFollowingIds(ids=>[...ids,id]);
        if(data==='pending')setPendingRequests(ids=>[...ids,id]);
      }
    }catch(error){onNotice?.(error.message);}finally{setBusyId('');}
  }

  return <section className="search-results-live"><div className="view-heading"><div><div className="eyebrow">SEARCH OFSOCIO</div><h1>Results for “{term}”</h1><p>People and posts matching your search.</p></div></div><section className="panel admin-report-panel"><h2>People</h2>{peopleResults.length?peopleResults.map(person=><article className="admin-report-row search-person" key={person.id}><div><strong>{person.display_name||person.username||'Ofsocio member'}</strong><p>@{person.username||'member'} · {person.bio||'Ofsocio member'}</p></div>{person.id!==currentUser.id&&<button className="button outline small-button" disabled={busyId===person.id} onClick={()=>toggleFollow(person.id)}>{followingIds.includes(person.id)?'Following':pendingRequests.includes(person.id)?'Requested':'Follow'}</button>}</article>):<div className="empty-state">No people found.</div>}</section><section className="panel admin-report-panel"><h2>Posts</h2>{postResults.length?postResults.map(post=><article className="admin-report-row" key={post.id}><p>{post.body}</p><small>{new Date(post.created_at).toLocaleString()}</small></article>):<div className="empty-state">No posts found.</div>}</section></section>;
}

function StaffOverview({ role, rows, supabase, currentUser, onNotice }) {
  const [stats, setStats] = useState({ tickets: 0, reports: 0, posts: 0 });
  const [reportRows, setReportRows] = useState([]);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    Promise.all([
      supabase.from('support_tickets').select('id', { count: 'exact', head: true }),
      supabase.from('content_reports').select('id', { count: 'exact', head: true }),
      supabase.from('posts').select('id', { count: 'exact', head: true })
    ]).then(([tickets,reports,posts]) => { if (active) setStats({ tickets: tickets.count || 0, reports: reports.count || 0, posts: posts.count || 0 }); });
    supabase.from('content_reports').select('id,target_type,target_id,reason,description,status,created_at').order('created_at',{ascending:false}).limit(20)
      .then(({data,error})=>{ if (!active) return; if (error) onNotice?.(error.message); else setReportRows(data || []); });
    return () => { active = false; };
  }, [supabase]);
  async function reviewReport(report, nextStatus) {
    try {
      const { data, error } = await supabase.rpc('admin_update_content_report', { p_report_id: report.id, p_status: nextStatus, p_reason_category: 'staff_review' });
      if (error) throw error;
      setReportRows(rows => rows.map(row => row.id === report.id ? { ...row, status: data.status } : row));
      onNotice?.('Report status updated and audited.');
    } catch (error) { onNotice?.(error.message); }
  }
  return <><div className="view-heading"><div><div className="eyebrow">ROLE-BASED STAFF AREA</div><h1>Admin Dashboard</h1><p>Signed in with the {role} role. Staff actions are checked and audited in Supabase.</p></div></div><div className="admin-stat-grid">{[['Support tickets',stats.tickets],['Reports visible',stats.reports],['Posts visible',stats.posts]].map(([label,value])=><div className="panel admin-stat" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><section className="panel admin-report-panel"><h2>Recent reports</h2>{reportRows.length?reportRows.map(report=><article className="admin-report-row" key={report.id}><strong>{report.target_type} · {report.status}</strong><p>{report.reason}{report.description?` — ${report.description}`:''}</p><small>{new Date(report.created_at).toLocaleString()} · {report.target_id}</small><div className="admin-report-actions"><button className="button outline small-button" onClick={()=>reviewReport(report,'reviewing')}>Review</button><button className="button outline small-button" onClick={()=>reviewReport(report,'dismissed')}>Dismiss</button><button className="button primary small-button" onClick={()=>reviewReport(report,'resolved')}>Resolve</button></div></article>):<div className="empty-state">No reports visible to this staff role.</div>}</section><section className="panel admin-report-panel"><h2>Staff access</h2><p>Your current role is <strong>{role}</strong>. Role assignments are not editable from this client; they must be granted by a trusted administrator.</p>{rows?.length>0&&<div className="admin-role-list">{rows.map(item=><div key={item.user_id}><span>{item.user_id}</span><strong>{item.role}</strong></div>)}</div>}</section></>;
}

function Sidebar({ view, setView, onSignOut, preview, exitLabel, staffAccess, currentUser, remoteProfile }) {
  const accountName = remoteProfile?.display_name || currentUser?.email?.split('@')[0] || 'Ofsocio member';
  return <aside className="desktop-sidebar"><a className="wordmark" href="#home" onClick={(event) => { event.preventDefault(); setView('home'); }}>OFSOCIO<small>social</small></a><button className="account-chip" type="button"><Avatar image={remoteProfile?.avatar_url || 'photo-1534528741775-53994a69daeb'} name={accountName}/><span><strong>{accountName}</strong><small>{preview ? 'Local preview' : 'Your account'}</small></span><b>⌄</b></button><div className="side-nav">{navigation.map((group) => <div className="nav-group" key={group.section}><div className="nav-caption">{group.section}</div>{group.items.map(([id, icon, label]) => <button className={`side-link ${view === id ? 'active' : ''}`} type="button" key={id} onClick={() => setView(id)}><span className="side-icon">{icon}</span>{label}{id === 'messages' && <i className="unread-dot"/>}</button>)}</div>)}{staffAccess && <div className="nav-group"><div className="nav-caption">STAFF WORKSPACE</div><button className={`side-link ${view === 'approvals' ? 'active' : ''}`} type="button" onClick={() => setView('approvals')}><span className="side-icon">⌑</span>Admin Dashboard</button></div>}</div><div className="sidebar-bottom"><button className="side-link" onClick={() => setView('privacy')} type="button"><span className="side-icon">◈</span>Privacy settings</button><button className="side-link" onClick={onSignOut} type="button"><span className="side-icon">↗</span>{exitLabel || (preview ? 'Exit preview' : 'Sign out')}</button></div></aside>;
}

function RightRail({ view, currentUser, remoteProfile }) {
  const name = remoteProfile?.display_name || currentUser?.email?.split('@')[0] || 'Ofsocio member';
  return <aside className="right-rail"><div className="rail-block profile-nudge"><div className="rail-heading"><span className="eyebrow">YOUR SPACE</span><button type="button" className="text-link" onClick={()=>window.dispatchEvent(new CustomEvent('ofsocio:navigate',{detail:'profile'}))}>Edit</button></div><div className="mini-profile"><Avatar image={remoteProfile?.avatar_url || 'photo-1534528741775-53994a69daeb'} name={name} size="large"/><div><strong>{name}</strong><span>{remoteProfile?.username?`@${remoteProfile.username}`:currentUser?.email||''}</span></div></div><div className="profile-progress"><div><span>Account</span><strong>{remoteProfile?.is_private?'Private':'Public'}</strong></div><small>Keep your profile details current and choose your privacy in Profile.</small></div></div><div className="rail-block"><div className="rail-heading"><div><span className="eyebrow">DISCOVER</span><h3>Find good people</h3></div></div><p className="support-note">Search by username or display name to find members and follow or request to follow them.</p><button className="text-link" type="button" onClick={()=>document.querySelector('.global-search input')?.focus()}>Search members ↗</button></div><div className="rail-promo"><span className="promo-star">✦</span><span className="eyebrow">A LITTLE MORE ROOM TO GROW</span><h3>Make more of what you share.</h3><p>Explore creator tools with Ofsocio Premium.</p><button type="button" onClick={() => window.dispatchEvent(new CustomEvent('ofsocio:navigate', { detail: 'membership' }))}>Explore Premium ↗</button></div><footer className="rail-footer">About · Community · Privacy · Terms<br/>© 2026 Ofsocio Social</footer></aside>;
}

export default function SocialShell({ preview = false, onExit, accessToken, exitLabel, supabase, currentUser }) {
  const [view, setView] = useState('home');
  const [liked, setLiked] = useState([]);
  const [following, setFollowing] = useState([]);
  const [isPrivate, setIsPrivate] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [search, setSearch] = useState('');
  const [remoteProfile, setRemoteProfile] = useState(null);
  const [remotePosts, setRemotePosts] = useState([]);
  const [remoteStories, setRemoteStories] = useState([]);
  const [membershipCatalog, setMembershipCatalog] = useState(null);
  const [kycApplications, setKycApplications] = useState([]);
  const [capabilities, setCapabilities] = useState([]);
  const [approvalApplications, setApprovalApplications] = useState([]);
  const [apiNotice, setApiNotice] = useState('');
  const [staffRole, setStaffRole] = useState('user');
  const mobileItems = [['home', '⌂', 'Home'], ['friends', '◉', 'Circles'], ['create', '＋', 'Create'], ['messages', '✉', 'Inbox'], ['profile', '◍', 'You']];

  useEffect(() => {
    if (!supabase || !currentUser?.id) {
      setRemoteProfile(null); setRemotePosts([]); setCapabilities([]); setStaffRole('user');
      return undefined;
    }
    let active = true;
    async function loadCore() {
      try {
        const [profileResult, feedResult, storyResult, roleResult] = await Promise.all([
          supabase.from('profiles').select('id,username,display_name,bio,country_code,preferred_currency,avatar_url,is_private,follower_list_visibility,created_at').eq('id', currentUser.id).maybeSingle(),
          supabase.from('posts').select('id,author_id,body,media_urls,visibility,created_at').order('created_at', { ascending: false }).limit(30),
          supabase.from('stories').select('id,user_id,media_path,media_type,caption,created_at,expires_at').gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false}).limit(40),
          supabase.from('user_roles').select('role').eq('user_id', currentUser.id).maybeSingle()
        ]);
        if (profileResult.error) throw profileResult.error;
        if (feedResult.error) throw feedResult.error;
        if (storyResult.error) throw storyResult.error;
        if (roleResult.error && roleResult.error.code !== 'PGRST116') throw roleResult.error;
        const authorIds = [...new Set([...(feedResult.data || []).map(post => post.author_id), ...(storyResult.data || []).map(story => story.user_id)])];
        let authorProfiles = [];
        if (authorIds.length) {
          const authorResult = await supabase.from('profiles').select('id,username,display_name,avatar_url').in('id', authorIds);
          if (authorResult.error) throw authorResult.error;
          authorProfiles = authorResult.data || [];
        }
        const authorMap = new Map();
        for (const profile of authorProfiles) {
          let avatar = profile.avatar_url || '';
          if (avatar && !avatar.startsWith('http')) {
            const { data: signed } = await supabase.storage.from('avatars').createSignedUrl(avatar, 3600);
            avatar = signed?.signedUrl || '';
          }
          authorMap.set(profile.id, { ...profile, avatar_url: avatar });
        }
        const postIds = (feedResult.data || []).map(post => post.id);
        let reactionRows = [], commentRows = [];
        if (postIds.length) {
          const [reactions, comments] = await Promise.all([
            supabase.from('post_reactions').select('post_id,user_id').in('post_id', postIds),
            supabase.from('comments').select('post_id').in('post_id', postIds)
          ]);
          if (reactions.error) throw reactions.error; if (comments.error) throw comments.error;
          reactionRows = reactions.data || []; commentRows = comments.data || [];
        }
        if (!active) return;
        let currentAvatar = profileResult.data?.avatar_url || '';
        if (currentAvatar && !currentAvatar.startsWith('http')) { const { data: signedAvatar } = await supabase.storage.from('avatars').createSignedUrl(currentAvatar, 3600); currentAvatar = signedAvatar?.signedUrl || ''; }
        setRemoteProfile({ ...profileResult.data, avatar_url: currentAvatar });
        setIsPrivate(Boolean(profileResult.data?.is_private));
        setRemotePosts(await Promise.all((feedResult.data || []).map(async post => {
          const mediaUrls = await Promise.all((post.media_urls || []).map(async value => {
            if (!value || value.startsWith('http')) return value;
            const { data: signed } = await supabase.storage.from('social-media').createSignedUrl(value, 3600);
            return signed?.signedUrl || '';
          }));
          return { ...post, createdAt: post.created_at, mediaUrls, author: authorMap.get(post.author_id) || {}, likeCount: reactionRows.filter(row => row.post_id === post.id).length, replyCount: commentRows.filter(row => row.post_id === post.id).length, likedByMe: reactionRows.some(row => row.post_id === post.id && row.user_id === currentUser.id) };
        })));
        setRemoteStories(await Promise.all((storyResult.data || []).map(async story => {
          const { data: signed } = await supabase.storage.from('social-media').createSignedUrl(story.media_path, 3600);
          return { ...story, signed_url: signed?.signedUrl || '', author: authorMap.get(story.user_id) || {} };
        })));
        setLiked(reactionRows.filter(row => row.user_id === currentUser.id).map(row => row.post_id));
        const role = roleResult.data?.role || 'user';
        setStaffRole(role);
        setCapabilities(role === 'support' ? ['support.read','support.reply'] : role === 'moderator' ? ['reports.read'] : role === 'admin' ? ['support.read','support.reply','reports.read','admin.dashboard'] : role === 'super_admin' ? ['support.read','support.reply','reports.read','admin.dashboard'] : []);
      } catch (error) { if (active) setApiNotice(error.message || 'Could not load Ofsocio data.'); }
    }
    loadCore();
    return () => { active = false; };
  }, [supabase, currentUser?.id]);

  useEffect(() => {
    if (!supabase || !currentUser?.id || view !== 'approvals' || !capabilities.includes('admin.dashboard')) return undefined;
    let active = true;
    supabase.from('user_roles').select('user_id,role,created_at').order('created_at', { ascending: false }).limit(100)
      .then(({ data, error }) => { if (!active) return; if (error) setApiNotice(error.message); else setApprovalApplications(data || []); });
    return () => { active = false; };
  }, [supabase, currentUser?.id, capabilities, view]);

  function navigate(next) {
    setView(next);
    setMobileMenu(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function updatePrivacy(nextValue) {
    const previousValue = isPrivate;
    setIsPrivate(nextValue); setApiNotice('');
    if (preview || !supabase || !currentUser?.id) return;
    try {
      const { data, error } = await supabase.rpc('update_my_profile_privacy', { p_is_private: nextValue, p_follower_list_visibility: remoteProfile?.follower_list_visibility || 'followers' });
      if (error) throw error;
      setRemoteProfile(current => ({ ...current, is_private: data?.is_private ?? nextValue }));
    } catch (error) { setIsPrivate(previousValue); setApiNotice(error.message); }
  }

  async function createPost(body, mediaFile = null) {
    if (preview || !supabase || !currentUser?.id) return;
    setApiNotice('');
    try {
      let mediaUrls = [];
      let uploadedPath = null;
      if (mediaFile) {
        const allowed = ['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','video/webm'];
        if (!allowed.includes(mediaFile.type) || mediaFile.size > 50 * 1024 * 1024) throw new Error('Choose JPG, PNG, WebP, GIF, MP4, MOV, or WebM up to 50 MB.');
        const ext = mediaFile.name.split('.').pop()?.toLowerCase() || 'bin';
        uploadedPath = `${currentUser.id}/posts/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('social-media').upload(uploadedPath, mediaFile, { contentType: mediaFile.type, upsert: false });
        if (uploadError) throw uploadError;
        mediaUrls = [uploadedPath];
      }
      const { data: post, error } = await supabase.from('posts').insert({ author_id: currentUser.id, body: body || '', media_urls: mediaUrls, visibility: 'public' }).select('id,author_id,body,media_urls,visibility,created_at').single();
      if (error) { if(uploadedPath) await supabase.storage.from('social-media').remove([uploadedPath]); throw error; }
      let mediaPreviewIssue = false;
      const displayMediaUrls = await Promise.all((post.media_urls || []).map(async value => {
        if (!value || value.startsWith('http')) return value;
        const { data: signed, error: signedError } = await supabase.storage.from('social-media').createSignedUrl(value, 3600);
        if (signedError) { mediaPreviewIssue = true; return ''; }
        return signed?.signedUrl || '';
      }));
      setRemotePosts(current => [{ ...post, createdAt: post.created_at, mediaUrls: displayMediaUrls, likeCount: 0, replyCount: 0, author: { display_name: remoteProfile?.display_name || currentUser.email?.split('@')[0] || 'You', username: remoteProfile?.username, avatar_url: remoteProfile?.avatar_url } }, ...(current || [])]);
      setApiNotice(mediaPreviewIssue ? 'Post published. The media preview could not load; refresh after checking storage access.' : 'Post published.');
      return true;
    } catch (error) { setApiNotice(error.message); return false; }
  }

  async function toggleReaction(postId, alreadyLiked) {
    if (!supabase || !currentUser?.id) return;
    try {
      if (alreadyLiked) {
        const { error } = await supabase.from('post_reactions').delete().eq('post_id', postId).eq('user_id', currentUser.id);
        if (error) throw error;
        setLiked(current => current.filter(id => id !== postId));
        setRemotePosts(current => (current || []).map(post => post.id === postId ? { ...post, likeCount: Math.max(0,(post.likeCount||0)-1) } : post));
      } else {
        const { error } = await supabase.from('post_reactions').insert({ post_id: postId, user_id: currentUser.id, reaction: 'like' });
        if (error) throw error;
        setLiked(current => [...current, postId]);
        setRemotePosts(current => (current || []).map(post => post.id === postId ? { ...post, likeCount: (post.likeCount||0)+1 } : post));
      }
    } catch (error) { setApiNotice(error.message); }
  }

  function commentAdded(postId) {
    setRemotePosts(current => (current||[]).map(post=>post.id===postId?{...post,replyCount:(post.replyCount||0)+1}:post));
  }

  async function submitKyc(_applicationType) {
    setApiNotice('Verification application submission is not yet wired to a verified identity provider. No documents were collected.');
  }

  async function reviewKyc(_applicationId, _decision, _reasonCategory) {
    setApiNotice('KYC review is not enabled until the verified provider workflow and audit integration are configured.');
  }

  async function startCheckout(_planCode, _billingPeriod) {
    setApiNotice('Membership checkout is not enabled yet. Payments require server-side price, transaction verification, and platform billing compliance.');
  }

  React.useEffect(() => {
    const handler = (event) => navigate(event.detail);
    const noticeHandler = (event) => setApiNotice(event.detail || '');
    window.addEventListener('ofsocio:navigate', handler);
    window.addEventListener('ofsocio:notice', noticeHandler);
    return () => { window.removeEventListener('ofsocio:navigate', handler); window.removeEventListener('ofsocio:notice', noticeHandler); };
  }, []);

  const toggleFollowing = (name) => setFollowing((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]);
  const titles = { home: 'For you', friends: 'Circles', reels: 'Reels', messages: 'Messages', groups: 'Groups', business: 'Business', profile: 'Your profile', membership: 'Membership', kyc: 'Verification', approvals: 'Admin Dashboard', support: 'Customer Service', faq: 'Help & FAQ', security: 'Security Centre', privacy: 'Privacy Centre' };

  return <div className="ofsocio-app">
    <Sidebar view={view} setView={navigate} onSignOut={onExit} preview={preview} exitLabel={exitLabel} staffAccess={capabilities.includes('admin.dashboard') || capabilities.includes('reports.read')} currentUser={currentUser} remoteProfile={remoteProfile}/>
    <div className="app-body"><header className="topbar"><button className="mobile-brand" onClick={() => navigate('home')} type="button">OFSOCIO</button><div className="global-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search people, circles and ideas" aria-label="Search Ofsocio"/><kbd>⌘ K</kbd></div><div className="top-actions"><button className="top-create" onClick={() => navigate('create')} type="button"><span>＋</span> Create post</button><IconButton label="Notifications" className="notification-button">◌<i/></IconButton><button className="top-avatar" onClick={() => navigate('profile')} type="button"><Avatar image={remoteProfile?.avatar_url || 'photo-1534528741775-53994a69daeb'} name={remoteProfile?.display_name || currentUser?.email || 'Ofsocio member'}/></button></div></header>
      {preview && <div className="preview-banner"><span>LOCAL PREVIEW</span> Sample content and local-only interactions. Your Ofsocio account data is not connected in this preview.<button onClick={onExit} type="button">{exitLabel || 'Exit preview'} <b>×</b></button></div>}
      {!preview && apiNotice && <div className="backend-notice" role="status">Backend notice: {apiNotice}</div>}
      <div className="workspace"><main className="main-column" aria-label={titles[view]}>
        {search.trim() ? <SearchResults term={search} supabase={supabase} currentUser={currentUser} onNotice={setApiNotice}/> : <>
        {view === 'home' && <HomeView liked={liked} setLiked={setLiked} following={following} toggleFollowing={toggleFollowing} remotePosts={remotePosts} remoteStories={remoteStories} onCreatePost={accessToken && !preview ? createPost : undefined} onToggleLike={toggleReaction} userAvatar={remoteProfile?.avatar_url} userName={remoteProfile?.display_name} supabase={supabase} currentUser={currentUser} onCommentAdded={commentAdded}/>}
        {view === 'friends' && <LiveCirclesView supabase={supabase} user={currentUser} onNotice={setApiNotice}/>}
        {view === 'messages' && <MessagesView supabase={supabase} user={currentUser} onNotice={setApiNotice}/>}
        {view === 'groups' && <GroupsView supabase={supabase} user={currentUser} onNotice={setApiNotice}/>}
        {view === 'reels' && <ReelsView/>}
        {view === 'business' && <BusinessView supabase={supabase} user={currentUser} onNotice={setApiNotice}/>}
        {view === 'membership' && <MembershipView catalog={membershipCatalog} profile={remoteProfile} onCheckout={accessToken && !preview ? startCheckout : undefined}/>}
        {view === 'kyc' && <KycView applications={kycApplications} onSubmitApplication={accessToken && !preview ? submitKyc : undefined}/>}
        {view === 'approvals' && (capabilities.includes('admin.dashboard') || capabilities.includes('reports.read')) && <StaffOverview role={staffRole} rows={approvalApplications} supabase={supabase} currentUser={currentUser} onNotice={setApiNotice}/>}
        {view === 'support' && <SupportDesk supabase={supabase} user={currentUser} staff={capabilities.includes('support.read')} canReviewReports={capabilities.includes('reports.read')} onNotice={setApiNotice}/>}
        {view === 'faq' && <SupportView faqOnly/>}
        {view === 'profile' && <LiveProfileView supabase={supabase} user={currentUser} isPrivate={isPrivate} onPrivacyChange={updatePrivacy} onNotice={setApiNotice}/>}
        {view === 'security' && <CentreView/>}
        {view === 'privacy' && <CentreView privacy isPrivate={isPrivate} setIsPrivate={updatePrivacy}/>}
        {view === 'create' && <CreatePostView user={currentUser} profile={remoteProfile} onCreatePost={accessToken && !preview ? createPost : undefined}/>}
        </>}
      </main><RightRail view={view} currentUser={currentUser} remoteProfile={remoteProfile}/></div>
      <nav className="mobile-nav" aria-label="Primary navigation">{mobileItems.map(([id, icon, label]) => <button className={view === id || (id === 'create' && view === 'home') ? 'active' : ''} key={id} type="button" onClick={() => navigate(id)}><span>{icon}</span>{label}</button>)}</nav>
      <button className="mobile-more" onClick={() => setMobileMenu(!mobileMenu)} type="button" aria-label="More sections">{mobileMenu ? '×' : '···'}</button>
      {mobileMenu && <div className="mobile-menu">{navigation.flatMap((group) => group.items).map(([id, icon, label]) => <button key={id} type="button" onClick={() => navigate(id)}><span>{icon}</span>{label}</button>)}{(capabilities.includes('admin.dashboard') || capabilities.includes('reports.read')) && <button type="button" onClick={() => navigate('approvals')}><span>⌑</span>Admin Dashboard</button>}</div>}
    </div>
  </div>;
}
