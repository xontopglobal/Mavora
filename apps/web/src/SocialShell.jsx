import React, { useEffect, useState } from 'react';
import { apiRequest } from './lib/api';
import './social.css';

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
  { name: 'Mavora Creators', text: 'Ada: Sunday photo walk?', time: '18m', image: 'photo-1517841905240-472988babdf9' },
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

function HomeView({ liked, setLiked, following, toggleFollowing, remotePosts = null, onCreatePost }) {
  const [draft, setDraft] = useState('');
  const [posts, setPosts] = useState([
    { id: 1, name: 'Ada Okafor', location: 'Lagos, Nigeria · 18 min ago', image: 'photo-1534528741775-53994a69daeb', text: 'Found a little quiet between the city and the sea. Keeping this one. #weekendnotes', photo: 'photo-1473116763249-2faaef81ccda', caption: 'Somewhere on the coast', likes: '284', replies: '32' },
    { id: 2, name: 'Malik Bello', location: 'Yaba, Lagos · 1 hr ago', image: 'photo-1500648767791-00dcc994a43e', text: 'A few frames from a morning that started without a plan.', photo: 'photo-1519608487953-e999c86e7455', caption: 'Before the city woke', likes: '96', replies: '14' }
  ]);

  function publish() {
    if (!draft.trim()) return;
    if (onCreatePost) {
      const content = draft.trim();
      setDraft('');
      onCreatePost(content);
      return;
    }
    setPosts([{ id: Date.now(), name: 'You', location: 'Just now', image: 'photo-1534528741775-53994a69daeb', text: draft.trim(), photo: 'photo-1473116763249-2faaef81ccda', caption: 'Shared with your circle', likes: '0', replies: '0' }, ...posts]);
    setDraft('');
  }

  const visiblePosts = remotePosts === null ? posts : remotePosts.map((post) => ({
    id: post.id,
    name: post.author?.display_name || post.author?.username || 'Mavora member',
    location: post.createdAt ? new Date(post.createdAt).toLocaleString() : 'Recently',
    image: post.author?.avatar_url || 'photo-1534528741775-53994a69daeb',
    text: post.body || '',
    photo: 'photo-1473116763249-2faaef81ccda',
    photoUrl: post.mediaUrls?.[0] || null,
    caption: post.mediaUrls?.length ? 'Shared with your circle' : '',
    likes: '0',
    replies: '0'
  }));

  return <>
    <div className="view-heading"><div><div className="eyebrow">WEDNESDAY, NOVEMBER 11</div><h1>The near &amp; now</h1><p>Your people, in their own words.</p></div><span className="live-mark"><i /> YOUR CIRCLE</span></div>
    <div className="stories-strip"><div className="story create-story"><span className="story-ring add-ring">＋</span><span>Your story</span></div>{people.map((person, index) => <button className="story" key={person.name} type="button"><span className={`story-ring tone-${index}`}><Avatar image={person.image} name={person.name} /></span><span>{person.name.split(' ')[0]}</span></button>)}</div>
    <section className="composer panel"><Avatar image="photo-1534528741775-53994a69daeb" name="You" /><div className="composer-main"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="What would you like to share?" aria-label="Write a post" /><div className="composer-actions"><div className="composer-tools"><button type="button">▧ <span>Photo</span></button><button type="button">◷ <span>Story</span></button><button type="button">◈ <span>Audience: Friends</span></button></div><button className="button primary small-button" type="button" onClick={publish} disabled={!draft.trim()}>Share <span>↗</span></button></div></div></section>
    <div className="feed-toolbar"><div><span className="eyebrow">YOUR FEED</span><h2>From your circles</h2></div><button type="button" className="quiet-button">For you <span>⌄</span></button></div>
    <div className="feed-list">{visiblePosts.map((post) => <article className="post panel" key={post.id}>
      <header className="post-header"><Avatar image={post.image} name={post.name} /><div className="post-by"><strong>{post.name} <span className="verified">✦</span></strong><span>{post.location}</span></div><button className="more-button" type="button" aria-label="Post options">•••</button></header>
      <p className="post-copy">{post.text}</p>{(post.photoUrl || post.caption) && <div className="post-image"><img src={post.photoUrl || imageUrl(post.photo, 900, 600)} alt={post.caption} />{post.caption && <span className="image-caption">{post.caption}</span>}</div>}
      <div className="post-reactions"><span className="reaction-stack"><i>♥</i><i>✦</i></span><span>{post.likes} appreciations</span><span className="reply-count">{post.replies} replies</span></div>
      <div className="post-actions"><button type="button" className={liked.includes(post.id) ? 'is-liked' : ''} onClick={() => setLiked((current) => current.includes(post.id) ? current.filter((id) => id !== post.id) : [...current, post.id])}><span>♡</span> Appreciate</button><button type="button"><span>◯</span> Reply</button><button type="button"><span>↗</span> Share</button><button type="button" className="save-action"><span>◇</span> Save</button></div>
    </article>)}</div>
    <aside className="mobile-suggestions panel"><div className="section-title"><div><span className="eyebrow">GOOD PEOPLE, NEARBY</span><h2>Meet your next circle</h2></div><button className="text-link" type="button">See all</button></div>{people.slice(0, 2).map((person) => <div className="suggestion-row" key={person.name}><Avatar image={person.image} name={person.name} /><div className="suggestion-info"><strong>{person.name}</strong><span>{person.detail}</span></div><button type="button" className="follow-mini" onClick={() => toggleFollowing(person.name)}>{following.includes(person.name) ? 'Following' : '＋ Follow'}</button></div>)}</aside>
  </>;
}

function FriendsView({ following, toggleFollowing }) {
  const [tab, setTab] = useState('Discover');
  return <><div className="view-heading"><div><div className="eyebrow">YOUR PEOPLE, YOUR PACE</div><h1>Circles</h1><p>Friendship and following, kept intentionally separate.</p></div><button className="button primary">Find people <span>⌕</span></button></div><div className="segmented">{['Discover', 'Requests', 'Following', 'Followers'].map((item) => <button className={tab === item ? 'active' : ''} onClick={() => setTab(item)} key={item} type="button">{item}{item === 'Requests' && <b>2</b>}</button>)}</div><div className="people-grid">{(tab === 'Requests' ? people.slice(1) : people).map((person, index) => <article className="person-card panel" key={person.name}><div className={`person-cover cover-${index}`} /><Avatar image={person.image} name={person.name} size="large" /><div className="person-info"><h3>{person.name}</h3><span>{person.detail}</span><p>{index === 0 ? 'Collecting places, people and small moments.' : 'Good conversations start somewhere.'}</p><div className="mutuals"><span className="mini-faces">●●●</span> {12 + index * 6} mutuals</div><button className={`button ${following.includes(person.name) ? 'outline' : 'primary'} full-button`} onClick={() => toggleFollowing(person.name)} type="button">{following.includes(person.name) ? 'Following' : tab === 'Requests' ? 'Accept request' : '＋ Follow'}</button>{tab === 'Requests' && <button className="text-button" type="button">Decline</button>}</div></article>)}</div></>;
}

function MessagesView() {
  const [selected, setSelected] = useState(initialMessages[0]);
  const [draft, setDraft] = useState('');
  const [sent, setSent] = useState([]);
  return <><div className="view-heading"><div><div className="eyebrow">PRIVATE BY DESIGN</div><h1>Messages</h1><p>Good conversations, in a space of their own.</p></div><IconButton label="New message">＋</IconButton></div><div className="message-layout panel"><aside className="conversation-list"><div className="conversation-search"><span>⌕</span><input placeholder="Find a conversation" aria-label="Find a conversation" /></div>{initialMessages.map((message) => <button className={`conversation ${selected.name === message.name ? 'active' : ''}`} onClick={() => setSelected(message)} key={message.name} type="button"><Avatar image={message.image} name={message.name} /><span className="conversation-copy"><strong>{message.name}</strong><small>{message.text}</small></span><time>{message.time}</time></button>)}</aside><section className="chat-window"><div className="chat-heading"><Avatar image={selected.image} name={selected.name} /><div><strong>{selected.name}</strong><span><i /> Active recently</span></div><IconButton label="Conversation details">···</IconButton></div><div className="chat-history"><div className="day-marker">TODAY</div><div className="bubble received">Hey, I sent you the studio photos. The light came out beautifully.</div><div className="bubble sent">Just saw them. That afternoon glow is everything.</div><div className="bubble received">We should do another walk this weekend ✨</div>{sent.map((message, index) => <div className="bubble sent" key={index}>{message}</div>)}</div><form className="message-compose" onSubmit={(event) => { event.preventDefault(); if (draft.trim()) { setSent([...sent, draft.trim()]); setDraft(''); } }}><button type="button" aria-label="Add attachment">＋</button><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write a message" /><button className="send-button" type="submit" aria-label="Send message">↗</button></form></section></div></>;
}

function GroupsView() {
  const [joined, setJoined] = useState([]);
  const groups = [{ title: 'The Sunday Table', kind: 'OPEN CIRCLE', members: '2.4k members', description: 'Food stories, family recipes and the places that bring us together.', image: 'photo-1517248135467-4c7edcad34c4' }, { title: 'Build in the Open', kind: 'REQUEST TO JOIN', members: '864 members', description: 'A thoughtful corner for makers, founders and curious minds.', image: 'photo-1521737711867-e3b97375f902' }, { title: 'Lagos Photo Walks', kind: 'OPEN CIRCLE', members: '1.2k members', description: 'A community-led map of small moments across the city.', image: 'photo-1473116763249-2faaef81ccda' }];
  return <><div className="view-heading"><div><div className="eyebrow">GATHER AROUND SOMETHING</div><h1>Groups</h1><p>Communities shaped by what you care about.</p></div><button className="button primary">＋ Create a group</button></div><div className="filter-row"><button className="filter active">For you</button><button className="filter">Joined</button><button className="filter">Near me</button><button className="quiet-button filter-search">⌕ Search groups</button></div><div className="group-grid">{groups.map((group, index) => <article className="group-card panel" key={group.title}><div className="group-image"><img src={imageUrl(group.image, 700, 360)} alt="" /><span className="group-kind">{group.kind}</span></div><div className="group-content"><div className="eyebrow">{group.members}</div><h2>{group.title}</h2><p>{group.description}</p><div className="group-footer"><span className="mini-faces">●●●</span><button className={`button ${joined.includes(group.title) ? 'outline' : 'primary'} small-button`} onClick={() => setJoined(joined.includes(group.title) ? joined.filter((item) => item !== group.title) : [...joined, group.title])}>{joined.includes(group.title) ? 'Joined' : index === 1 ? 'Request to join' : 'Join circle'}</button></div></div></article>)}</div></>;
}

function ReelsView() {
  const [playing, setPlaying] = useState(false);
  return <><div className="view-heading"><div><div className="eyebrow">SHORT STORIES, FULL FEELING</div><h1>Reels</h1><p>Made by your circles, not an endless algorithm.</p></div><button className="button outline">Following <span>⌄</span></button></div><div className="reel-stage"><img src={imageUrl('photo-1470252649378-9c29740c9fa8', 1000, 1000)} alt="Warm light over a misty mountain valley" /><div className="reel-shade"/><button className="play-reel" type="button" onClick={() => setPlaying(!playing)} aria-label={playing ? 'Pause reel' : 'Play reel'}>{playing ? 'Ⅱ' : '▶'}</button><div className="reel-caption"><span className="eyebrow">MAVORA ORIGINAL · 00:18</span><h2>First light, before the world catches up.</h2><div className="reel-creator"><Avatar image="photo-1500648767791-00dcc994a43e" name="Malik Bello" /><div><strong>Malik Bello</strong><span>Accra · 2 hours ago</span></div><button className="follow-mini" type="button">＋ Follow</button></div></div><div className="reel-actions"><button type="button">♡<small>1.8k</small></button><button type="button">◯<small>86</small></button><button type="button">↗<small>Share</small></button><button type="button">◇<small>Save</small></button></div></div></>;
}

function BusinessView() {
  return <><div className="view-heading"><div><div className="eyebrow">MADE HERE, FOUND TOGETHER</div><h1>Business</h1><p>Meet the people and independent brands behind the work.</p></div><button className="button primary">Create a page <span>＋</span></button></div><article className="business-hero panel"><img src={imageUrl('photo-1441986300917-64674bd600d8', 1200, 580)} alt="Independent studio storefront"/><div className="business-overlay"><span className="eyebrow">FEATURED STUDIO · ACCRA</span><h2>Objects with a story.</h2><p>Meet House of Nuru, a small-batch home studio making everyday things worth keeping.</p><button className="button light">Explore the page <span>↗</span></button></div></article><div className="section-title business-title"><div><span className="eyebrow">DISCOVER WITH INTENTION</span><h2>Independent finds</h2></div><button className="text-link">All businesses ↗</button></div><div className="listing-grid">{[['Studio Kora', 'Furniture · Lagos', 'photo-1494438639946-1ebd1d20bf85'], ['Nuru Botanics', 'Care · Accra', 'photo-1608571423902-eed4a5ad8108'], ['Abeni Objects', 'Design · Nairobi', 'photo-1490312278390-ab64016e0aa9']].map(([name, meta, image]) => <article className="listing-card panel" key={name}><img src={imageUrl(image, 600, 450)} alt=""/><div><strong>{name}</strong><span>{meta}</span><small>Verified business · Discover</small></div></article>)}</div></>;
}

function MembershipView({ catalog, profile, onCheckout }) {
  const [selected, setSelected] = useState('Mavora Free');
  const [billingPeriod, setBillingPeriod] = useState('monthly');
  const countryCode = profile?.country_code?.trim();
  const plans = [
    { code: 'free', name: 'Mavora Free', stage: 'STAGE 01 · PERSONAL', color: 'free', features: ['Your profile, feed and circles', 'Groups, discovery and messaging', 'Privacy and safety controls'] },
    { code: 'premium', name: 'Mavora Premium', stage: 'STAGE 02 · CREATOR', color: 'premium', features: ['Premium profile and creator tools', 'Enhanced content insights', 'Identity verification required'] },
    { code: 'business_pro', name: 'Mavora Business / Pro', stage: 'STAGE 03 · BUSINESS', color: 'pro', features: ['Verified business profile', 'Products, services and insights', 'Business verification required'] }
  ];
  return <><div className="view-heading"><div><div className="eyebrow">THREE WAYS TO GROW WITH MAVORA</div><h1>Membership</h1><p>Choose your stage. Regional availability and pricing are confirmed before checkout.</p></div></div><div className="segmented billing-period">{['monthly', 'annual'].map((period) => <button className={billingPeriod === period ? 'active' : ''} onClick={() => setBillingPeriod(period)} key={period} type="button">{period === 'monthly' ? 'Monthly' : 'Annual'}</button>)}</div><div className="membership-grid">{plans.map((plan) => {
    const configuredPlan = catalog?.plans?.find((item) => item.code === plan.code);
    const price = catalog?.prices?.find((item) => item.plan_code === plan.code && item.country_code === countryCode && item.billing_period === billingPeriod && (!profile?.preferred_currency || item.currency === profile.preferred_currency));
    const priceLabel = plan.code === 'free' ? 'Always free' : price ? `${price.currency} ${Number(price.amount).toLocaleString()} / ${billingPeriod}` : 'Regional pricing';
    return <article className={`plan-card panel ${selected === plan.name ? 'selected' : ''}`} key={plan.code}><div className={`plan-symbol ${plan.color}`}>{plan.color === 'free' ? '○' : plan.color === 'premium' ? '✦' : '◇'}</div><span className="eyebrow">{configuredPlan ? `STAGE 0${configuredPlan.stage} · ${plan.stage.split('·')[1].trim().split(' ')[0]}` : plan.stage}</span><h2>{configuredPlan?.display_name || plan.name}</h2><p className="plan-price">{priceLabel}</p><ul>{plan.features.map((feature) => <li key={feature}><span>✓</span>{feature}</li>)}</ul><button className={`button ${plan.color === 'free' ? 'outline' : 'primary'} full-button`} onClick={() => { setSelected(plan.name); if (plan.code !== 'free') onCheckout?.(plan.code, billingPeriod); }} type="button">{plan.color === 'free' ? 'Current stage' : onCheckout ? price ? 'Continue to checkout' : 'Pricing unavailable' : selected === plan.name ? 'Selected for review' : 'Explore this stage'}</button></article>;
  })}</div><div className="notice panel"><span>ⓘ</span><p>Payment and identity checks are separate. Mavora verifies every payment server-to-server before activating an entitlement.</p></div></>;
}

function KycView({ applications = [], onSubmitApplication }) {
  const [localStatuses, setLocalStatuses] = useState({});
  const getStatus = (type) => applications.find((item) => item.application_type === type)?.status || localStatuses[type] || 'not_started';
  const submit = (type) => {
    if (onSubmitApplication) return onSubmitApplication(type);
    setLocalStatuses((current) => ({ ...current, [type]: 'in_review' }));
  };
  const individualStatus = getStatus('individual');
  const businessStatus = getStatus('business');
  const statusLabel = (status) => status === 'not_started' ? 'Not started' : status.replaceAll('_', ' ');
  return <><div className="view-heading"><div><div className="eyebrow">IDENTITY, HANDLED WITH CARE</div><h1>Verification</h1><p>Only required for selected services. Your documents are never collected in this preview.</p></div></div><div className="verification-layout"><section className="verification-card panel"><div className="verification-icon">▧</div><span className="eyebrow">INDIVIDUAL VERIFICATION</span><h2>Verify your identity</h2><p>Securely confirm your identity to access eligible Premium features. A vetted provider handles document checks in production.</p><div className="status-line"><span>Status</span><strong className={`status-pill ${individualStatus === 'not_started' ? '' : 'pending'}`}>{statusLabel(individualStatus)}</strong></div><button className="button primary full-button" onClick={() => submit('individual')} disabled={individualStatus === 'submitted' || individualStatus === 'in_review'}>{individualStatus === 'not_started' ? 'Start secure verification' : 'Application submitted'}</button><small>Provider, retention and regional availability are confirmed before launch.</small></section><section className="verification-card panel"><div className="verification-icon business-icon">◇</div><span className="eyebrow">BUSINESS VERIFICATION</span><h2>Verify an organisation</h2><p>Confirm your organisation and authorised representative before activating Business / Pro tools.</p><div className="status-line"><span>Status</span><strong className={`status-pill ${businessStatus === 'not_started' ? '' : 'pending'}`}>{statusLabel(businessStatus)}</strong></div><button className="button outline full-button" onClick={() => submit('business')} disabled={businessStatus === 'submitted' || businessStatus === 'in_review'}>Prepare business verification</button></section></div><div className="privacy-callout"><span>◈</span><p><strong>Minimal by design.</strong> Mavora stores the verification outcome and provider reference where possible, not raw identity documents.</p></div></>;
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
  return <><div className="view-heading"><div><div className="eyebrow">{preview ? 'LOCAL PREVIEW · SAMPLE QUEUE' : 'RESTRICTED STAFF WORKSPACE'}</div><h1>Approval desk</h1><p>{preview ? 'Sample decisions only. Nothing is sent to Mavora.' : 'Decisions are permission-checked and audited by the server.'}</p></div><span className="queue-count">{items.length} in review</span></div><div className="approval-layout"><section className="approval-queue panel"><div className="section-title"><div><span className="eyebrow">VERIFICATION QUEUE</span><h2>Needs a decision</h2></div><button className="quiet-button">All requests⌄</button></div>{items.length ? items.map((item) => <article className="approval-item" key={item.id || item.name}><Avatar image={item.image} name={item.name}/><div className="approval-info"><strong>{item.name}</strong><span>{item.type}</span><small>{item.detail}</small></div><div className="approval-buttons"><button type="button" className="button outline small-button" onClick={() => decide(item, 'needs_more_information', 'additional_information')}>Request info</button><button type="button" className="button outline small-button" onClick={() => decide(item, 'rejected', 'verification_failed')}>Reject</button><button type="button" className="button primary small-button" onClick={() => decide(item, 'verified')}>Approve</button></div></article>) : <div className="empty-state">The review queue is clear.</div>}</section><aside className="audit-card panel"><span className="eyebrow">AUDIT FIRST</span><h2>Every decision leaves a trail.</h2><p>Production decisions require a separate reviewer, a reason category, timestamp and audit record.</p><div className="audit-stat"><strong>{String(items.length).padStart(2, '0')}</strong><span>pending reviews</span></div><div className="audit-stat"><strong>API</strong><span>permission checked</span></div></aside></div></>;
}

function SupportView({ faqOnly = false }) {
  const [question, setQuestion] = useState('');
  const [asked, setAsked] = useState([]);
  const faqs = ['How do I make my profile private?', 'How does identity verification work?', 'How do I report a suspicious account?'];
  return <><div className="view-heading"><div><div className="eyebrow">{faqOnly ? 'ANSWERS, WITHOUT THE RUNAROUND' : 'HERE WHEN YOU NEED A HAND'}</div><h1>{faqOnly ? 'Help & FAQ' : 'AI Support'}</h1><p>{faqOnly ? 'Clear answers about your account, safety and membership.' : 'Ask about Mavora. For sensitive issues, we’ll help you reach a person.'}</p></div></div><div className="support-layout"><section className="support-main panel"><div className="support-head"><div className="support-spark">✦</div><div><strong>{faqOnly ? 'Frequently asked' : 'Mavora Support'}</strong><span>{faqOnly ? 'Help centre · Updated recently' : 'AI assistant · Human escalation available'}</span></div></div>{faqOnly ? <div className="faq-list">{faqs.map((item, index) => <details key={item}><summary><span>0{index + 1}</span>{item}<b>＋</b></summary><p>{index === 0 ? 'Open Your profile, choose Privacy, then set account visibility to Private. Existing followers remain approved until you remove them.' : index === 1 ? 'Verification is required only for selected services. A reviewed provider handles identity checks; Mavora stores the minimum verification outcome needed.' : 'Open the account or content menu and choose Report. You can also block the account immediately from its profile.'}</p></details>)}</div> : <><div className="assistant-message"><span className="assistant-avatar">✦</span><p>Hi Ada. I can help you find settings, understand membership, or get support with a safety concern. What’s on your mind?</p></div>{asked.map((item, index) => <React.Fragment key={index}><div className="user-message">{item}</div><div className="assistant-message"><span className="assistant-avatar">✦</span><p>I can point you in the right direction. For account-specific or sensitive issues, please use the human support path in Security Centre.</p></div></React.Fragment>)}<div className="prompt-chips">{['Privacy settings', 'Premium plans', 'Report a scam'].map((item) => <button type="button" onClick={() => setAsked([...asked, item])} key={item}>{item} ↗</button>)}</div><form className="support-input" onSubmit={(event) => { event.preventDefault(); if (question.trim()) { setAsked([...asked, question.trim()]); setQuestion(''); } }}><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask a question..."/><button type="submit" aria-label="Send question">↗</button></form><small className="support-note">AI-generated guidance can be wrong. It cannot decide KYC, fraud, account enforcement or payment disputes.</small></>}</section><aside className="support-sidebar panel"><span className="eyebrow">POPULAR TOPICS</span>{['Your account', 'Privacy & safety', 'Membership & billing', 'Groups & community'].map((item, index) => <button className="topic-link" key={item} type="button"><span>{['◍', '◈', '✦', '◫'][index]}</span>{item}<b>↗</b></button>)}<div className="human-help"><span>PERSONAL SUPPORT</span><strong>Need a human?</strong><p>Reach our support team for account-specific help.</p><button className="text-link" type="button">Open a support case ↗</button></div></aside></div></>;
}

function ProfileView({ isPrivate, setIsPrivate, following }) {
  const [tab, setTab] = useState('Posts');
  return <><div className="profile-cover"><div className="cover-lines"/><span className="profile-edit">Edit profile ↗</span></div><section className="profile-summary panel"><Avatar image="photo-1534528741775-53994a69daeb" name="Ada Okafor" size="profile"/><div className="profile-details"><div className="profile-name-row"><div><h1>Ada Okafor <span className="verified">✦</span></h1><span>@adaokafor · Lagos, Nigeria</span></div><button className={`privacy-toggle ${isPrivate ? 'on' : ''}`} onClick={() => setIsPrivate(!isPrivate)} type="button"><span>{isPrivate ? '◈' : '◎'}</span>{isPrivate ? 'Private account' : 'Public account'}<i /></button></div><p>Collecting places, people and small moments. Designer, occasional ocean chaser.</p><div className="profile-stats"><span><strong>128</strong> posts</span><span><strong>2.4k</strong> followers</span><span><strong>{following.length}</strong> following</span></div></div></section><div className="profile-tabs">{['Posts', 'Stories', 'About', 'Friends'].map((item) => <button type="button" className={tab === item ? 'active' : ''} onClick={() => setTab(item)} key={item}>{item}</button>)}</div><div className="profile-content panel"><span className="eyebrow">{tab.toUpperCase()}</span><h2>{tab === 'Posts' ? 'A little more of Ada.' : tab === 'Stories' ? 'The last 24 hours.' : tab === 'About' ? 'The details that make a person.' : 'People in Ada’s circle.'}</h2><p>{isPrivate ? 'Your account is private. Only approved followers can see protected posts and profile details.' : 'Your profile is public. Posts still follow their own audience settings.'}</p><div className="profile-photo-grid">{['photo-1473116763249-2faaef81ccda', 'photo-1500530855697-b586d89ba3ee', 'photo-1470252649378-9c29740c9fa8'].map((image) => <img src={imageUrl(image, 400, 400)} alt="Ada’s recent post" key={image}/>)}</div></div></>;
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
  return <><div className="view-heading"><div><div className="eyebrow">{privacy ? 'YOUR DATA, YOUR DECISIONS' : 'A QUIETER KIND OF CONFIDENCE'}</div><h1>{privacy ? 'Privacy Centre' : 'Security Centre'}</h1><p>{privacy ? 'Understand and shape how Mavora uses your information.' : 'A clear view of your account protection and recent activity.'}</p></div></div><div className="centre-layout"><section className="settings-list panel">{groups.map((item) => <div className="setting-row" key={item.key}><div className="setting-icon">{privacy ? '◈' : '⌑'}</div><div className="setting-description"><strong>{item.title}</strong><span>{item.detail}</span></div>{item.key === 'data' || item.key === 'sessions' || item.key === 'apps' ? <button className="text-link" type="button">{item.value} ↗</button> : item.key === 'privateAccount' ? <button className={`switch ${isPrivate ? 'enabled' : ''}`} role="switch" aria-checked={isPrivate} aria-label={item.title} onClick={() => setIsPrivate(!isPrivate)}><i /></button> : <button className={`switch ${settings[item.key] ? 'enabled' : ''}`} role="switch" aria-checked={settings[item.key]} aria-label={item.title} onClick={() => setSettings({ ...settings, [item.key]: !settings[item.key] })}><i /></button>}</div>)}</section><aside className="security-card panel"><div className="security-emblem">{privacy ? '◈' : '✦'}</div><span className="eyebrow">{privacy ? 'PRIVACY SNAPSHOT' : 'ACCOUNT HEALTH'}</span><h2>{privacy ? 'You’re in control.' : 'Your account is in good shape.'}</h2><p>{privacy ? 'Review visibility and data choices at any time. Changes should be clear, reversible and respected.' : 'Two-step verification and login alerts are active on this demo account.'}</p><button className="text-link">{privacy ? 'Read privacy notice' : 'Review recent activity'} ↗</button></aside></div><p className="disclaimer">Controls shown here are prototype interactions. Production settings must be enforced by authenticated server policies.</p></>;
}

function Sidebar({ view, setView, onSignOut, preview, staffAccess }) {
  return <aside className="desktop-sidebar"><a className="wordmark" href="#home" onClick={(event) => { event.preventDefault(); setView('home'); }}>MAV<span>O</span>RA<small>social</small></a><button className="account-chip" type="button"><Avatar image="photo-1534528741775-53994a69daeb" name="Ada Okafor"/><span><strong>Ada Okafor</strong><small>{preview ? 'Local preview' : 'Your account'}</small></span><b>⌄</b></button><div className="side-nav">{navigation.map((group) => <div className="nav-group" key={group.section}><div className="nav-caption">{group.section}</div>{group.items.map(([id, icon, label]) => <button className={`side-link ${view === id ? 'active' : ''}`} type="button" key={id} onClick={() => setView(id)}><span className="side-icon">{icon}</span>{label}{id === 'messages' && <i className="unread-dot"/>}</button>)}</div>)}{(preview || staffAccess) && <div className="nav-group"><div className="nav-caption">{preview ? 'STAFF PREVIEW' : 'STAFF WORKSPACE'}</div><button className={`side-link ${view === 'approvals' ? 'active' : ''}`} type="button" onClick={() => setView('approvals')}><span className="side-icon">⌑</span>Approval desk{preview && <span className="staff-badge">DEMO</span>}</button></div>}</div><div className="sidebar-bottom"><button className="side-link" onClick={() => setView('privacy')} type="button"><span className="side-icon">◈</span>Privacy settings</button><button className="side-link" onClick={onSignOut} type="button"><span className="side-icon">↗</span>{preview ? 'Exit preview' : 'Sign out'}</button></div></aside>;
}

function RightRail({ view, toggleFollowing, following }) {
  return <aside className="right-rail"><div className="rail-block profile-nudge"><div className="rail-heading"><span className="eyebrow">YOUR SPACE</span><button type="button" className="text-link">Edit</button></div><div className="mini-profile"><Avatar image="photo-1534528741775-53994a69daeb" name="Ada Okafor" size="large"/><div><strong>Ada Okafor</strong><span>Lagos, Nigeria</span></div></div><div className="profile-progress"><div><span>Profile</span><strong>72%</strong></div><div className="progress-track"><i/></div><small>Add a few details to help your circles find you.</small></div></div><div className="rail-block"><div className="rail-heading"><div><span className="eyebrow">GOOD PEOPLE</span><h3>Suggested for you</h3></div><button type="button" className="text-link">All</button></div>{people.map((person) => <div className="suggested-person" key={person.name}><Avatar image={person.image} name={person.name}/><div><strong>{person.name}</strong><span>{person.detail}</span></div><button type="button" className="plus-follow" onClick={() => toggleFollowing(person.name)} aria-label={following.includes(person.name) ? `Unfollow ${person.name}` : `Follow ${person.name}`}>{following.includes(person.name) ? '✓' : '＋'}</button></div>)}</div><div className="rail-promo"><span className="promo-star">✦</span><span className="eyebrow">A LITTLE MORE ROOM TO GROW</span><h3>Make more of what you share.</h3><p>Explore creator tools with Mavora Premium.</p><button type="button" onClick={() => window.dispatchEvent(new CustomEvent('mavora:navigate', { detail: 'membership' }))}>Explore Premium ↗</button></div><footer className="rail-footer">About · Community · Privacy · Terms<br/>© 2026 Mavora Social</footer></aside>;
}

export default function SocialShell({ preview, onExit, accessToken }) {
  const [view, setView] = useState('home');
  const [liked, setLiked] = useState([]);
  const [following, setFollowing] = useState(['Nia Adebayo']);
  const [isPrivate, setIsPrivate] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [search, setSearch] = useState('');
  const [remoteProfile, setRemoteProfile] = useState(null);
  const [remotePosts, setRemotePosts] = useState(null);
  const [membershipCatalog, setMembershipCatalog] = useState(null);
  const [kycApplications, setKycApplications] = useState([]);
  const [capabilities, setCapabilities] = useState([]);
  const [approvalApplications, setApprovalApplications] = useState([]);
  const [apiNotice, setApiNotice] = useState('');
  const mobileItems = [['home', '⌂', 'Home'], ['friends', '◉', 'Circles'], ['create', '＋', 'Create'], ['messages', '✉', 'Inbox'], ['profile', '◍', 'You']];

  useEffect(() => {
    if (preview || !accessToken) {
      setRemoteProfile(null);
      setRemotePosts(null);
      setMembershipCatalog(null);
      setKycApplications([]);
      setCapabilities([]);
      setApprovalApplications([]);
      return undefined;
    }

    let active = true;
    Promise.allSettled([
      apiRequest('/api/me/security', accessToken),
      apiRequest('/api/social/feed', accessToken),
      apiRequest('/api/membership/plans', accessToken),
      apiRequest('/api/me/capabilities', accessToken)
    ]).then(([accountResult, feedResult, catalogResult, capabilityResult]) => {
      if (!active) return;
      const failures = [];
      if (accountResult.status === 'fulfilled') {
        setRemoteProfile(accountResult.value.profile);
        setIsPrivate(Boolean(accountResult.value.profile?.is_private));
        setKycApplications(accountResult.value.kycApplications || []);
      } else failures.push(accountResult.reason.message);
      if (feedResult.status === 'fulfilled') setRemotePosts(feedResult.value.posts || []);
      else failures.push(feedResult.reason.message);
      if (catalogResult.status === 'fulfilled') setMembershipCatalog(catalogResult.value);
      else failures.push(catalogResult.reason.message);
      if (capabilityResult.status === 'fulfilled') setCapabilities(capabilityResult.value.permissions || []);
      else failures.push(capabilityResult.reason.message);
      setApiNotice(failures[0] || '');
    });
    return () => { active = false; };
  }, [accessToken, preview]);

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

  async function updatePrivacy(nextValue) {
    const previousValue = isPrivate;
    setIsPrivate(nextValue);
    setApiNotice('');
    if (preview || !accessToken) return;
    try {
      const result = await apiRequest('/api/me/profile', accessToken, {
        method: 'PATCH',
        body: { is_private: nextValue }
      });
      setRemoteProfile((current) => ({ ...current, ...result.profile }));
    } catch (error) {
      setIsPrivate(previousValue);
      setApiNotice(error.message);
    }
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
    window.addEventListener('mavora:navigate', handler);
    return () => window.removeEventListener('mavora:navigate', handler);
  }, []);

  const toggleFollowing = (name) => setFollowing((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]);
  const titles = { home: 'For you', friends: 'Circles', reels: 'Reels', messages: 'Messages', groups: 'Groups', business: 'Business', profile: 'Your profile', membership: 'Membership', kyc: 'Verification', approvals: 'Approval desk', support: 'AI Support', faq: 'Help & FAQ', security: 'Security Centre', privacy: 'Privacy Centre' };

  return <div className="mavora-app">
    <Sidebar view={view} setView={navigate} onSignOut={onExit} preview={preview} staffAccess={capabilities.includes('kyc.read')}/>
    <div className="app-body"><header className="topbar"><button className="mobile-brand" onClick={() => navigate('home')} type="button">MAV<span>O</span>RA</button><div className="global-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search people, circles and ideas" aria-label="Search Mavora"/><kbd>⌘ K</kbd></div><div className="top-actions"><button className="top-create" onClick={() => navigate('home')} type="button"><span>＋</span> Create</button><IconButton label="Notifications" className="notification-button">◌<i/></IconButton><button className="top-avatar" onClick={() => navigate('profile')} type="button"><Avatar image="photo-1534528741775-53994a69daeb" name="Ada Okafor"/></button></div></header>
      {preview && <div className="preview-banner"><span>LOCAL PREVIEW</span> Sample people and interactions only. No account data is changed.<button onClick={onExit} type="button">Exit preview <b>×</b></button></div>}
      {!preview && apiNotice && <div className="backend-notice" role="status">Backend notice: {apiNotice}</div>}
      <div className="workspace"><main className="main-column" aria-label={titles[view]}>
        {view === 'home' && <HomeView liked={liked} setLiked={setLiked} following={following} toggleFollowing={toggleFollowing} remotePosts={remotePosts} onCreatePost={accessToken && !preview ? createPost : undefined}/>}
        {view === 'friends' && <FriendsView following={following} toggleFollowing={toggleFollowing}/>}
        {view === 'messages' && <MessagesView/>}
        {view === 'groups' && <GroupsView/>}
        {view === 'reels' && <ReelsView/>}
        {view === 'business' && <BusinessView/>}
        {view === 'membership' && <MembershipView catalog={membershipCatalog} profile={remoteProfile} onCheckout={accessToken && !preview ? startCheckout : undefined}/>}
        {view === 'kyc' && <KycView applications={kycApplications} onSubmitApplication={accessToken && !preview ? submitKyc : undefined}/>}
        {view === 'approvals' && (preview || capabilities.includes('kyc.read')) && <ApprovalView preview={preview} applications={approvalApplications} onReview={reviewKyc}/>}
        {view === 'support' && <SupportView/>}
        {view === 'faq' && <SupportView faqOnly/>}
        {view === 'profile' && <ProfileView isPrivate={isPrivate} setIsPrivate={updatePrivacy} following={following}/>}
        {view === 'security' && <CentreView/>}
        {view === 'privacy' && <CentreView privacy isPrivate={isPrivate} setIsPrivate={updatePrivacy}/>}
        {view === 'create' && <HomeView liked={liked} setLiked={setLiked} following={following} toggleFollowing={toggleFollowing} remotePosts={remotePosts} onCreatePost={accessToken && !preview ? createPost : undefined}/>}
      </main><RightRail view={view} toggleFollowing={toggleFollowing} following={following}/></div>
      <nav className="mobile-nav" aria-label="Primary navigation">{mobileItems.map(([id, icon, label]) => <button className={view === id || (id === 'create' && view === 'home') ? 'active' : ''} key={id} type="button" onClick={() => id === 'create' ? navigate('home') : navigate(id)}><span>{icon}</span>{label}</button>)}</nav>
      <button className="mobile-more" onClick={() => setMobileMenu(!mobileMenu)} type="button" aria-label="More sections">{mobileMenu ? '×' : '···'}</button>
      {mobileMenu && <div className="mobile-menu">{navigation.flatMap((group) => group.items).map(([id, icon, label]) => <button key={id} type="button" onClick={() => navigate(id)}><span>{icon}</span>{label}</button>)}{(preview || capabilities.includes('kyc.read')) && <button type="button" onClick={() => navigate('approvals')}><span>⌑</span>Approval desk</button>}</div>}
    </div>
  </div>;
}