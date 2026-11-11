import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  ImageBackground,
  Linking,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { apiRequest } from './lib/api';

const colors = {
  background: '#0a101c',
  surface: '#111b2b',
  elevated: '#172438',
  line: '#293448',
  text: '#eff3fc',
  muted: '#98a6bb',
  dim: '#718097',
  violet: '#b69cff',
  teal: '#5be3cf'
};

const people = [
  { name: 'Ada Okafor', subtitle: 'Lagos · Designer', photo: 'photo-1534528741775-53994a69daeb' },
  { name: 'Nia Adebayo', subtitle: 'Accra · Illustrator', photo: 'photo-1524504388940-b1c1722653e1' },
  { name: 'Malik Bello', subtitle: 'Lagos · Photographer', photo: 'photo-1500648767791-00dcc994a43e' },
  { name: 'Emeka Obi', subtitle: 'Building in public', photo: 'photo-1506794778202-cad84cf45f1d' }
];

const img = (photo, width = 300, height = width) => ({
  uri: photo?.startsWith('https://') ? photo : `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=${width}&h=${height}&q=82`
});

const sections = [
  ['Reels', '▶'], ['Groups', '◫'], ['Business', '◇'], ['Followers', '◉'], ['Following', '◎'], ['Friend requests', '↗'], ['Membership', '✦'],
  ['Verification', '▧'], ['Approval desk', '⌑'], ['AI Support', '?'],
  ['Help & FAQ', '≡'], ['Security Centre', '⌑'], ['Privacy Centre', '◈']
];

function Label({ children, style }) {
  return <Text style={[s.eyebrow, style]}>{children}</Text>;
}

function Button({ children, onPress, secondary = false, style, textStyle }) {
  return <Pressable onPress={onPress} style={[s.button, secondary && s.secondaryButton, style]}><Text style={[s.buttonText, secondary && s.secondaryButtonText, textStyle]}>{children}</Text></Pressable>;
}

function Avatar({ photo, size = 40 }) {
  return <Image source={img(photo)} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.elevated }} />;
}

export default function SocialExperience({ preview, onExit, accessToken }) {
  const [view, setView] = useState('Home');
  const [menuOpen, setMenuOpen] = useState(false);
  const [following, setFollowing] = useState(['Nia Adebayo']);
  const [liked, setLiked] = useState(false);
  const [draft, setDraft] = useState('');
  const [posts, setPosts] = useState([
    { name: 'Ada Okafor', photo: 'photo-1534528741775-53994a69daeb', when: 'Lagos · 18 min ago', text: 'Found a little quiet between the city and the sea. Keeping this one. #weekendnotes', image: 'photo-1473116763249-2faaef81ccda', caption: 'Somewhere on the coast', likes: '284', replies: '32' },
    { name: 'Malik Bello', photo: 'photo-1500648767791-00dcc994a43e', when: 'Yaba, Lagos · 1 hr ago', text: 'A few frames from a morning that started without a plan.', image: 'photo-1519608487953-e999c86e7455', caption: 'Before the city woke', likes: '96', replies: '14' }
  ]);
  const [joined, setJoined] = useState([]);
  const [kycStatus, setKycStatus] = useState('Not started');
  const [kycBusinessStatus, setKycBusinessStatus] = useState('Not started');
  const [billingPeriod, setBillingPeriod] = useState('monthly');
  const [approvalItems, setApprovalItems] = useState(['Abeni Objects · Business / Pro', 'Kofi Mensah · Premium']);
  const [messageDraft, setMessageDraft] = useState('');
  const [messages, setMessages] = useState(['Hey, I sent you the studio photos. The light came out beautifully.', 'Just saw them. That afternoon glow is everything.']);
  const [supportDraft, setSupportDraft] = useState('');
  const [supportAsked, setSupportAsked] = useState([]);
  const [expandedFaq, setExpandedFaq] = useState(-1);
  const [reelPlaying, setReelPlaying] = useState(false);
  const [settings, setSettingsState] = useState({ twoFactor: true, loginAlerts: true, requests: false, suggestions: true, activityStatus: false });
  const privateAccount = settings.activityStatus;
  const [remoteProfile, setRemoteProfile] = useState(null);
  const [remotePosts, setRemotePosts] = useState(null);
  const [membershipCatalog, setMembershipCatalog] = useState(null);
  const [kycApplications, setKycApplications] = useState([]);
  const [capabilities, setCapabilities] = useState([]);
  const [approvalApplications, setApprovalApplications] = useState([]);
  const [apiNotice, setApiNotice] = useState('');

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
        setSettingsState((current) => ({ ...current, activityStatus: Boolean(accountResult.value.profile?.is_private) }));
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
    if (preview || !accessToken || view !== 'Approval desk' || !capabilities.includes('kyc.read')) return undefined;
    let active = true;
    apiRequest('/api/admin/kyc', accessToken)
      .then((result) => { if (active) setApprovalApplications(result.applications || []); })
      .catch((error) => { if (active) setApiNotice(error.message); });
    return () => { active = false; };
  }, [accessToken, capabilities, preview, view]);

  const navigate = (next) => {
    setView(next);
    setMenuOpen(false);
  };

  function toggleFollow(name) {
    setFollowing((current) => current.includes(name) ? current.filter((entry) => entry !== name) : [...current, name]);
  }

  async function sharePost() {
    if (!draft.trim()) return;
    const body = draft.trim();
    setDraft('');
    if (accessToken && !preview) {
      try {
        const result = await apiRequest('/api/social/posts', accessToken, {
          method: 'POST',
          body: { body, visibility: 'friends', mediaUrls: [] }
        });
        const post = result.post;
        setRemotePosts((current) => [{
          id: post.id,
          name: remoteProfile?.display_name || 'You',
          photo: remoteProfile?.avatar_url || people[0].photo,
          when: 'Just now',
          text: post.body,
          image: people[0].photo,
          caption: '',
          likes: '0',
          replies: '0'
        }, ...(current || [])]);
      } catch (error) {
        setApiNotice(error.message);
      }
      return;
    }
    setPosts([{ name: 'You', photo: people[0].photo, when: 'Just now', text: body, image: 'photo-1473116763249-2faaef81ccda', caption: 'Shared with your circle', likes: '0', replies: '0' }, ...posts]);
  }

  async function updatePrivacy(value) {
    const previousValue = privateAccount;
    setSettingsState((current) => ({ ...current, activityStatus: value }));
    if (preview || !accessToken) return;
    try {
      const result = await apiRequest('/api/me/profile', accessToken, {
        method: 'PATCH',
        body: { is_private: value }
      });
      setRemoteProfile((current) => ({ ...current, ...result.profile }));
      setApiNotice('');
    } catch (error) {
      setSettingsState((current) => ({ ...current, activityStatus: previousValue }));
      setApiNotice(error.message);
    }
  }

  function setSettings(next) {
    const updated = typeof next === 'function' ? next(settings) : next;
    if (updated.activityStatus !== settings.activityStatus) {
      setSettingsState({ ...updated, activityStatus: settings.activityStatus });
      updatePrivacy(updated.activityStatus);
      return;
    }
    setSettingsState(updated);
  }

  const setPrivateAccount = updatePrivacy;

  async function submitKyc(applicationType) {
    if (preview || !accessToken) {
      if (applicationType === 'business') setKycBusinessStatus('In review');
      else setKycStatus('In review');
      return;
    }
    try {
      const result = await apiRequest('/api/me/kyc', accessToken, {
        method: 'POST',
        body: { applicationType }
      });
      setKycApplications((current) => [result.application, ...current]);
      setApiNotice('');
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
      await Linking.openURL(result.checkoutUrl);
    } catch (error) {
      setApiNotice(error.message);
    }
  }

  function personRow(person, action = 'follow') {
    const isFollowing = following.includes(person.name);
    return <View style={s.personRow} key={person.name}><Avatar photo={person.photo} size={42} /><View style={s.personCopy}><Text style={s.personName}>{person.name}</Text><Text style={s.personSub}>{person.subtitle}</Text></View><Pressable style={[s.smallAction, isFollowing && s.smallActionOn]} onPress={() => toggleFollow(person.name)}><Text style={[s.smallActionText, isFollowing && s.smallActionTextOn]}>{isFollowing ? 'Following' : action === 'request' ? 'Accept' : '+ Follow'}</Text></Pressable></View>;
  }

  function renderHome() {
    const visiblePosts = remotePosts === null ? posts : remotePosts.map((post) => ({
      name: post.author?.display_name || post.author?.username || 'Mavora member',
      photo: post.author?.avatar_url || people[0].photo,
      when: post.createdAt ? new Date(post.createdAt).toLocaleString() : 'Recently',
      text: post.body || '',
      image: post.mediaUrls?.[0] || null,
      caption: post.mediaUrls?.length ? 'Shared with your circle' : '',
      likes: '0',
      replies: '0'
    }));
    return <>
      <View style={s.welcomeHeading}><View><Label>WEDNESDAY, NOVEMBER 11</Label><Text style={s.pageTitle}>The near &amp; now</Text><Text style={s.pageSub}>Your people, in their own words.</Text></View><Text style={s.liveLabel}>● CIRCLE</Text></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.stories}>
        <Pressable style={s.story} onPress={() => setView('Create')}><View style={s.addStory}><Text style={s.addStoryText}>＋</Text></View><Text style={s.storyName}>Your story</Text></Pressable>
        {people.slice(1).map((person, index) => <Pressable style={s.story} key={person.name} onPress={() => Alert.alert('Story preview', `${person.name}'s story will appear here.`)}><View style={[s.storyRing, index === 1 && s.storyRingTeal]}><Avatar photo={person.photo} size={46} /></View><Text style={s.storyName}>{person.name.split(' ')[0]}</Text></Pressable>)}
      </ScrollView>
      <View style={s.composer}><View style={s.composerTop}><Avatar photo={people[0].photo} size={36}/><TextInput value={draft} onChangeText={setDraft} placeholder="What would you like to share?" placeholderTextColor={colors.dim} style={s.composerInput} multiline/></View><View style={s.composerBottom}><Text style={s.audience}>◈  Friends</Text><Button onPress={sharePost} style={s.shareButton}>Share ↗</Button></View></View>
      <View style={s.sectionHeading}><View><Label>YOUR FEED</Label><Text style={s.sectionTitle}>From your circles</Text></View><Text style={s.sortLabel}>For you ⌄</Text></View>
      {visiblePosts.map((post, index) => <View style={s.post} key={post.id || `${post.name}-${index}`}><View style={s.postHead}><Avatar photo={post.photo} size={38}/><View style={s.postIdentity}><Text style={s.postName}>{post.name} <Text style={s.verified}>✦</Text></Text><Text style={s.postTime}>{post.when}</Text></View><Text style={s.ellipsis}>•••</Text></View><Text style={s.postCopy}>{post.text}</Text>{post.image && <ImageBackground source={img(post.image, 900, 600)} style={s.postImage} imageStyle={s.postImageRadius}><View style={s.imageCaption}><Text style={s.imageCaptionText}>{post.caption}</Text></View></ImageBackground>}<View style={s.reactionSummary}><Text style={s.reactionMarks}>♥ ✦</Text><Text style={s.reactionText}>{post.likes} appreciations</Text><Text style={s.replyText}>{post.replies} replies</Text></View><View style={s.postActions}><Pressable onPress={() => setLiked(!liked)}><Text style={[s.postActionText, liked && s.liked]}>♡  Appreciate</Text></Pressable><Pressable><Text style={s.postActionText}>◯  Reply</Text></Pressable><Pressable><Text style={s.postActionText}>↗  Share</Text></Pressable><Pressable><Text style={s.postActionText}>◇</Text></Pressable></View></View>)}
    </>;
  }

  function renderCircles() {
    return <><View style={s.pageHeading}><Label>YOUR PEOPLE, YOUR PACE</Label><Text style={s.pageTitle}>Circles</Text><Text style={s.pageSub}>Friendship and following, kept intentionally separate.</Text></View><View style={s.segmentRow}><Text style={s.segmentActive}>Discover</Text><Text style={s.segment}>Requests <Text style={s.requestCount}>2</Text></Text><Text style={s.segment}>Following</Text></View>{people.slice(1).map((person, index) => <View style={s.friendCard} key={person.name}><ImageBackground source={img(['photo-1470252649378-9c29740c9fa8', 'photo-1500530855697-b586d89ba3ee', 'photo-1497250681960-ef046c08a56e'][index], 700, 220)} style={s.friendCover}/><View style={s.friendBody}><View style={s.friendMain}>{personRow(person)}</View><Text style={s.mutuals}>●●●  {12 + index * 6} mutuals · Good conversations start somewhere.</Text><Button secondary style={s.friendButton}>Send friend request</Button></View></View>)}</>;
  }

  function renderRelationshipList(title) {
    const list = title === 'Following' ? people.filter((person) => following.includes(person.name)) : title === 'Friend requests' ? people.slice(2) : people.slice(1);
    const action = title === 'Friend requests' ? 'request' : 'follower';
    return <><View style={s.pageHeading}><Label>YOUR PEOPLE, YOUR PACE</Label><Text style={s.pageTitle}>{title}</Text><Text style={s.pageSub}>Friendship and following are managed separately.</Text></View><View style={s.infoCard}>{list.map((person) => <View key={person.name}>{personRow(person, action)}<View style={s.relationshipDivider}/></View>)}</View><Text style={s.footnote}>Local preview only. Follow and friend states are not synchronized to Mavora.</Text></>;
  }

  function renderMessages() {
    return <><View style={s.pageHeading}><Label>PRIVATE BY DESIGN</Label><Text style={s.pageTitle}>Messages</Text><Text style={s.pageSub}>Good conversations, in a space of their own.</Text></View><View style={s.chatCard}><View style={s.chatProfile}><Avatar photo={people[1].photo} size={39}/><View style={s.personCopy}><Text style={s.personName}>Nia Adebayo</Text><Text style={s.online}><Text style={{ color: colors.teal }}>● </Text>Active recently</Text></View><Text style={s.ellipsis}>···</Text></View><View style={s.chatHistory}><Text style={s.dayLabel}>TODAY</Text><View style={s.messageReceived}><Text style={s.messageText}>Hey, I sent you the studio photos. The light came out beautifully.</Text></View><View style={s.messageSent}><Text style={s.messageText}>Just saw them. That afternoon glow is everything.</Text></View>{messages.map((message, index) => index > 1 && <View style={s.messageSent} key={index}><Text style={s.messageText}>{message}</Text></View>)}</View><View style={s.messageEntry}><Text style={s.attach}>＋</Text><TextInput value={messageDraft} onChangeText={setMessageDraft} placeholder="Write a message" placeholderTextColor={colors.dim} style={s.messageInput}/><Pressable onPress={() => { if (messageDraft.trim()) { setMessages([...messages, messageDraft.trim()]); setMessageDraft(''); } }} style={s.sendMessage}><Text style={s.sendText}>↗</Text></Pressable></View></View><Text style={s.footnote}>Messages are a local prototype. Participant authorization and realtime delivery are not connected.</Text></>;
  }

  function renderGroups() {
    const groups = [
      ['The Sunday Table', '2.4k members', 'Food stories, family recipes and the places that bring us together.', 'photo-1517248135467-4c7edcad34c4'],
      ['Build in the Open', '864 members', 'A thoughtful corner for makers, founders and curious minds.', 'photo-1521737711867-e3b97375f902'],
      ['Lagos Photo Walks', '1.2k members', 'A community-led map of small moments across the city.', 'photo-1473116763249-2faaef81ccda']
    ];
    return <><View style={s.pageHeading}><Label>GATHER AROUND SOMETHING</Label><Text style={s.pageTitle}>Groups</Text><Text style={s.pageSub}>Communities shaped by what you care about.</Text></View><Button style={s.createGroup}>＋ Create a group</Button>{groups.map(([name, count, desc, image]) => <View style={s.groupCard} key={name}><Image source={img(image, 760, 360)} style={s.groupImage}/><View style={s.groupBody}><Label>{count.toUpperCase()} · OPEN CIRCLE</Label><Text style={s.cardTitle}>{name}</Text><Text style={s.cardDesc}>{desc}</Text><Button secondary onPress={() => setJoined(joined.includes(name) ? joined.filter((item) => item !== name) : [...joined, name])}>{joined.includes(name) ? 'Joined' : 'Join circle'}</Button></View></View>)}</>;
  }

  function renderReels() {
    return <><View style={s.pageHeading}><Label>SHORT STORIES, FULL FEELING</Label><Text style={s.pageTitle}>Reels</Text><Text style={s.pageSub}>Made by your circles, not an endless algorithm.</Text></View><Pressable style={s.reel} onPress={() => setReelPlaying(!reelPlaying)}><ImageBackground source={img('photo-1470252649378-9c29740c9fa8', 900, 1200)} style={s.reelImage}><View style={s.reelShade}/><Text style={s.reelPlay}>{reelPlaying ? 'Ⅱ' : '▶'}</Text><View style={s.reelCaption}><Label>MAVORA ORIGINAL · 00:18</Label><Text style={s.reelTitle}>First light, before the world catches up.</Text><View style={s.reelCreator}><Avatar photo={people[2].photo} size={34}/><View style={s.personCopy}><Text style={s.postName}>Malik Bello</Text><Text style={s.postTime}>Accra · 2 hours ago</Text></View><Text style={s.followTag}>+ Follow</Text></View></View></ImageBackground></Pressable><View style={s.reelActionRow}><Text>♡  1.8k</Text><Text>◯  86</Text><Text>↗  Share</Text><Text>◇  Save</Text></View></>;
  }

  function renderBusiness() {
    return <><View style={s.pageHeading}><Label>MADE HERE, FOUND TOGETHER</Label><Text style={s.pageTitle}>Business</Text><Text style={s.pageSub}>Meet independent brands behind the work.</Text></View><View style={s.businessFeature}><ImageBackground source={img('photo-1441986300917-64674bd600d8', 1000, 620)} style={s.businessImage}><View style={s.businessShade}/><View style={s.businessText}><Label>FEATURED STUDIO · ACCRA</Label><Text style={s.reelTitle}>Objects with a story.</Text><Text style={s.cardDesc}>Meet House of Nuru, a small-batch home studio making everyday things worth keeping.</Text><Button style={s.lightButton}>Explore the page ↗</Button></View></ImageBackground></View><View style={s.sectionHeading}><Text style={s.sectionTitle}>Independent finds</Text><Text style={s.sortLabel}>Discover ↗</Text></View>{[['Studio Kora', 'Furniture · Lagos', 'photo-1494438639946-1ebd1d20bf85'], ['Nuru Botanics', 'Care · Accra', 'photo-1608571423902-eed4a5ad8108']].map(([name, detail, photo]) => <View style={s.businessRow} key={name}><Image source={img(photo, 180, 160)} style={s.productImage}/><View style={s.productInfo}><Text style={s.personName}>{name}</Text><Text style={s.personSub}>{detail}</Text><Text style={s.verified}>Verified business · Discover</Text></View><Text style={s.arrow}>↗</Text></View>)}</>;
  }

  function renderMembership() {
    const plans = [
      ['free', 'Mavora Free', 'STAGE 01 · PERSONAL', 'Profile, feed and circles', 'Groups, discovery and messaging', 'Privacy and safety controls'],
      ['premium', 'Mavora Premium', 'STAGE 02 · CREATOR', 'Premium profile and creator tools', 'Enhanced content insights', 'Identity verification required'],
      ['business_pro', 'Mavora Business / Pro', 'STAGE 03 · BUSINESS', 'Verified business profile', 'Products, services and insights', 'Business verification required']
    ];
    const countryCode = remoteProfile?.country_code?.trim();
    return <><View style={s.pageHeading}><Label>THREE WAYS TO GROW WITH MAVORA</Label><Text style={s.pageTitle}>Membership</Text><Text style={s.pageSub}>Regional pricing and eligibility are confirmed before checkout.</Text></View><View style={s.segmentRow}>{['monthly', 'annual'].map((period) => <Pressable key={period} onPress={() => setBillingPeriod(period)}><Text style={billingPeriod === period ? s.segmentActive : s.segment}>{period === 'monthly' ? 'Monthly' : 'Annual'}</Text></Pressable>)}</View>{plans.map((plan, index) => {
      const configuredPlan = membershipCatalog?.plans?.find((item) => item.code === plan[0]);
      const price = membershipCatalog?.prices?.find((item) => item.plan_code === plan[0] && item.country_code === countryCode && item.billing_period === billingPeriod && (!remoteProfile?.preferred_currency || item.currency === remoteProfile.preferred_currency));
      const priceLabel = plan[0] === 'free' ? 'Always free' : price ? `${price.currency} ${Number(price.amount).toLocaleString()} / ${billingPeriod}` : 'Regional pricing';
      return <View style={[s.planCard, index === 1 && s.planFeatured]} key={plan[0]}><View style={s.planTop}><Text style={[s.planIcon, index === 2 && s.planIconTeal]}>{['○', '✦', '◇'][index]}</Text><Label>{configuredPlan ? `STAGE 0${configuredPlan.stage}` : plan[2]}</Label></View><Text style={s.cardTitle}>{configuredPlan?.display_name || plan[1]}</Text><Text style={s.planPrice}>{priceLabel}</Text>{plan.slice(3).map((feature) => <Text style={s.planFeature} key={feature}><Text style={s.verified}>✓ </Text>{feature}</Text>)}<Button secondary={index === 0} style={s.planButton} onPress={() => { if (index > 0) startCheckout(plan[0], billingPeriod); }}>{index === 0 ? 'Current stage' : accessToken && !preview ? price ? 'Continue to checkout' : 'Pricing unavailable' : 'Explore this stage'}</Button></View>;
    })}<Text style={s.footnote}>Payment and identity verification are separate review steps. Mavora verifies every payment before activating an entitlement.</Text></>;
  }

  function renderVerification() {
    const individual = kycApplications.find((item) => item.application_type === 'individual');
    const business = kycApplications.find((item) => item.application_type === 'business');
    const individualStatus = individual?.status?.replaceAll('_', ' ') || kycStatus;
    const businessStatus = business?.status?.replaceAll('_', ' ') || kycBusinessStatus;
    return <><View style={s.pageHeading}><Label>IDENTITY, HANDLED WITH CARE</Label><Text style={s.pageTitle}>Verification</Text><Text style={s.pageSub}>Only for selected services. Documents are never collected in this preview.</Text></View><View style={s.infoCard}><Text style={s.planIcon}>▧</Text><Label>INDIVIDUAL VERIFICATION</Label><Text style={s.cardTitle}>Verify your identity</Text><Text style={s.cardDesc}>A vetted provider handles document checks in production. Mavora stores the minimum verification outcome needed.</Text><View style={s.statusRow}><Text style={s.personSub}>Status</Text><Text style={s.statusPill}>{individualStatus}</Text></View><Button onPress={() => submitKyc('individual')}>{individual || individualStatus !== 'Not started' ? 'Application submitted' : 'Start secure verification'}</Button></View><View style={s.infoCard}><Text style={[s.planIcon, s.planIconTeal]}>◇</Text><Label>BUSINESS VERIFICATION</Label><Text style={s.cardTitle}>Verify an organisation</Text><Text style={s.cardDesc}>Confirm the organisation and authorised representative to use Business / Pro tools.</Text><View style={s.statusRow}><Text style={s.personSub}>Status</Text><Text style={s.statusPill}>{businessStatus}</Text></View><Button secondary onPress={() => submitKyc('business')}>{business || businessStatus !== 'Not started' ? 'Application submitted' : 'Prepare business verification'}</Button></View><Text style={s.footnote}>Provider selection, regional coverage, access controls and retention terms require review before launch.</Text></>;
  }

  function renderApprovals() {
    const items = preview ? approvalItems.map((item) => ({ key: item, name: item.split(' · ')[0], type: item.split(' · ')[1], detail: 'Sample verification · preview' })) : approvalApplications.map((application) => ({
      key: application.id,
      id: application.id,
      name: `${application.application_type === 'business' ? 'Business' : 'Individual'} · ${application.applicant_id.slice(0, 8)}`,
      type: application.application_type === 'business' ? 'Business verification' : 'Individual verification',
      detail: `${application.status.replaceAll('_', ' ')} · ${new Date(application.submitted_at).toLocaleString()}`
    }));
    const decide = (item, decision, reason) => {
      if (preview) setApprovalItems((current) => current.filter((entry) => entry !== item.key));
      else reviewKyc(item.id, decision, reason);
    };
    return <><View style={s.pageHeading}><Label>{preview ? 'LOCAL PREVIEW · SAMPLE QUEUE' : 'RESTRICTED STAFF WORKSPACE'}</Label><Text style={s.pageTitle}>Approval desk</Text><Text style={s.pageSub}>{preview ? 'Sample decisions only. Nothing is sent to Mavora.' : 'Decisions are permission-checked and audited by the server.'}</Text></View><View style={s.infoCard}><Label>VERIFICATION QUEUE · {items.length} IN REVIEW</Label><Text style={s.cardTitle}>Needs a decision</Text>{items.length ? items.map((item) => <View style={s.approvalRow} key={item.key}><View style={s.personCopy}><Text style={s.personName}>{item.name}</Text><Text style={s.personSub}>{item.type}</Text><Text style={s.personSub}>{item.detail}</Text></View><Pressable onPress={() => decide(item, 'needs_more_information', 'additional_information')}><Text style={s.approveText}>Request info</Text></Pressable>{!preview && <Pressable onPress={() => decide(item, 'rejected', 'verification_failed')}><Text style={s.approveText}>Reject</Text></Pressable>}<Pressable onPress={() => decide(item, 'verified', null)}><Text style={s.approveText}>Approve</Text></Pressable></View>) : <Text style={s.cardDesc}>The review queue is clear.</Text>}</View>{preview && <View style={s.notice}><Text style={s.verified}>ⓘ</Text><Text style={s.cardDesc}>Local preview only. No approval or verification is sent to Mavora.</Text></View>}</>;
  }

  function renderSupport(faqOnly = false) {
    const faqs = ['How do I make my profile private?', 'How does identity verification work?', 'How do I report a suspicious account?'];
    return <><View style={s.pageHeading}><Label>{faqOnly ? 'ANSWERS, WITHOUT THE RUNAROUND' : 'HERE WHEN YOU NEED A HAND'}</Label><Text style={s.pageTitle}>{faqOnly ? 'Help & FAQ' : 'AI Support'}</Text><Text style={s.pageSub}>{faqOnly ? 'Clear answers about account, safety and membership.' : 'Ask about Mavora. Sensitive issues can reach a person.'}</Text></View>{faqOnly ? <View style={s.infoCard}>{faqs.map((faq, index) => <Pressable style={s.faqItem} key={faq} onPress={() => setExpandedFaq(expandedFaq === index ? -1 : index)}><Text style={s.faqQuestion}>{faq} <Text style={s.verified}>{expandedFaq === index ? '−' : '+'}</Text></Text>{expandedFaq === index && <Text style={s.cardDesc}>{index === 0 ? 'Open Your profile, choose Privacy, then set account visibility to Private. You can remove approved followers at any time.' : index === 1 ? 'A reviewed provider handles identity checks. Mavora stores the minimum verification outcome needed.' : 'Open an account or content menu and choose Report. You can block an account from its profile.'}</Text>}</Pressable>)}</View> : <View style={s.supportCard}><View style={s.supportBrand}><Text style={s.supportSpark}>✦</Text><View><Text style={s.personName}>Mavora Support</Text><Text style={s.personSub}>AI assistant · Human escalation available</Text></View></View><View style={s.assistantBubble}><Text style={s.cardDesc}>Hi Ada. I can help with settings, membership or safety. What’s on your mind?</Text></View>{supportAsked.map((item, index) => <React.Fragment key={index}><View style={s.userBubble}><Text style={s.messageText}>{item}</Text></View><View style={s.assistantBubble}><Text style={s.cardDesc}>For account-specific or sensitive issues, use the human support path in Security Centre.</Text></View></React.Fragment>)}<View style={s.promptRow}>{['Privacy', 'Premium', 'Report a scam'].map((topic) => <Pressable key={topic} style={s.promptChip} onPress={() => setSupportAsked([...supportAsked, topic])}><Text style={s.promptText}>{topic}</Text></Pressable>)}</View><View style={s.messageEntry}><TextInput value={supportDraft} onChangeText={setSupportDraft} placeholder="Ask a question..." placeholderTextColor={colors.dim} style={s.messageInput}/><Pressable style={s.sendMessage} onPress={() => { if (supportDraft.trim()) { setSupportAsked([...supportAsked, supportDraft.trim()]); setSupportDraft(''); } }}><Text style={s.sendText}>↗</Text></Pressable></View><Text style={s.footnote}>AI guidance can be wrong. It cannot decide KYC, fraud, enforcement or payment disputes.</Text></View>}</>;
  }

  function renderProfile() {
    const profileName = remoteProfile?.display_name || 'Ada Okafor';
    const username = remoteProfile?.username ? `@${remoteProfile.username}` : '@adaokafor';
    const country = remoteProfile?.country_code || 'Lagos, Nigeria';
    return <><ImageBackground source={img('photo-1500530855697-b586d89ba3ee', 1000, 400)} style={s.profileCover}><Text style={s.editCover}>Edit profile ↗</Text></ImageBackground><View style={s.profileCard}><Avatar photo={remoteProfile?.avatar_url || people[0].photo} size={82}/><Text style={s.profileName}>{profileName} <Text style={s.verified}>✦</Text></Text><Text style={s.personSub}>{username} · {country}</Text><Text style={s.profileBio}>{remoteProfile?.bio || 'Collecting places, people and small moments. Designer, occasional ocean chaser.'}</Text><View style={s.profileStats}><Text><Text style={s.statNumber}>128</Text> posts</Text><Text><Text style={s.statNumber}>2.4k</Text> followers</Text><Text><Text style={s.statNumber}>{following.length}</Text> following</Text></View><View style={s.visibilityRow}><View style={s.personCopy}><Text style={s.personName}>Account visibility</Text><Text style={s.personSub}>{privateAccount ? 'Only approved followers see protected posts.' : 'Anyone can discover your public posts.'}</Text></View><Switch value={privateAccount} onValueChange={setPrivateAccount} trackColor={{ false: '#374359', true: '#725ba9' }} thumbColor={privateAccount ? colors.violet : '#c7d0de'} /></View></View><View style={s.sectionHeading}><Text style={s.sectionTitle}>{`A little more of ${profileName.split(' ')[0]}`}</Text><Text style={s.sortLabel}>Posts⌄</Text></View><View style={s.photoGrid}>{['photo-1473116763249-2faaef81ccda', 'photo-1500530855697-b586d89ba3ee', 'photo-1470252649378-9c29740c9fa8'].map((photo) => <Image key={photo} source={img(photo, 300, 300)} style={s.profilePhoto}/>)}</View></>;
  }

  function renderCentre(privacy = false) {
    const rows = privacy ? [
      ['Account visibility', privateAccount ? 'Only approved followers can view protected posts.' : 'Anyone can discover your public posts.', 'activityStatus'],
      ['Message requests', 'People outside your circles can contact you.', 'requests'],
      ['Personalized discovery', 'Use activity to improve suggestions.', 'suggestions'],
      ['Your data', 'Request a copy or manage account deletion.', null]
    ] : [
      ['Two-step verification', 'Add another check when you sign in.', 'twoFactor'],
      ['Login alerts', 'Get notified about unfamiliar sign-ins.', 'loginAlerts'],
      ['Active sessions', 'Review signed-in devices.', null],
      ['Connected apps', 'Review services with account access.', null]
    ];
    return <><View style={s.pageHeading}><Label>{privacy ? 'YOUR DATA, YOUR DECISIONS' : 'A QUIETER KIND OF CONFIDENCE'}</Label><Text style={s.pageTitle}>{privacy ? 'Privacy Centre' : 'Security Centre'}</Text><Text style={s.pageSub}>{privacy ? 'Understand and shape how Mavora uses your information.' : 'A clear view of your account protection.'}</Text></View><View style={s.infoCard}>{rows.map(([title, detail, key]) => <View style={s.settingRow} key={title}><View style={s.settingGlyph}><Text style={s.verified}>{privacy ? '◈' : '⌑'}</Text></View><View style={s.personCopy}><Text style={s.personName}>{title}</Text><Text style={s.personSub}>{detail}</Text></View>{key ? <Switch value={settings[key]} onValueChange={(value) => setSettings({ ...settings, [key]: value })} trackColor={{ false: '#374359', true: '#498b84' }} thumbColor={settings[key] ? colors.teal : '#c7d0de'}/> : <Text style={s.arrow}>↗</Text>}</View>)}</View><View style={s.notice}><Text style={s.verified}>◈</Text><Text style={s.cardDesc}>Controls shown here are prototype interactions. Production settings must be enforced by authenticated server policies.</Text></View></>;
  }

  function renderScreen() {
    if (view === 'Home' || view === 'Create') return renderHome();
    if (view === 'Circles') return renderCircles();
    if (view === 'Followers' || view === 'Following' || view === 'Friend requests') return renderRelationshipList(view);
    if (view === 'Inbox') return renderMessages();
    if (view === 'Reels') return renderReels();
    if (view === 'Groups') return renderGroups();
    if (view === 'Business') return renderBusiness();
    if (view === 'Membership') return renderMembership();
    if (view === 'Verification') return renderVerification();
    if (view === 'Approval desk' && (preview || capabilities.includes('kyc.read'))) return renderApprovals();
    if (view === 'AI Support') return renderSupport();
    if (view === 'Help & FAQ') return renderSupport(true);
    if (view === 'Your profile') return renderProfile();
    if (view === 'Security Centre') return renderCentre();
    return renderCentre(true);
  }

  return <SafeAreaView style={s.app}>
    <StatusBar style="light" />
    <View style={s.header}><Pressable onPress={() => navigate('Home')}><Text style={s.wordmark}>MAV<Text style={s.wordmarkAccent}>O</Text>RA</Text></Pressable><View style={s.headerActions}><Pressable style={s.headerIcon} onPress={() => navigate('Membership')}><Text style={s.headerIconText}>✦</Text></Pressable><Pressable style={s.headerIcon} onPress={() => setMenuOpen(true)}><Text style={s.headerIconText}>···</Text></Pressable><Avatar photo={people[0].photo} size={31}/></View></View>
    {preview && <View style={s.previewBanner}><Text style={s.previewLabel}>LOCAL PREVIEW</Text><Text style={s.previewText}>Sample interactions only.</Text><Pressable onPress={onExit}><Text style={s.previewExit}>Exit</Text></Pressable></View>}
    {!preview && Boolean(apiNotice) && <View style={s.notice}><Text style={s.cardDesc}>{apiNotice}</Text></View>}
    <ScrollView style={s.scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">{renderScreen()}</ScrollView>
    <View style={s.bottomNav}>{[['Home', '⌂'], ['Circles', '◉'], ['Create', '＋'], ['Inbox', '✉'], ['Your profile', '◍']].map(([name, icon]) => <Pressable key={name} onPress={() => navigate(name)} style={s.navItem}><Text style={[s.navIcon, view === name && s.navIconActive]}>{icon}</Text><Text style={[s.navText, view === name && s.navTextActive]}>{name === 'Your profile' ? 'You' : name === 'Circles' ? 'Circles' : name === 'Inbox' ? 'Inbox' : name}</Text></Pressable>)}</View>
    <Modal visible={menuOpen} animationType="slide" transparent onRequestClose={() => setMenuOpen(false)}><Pressable style={s.modalShade} onPress={() => setMenuOpen(false)}><Pressable style={s.menuSheet} onPress={(event) => event.stopPropagation()}><View style={s.sheetHandle}/><View style={s.sheetTitleRow}><View><Label>EXPLORE MAVORA</Label><Text style={s.sheetTitle}>More of your space</Text></View><Pressable onPress={() => setMenuOpen(false)}><Text style={s.closeMenu}>×</Text></Pressable></View><View style={s.menuGrid}>{sections.filter(([name]) => name !== 'Approval desk').map(([name, icon]) => <Pressable style={s.menuItem} key={name} onPress={() => navigate(name)}><Text style={s.menuIcon}>{icon}</Text><Text style={s.menuLabel}>{name}</Text></Pressable>)}</View>{(preview || capabilities.includes('kyc.read')) && <View style={s.previewOnly}><Text style={s.previewLabel}>{preview ? 'STAFF PREVIEW' : 'STAFF WORKSPACE'}</Text><Pressable onPress={() => navigate('Approval desk')}><Text style={s.menuLabel}>⌑  Approval desk</Text></Pressable></View>}<Pressable style={s.exitPreview} onPress={onExit}><Text style={s.exitPreviewText}>{preview ? 'Exit local preview' : 'Sign out'} ↗</Text></Pressable></Pressable></Pressable></Modal>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: colors.background },
  header: { height: 54, paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: '#0c1422' },
  wordmark: { color: colors.text, fontSize: 17, fontWeight: '800', letterSpacing: 1.8 },
  wordmarkAccent: { color: colors.teal },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIcon: { width: 31, height: 31, borderWidth: 1, borderColor: colors.line, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  headerIconText: { color: colors.violet, fontSize: 16 },
  previewBanner: { minHeight: 34, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#b69cff12', borderBottomWidth: 1, borderBottomColor: '#b69cff32' },
  previewLabel: { fontSize: 8, color: colors.violet, fontWeight: '800', letterSpacing: 1 },
  previewText: { flex: 1, color: colors.muted, fontSize: 9 },
  previewExit: { color: colors.teal, fontSize: 10, fontWeight: '700' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 15, paddingTop: 16, paddingBottom: 28 },
  eyebrow: { color: '#8f9db1', fontSize: 9, fontWeight: '700', letterSpacing: 1.3, marginBottom: 5 },
  welcomeHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14 },
  pageHeading: { marginBottom: 17 },
  pageTitle: { color: colors.text, fontSize: 25, fontWeight: '700', marginTop: 3, marginBottom: 4, letterSpacing: 0 },
  pageSub: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  liveLabel: { color: '#a6b8c5', fontSize: 8, letterSpacing: 1, marginBottom: 5 },
  stories: { gap: 11, paddingBottom: 13, borderBottomWidth: 1, borderBottomColor: colors.line, marginBottom: 13 },
  story: { alignItems: 'center', width: 52 },
  storyRing: { width: 49, height: 49, borderRadius: 25, padding: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.violet, marginBottom: 5 },
  storyRingTeal: { backgroundColor: colors.teal },
  addStory: { width: 49, height: 49, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.elevated, borderWidth: 1, borderColor: '#b69cff85', marginBottom: 5 },
  addStoryText: { color: colors.teal, fontSize: 22 },
  storyName: { color: colors.muted, fontSize: 9 },
  composer: { padding: 12, backgroundColor: colors.surface, borderRadius: 6, borderWidth: 1, borderColor: colors.line, marginBottom: 22 },
  composerTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  composerInput: { flex: 1, color: colors.text, fontSize: 12, minHeight: 42, paddingTop: 8, textAlignVertical: 'top' },
  composerBottom: { paddingTop: 9, borderTopWidth: 1, borderTopColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  audience: { color: colors.muted, fontSize: 10 },
  button: { minHeight: 36, paddingHorizontal: 13, borderRadius: 4, backgroundColor: colors.violet, alignItems: 'center', justifyContent: 'center', marginTop: 9 },
  buttonText: { color: '#161425', fontSize: 10, fontWeight: '700' },
  secondaryButton: { backgroundColor: '#b69cff12', borderWidth: 1, borderColor: '#b69cff55' },
  secondaryButtonText: { color: '#d3c4ff' },
  shareButton: { minHeight: 30, marginTop: 0, paddingHorizontal: 12 },
  sectionHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginTop: 2 },
  sortLabel: { color: colors.muted, fontSize: 9, paddingBottom: 2 },
  post: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 6, padding: 12, marginBottom: 13 },
  postHead: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  postIdentity: { flex: 1 },
  postName: { color: colors.text, fontSize: 11, fontWeight: '700' },
  postTime: { color: colors.dim, fontSize: 9, marginTop: 3 },
  verified: { color: colors.teal, fontWeight: '700' },
  ellipsis: { color: colors.muted, letterSpacing: 2, paddingHorizontal: 5 },
  postCopy: { color: '#d6deea', fontSize: 11, lineHeight: 18, marginVertical: 11 },
  postImage: { height: 245, justifyContent: 'flex-end', backgroundColor: colors.elevated },
  postImageRadius: { borderRadius: 4 },
  imageCaption: { paddingHorizontal: 11, paddingBottom: 10, paddingTop: 27, backgroundColor: '#07101d66' },
  imageCaptionText: { color: '#fff', fontSize: 9, fontWeight: '600' },
  reactionSummary: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line, gap: 6 },
  reactionMarks: { color: colors.teal, fontSize: 11 },
  reactionText: { color: colors.muted, fontSize: 9 },
  replyText: { color: colors.muted, fontSize: 9, marginLeft: 'auto' },
  postActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10 },
  postActionText: { color: colors.muted, fontSize: 9 },
  liked: { color: '#ffa4b6' },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 8 },
  personCopy: { flex: 1 },
  personName: { color: colors.text, fontSize: 10, fontWeight: '700' },
  personSub: { color: colors.muted, fontSize: 9, marginTop: 3, lineHeight: 14 },
  smallAction: { paddingHorizontal: 8, paddingVertical: 6, borderWidth: 1, borderColor: '#b69cff66', borderRadius: 4, backgroundColor: '#b69cff10' },
  smallActionOn: { borderColor: colors.line, backgroundColor: '#ffffff08' },
  smallActionText: { color: '#d4c6ff', fontSize: 8, fontWeight: '600' },
  smallActionTextOn: { color: colors.muted },
  segmentRow: { flexDirection: 'row', gap: 18, borderBottomWidth: 1, borderBottomColor: colors.line, marginBottom: 12 },
  segment: { color: colors.muted, fontSize: 10, paddingVertical: 10 },
  segmentActive: { color: colors.teal, fontSize: 10, fontWeight: '700', paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: colors.teal },
  requestCount: { color: colors.violet, fontWeight: '700' },
  friendCard: { borderRadius: 6, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, overflow: 'hidden', marginBottom: 12 },
  friendCover: { height: 82, backgroundColor: colors.elevated },
  friendBody: { paddingHorizontal: 10, paddingBottom: 11 },
  friendMain: { marginTop: -7 },
  mutuals: { color: colors.dim, fontSize: 8, marginTop: 4, marginBottom: 6 },
  friendButton: { alignSelf: 'stretch' },
  chatCard: { flex: 1, minHeight: 470, borderRadius: 6, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, overflow: 'hidden' },
  chatProfile: { flexDirection: 'row', alignItems: 'center', padding: 11, borderBottomWidth: 1, borderBottomColor: colors.line, gap: 9 },
  online: { color: colors.muted, fontSize: 9, marginTop: 3 },
  chatHistory: { padding: 13, flex: 1, gap: 11 },
  dayLabel: { alignSelf: 'center', fontSize: 8, letterSpacing: 1, color: colors.dim, marginBottom: 7 },
  messageReceived: { alignSelf: 'flex-start', maxWidth: '83%', backgroundColor: colors.elevated, padding: 10, borderRadius: 8, borderBottomLeftRadius: 2 },
  messageSent: { alignSelf: 'flex-end', maxWidth: '83%', backgroundColor: '#725da8', padding: 10, borderRadius: 8, borderBottomRightRadius: 2 },
  messageText: { color: '#f2f1f8', fontSize: 10, lineHeight: 16 },
  messageEntry: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.line, borderRadius: 4, paddingHorizontal: 8, minHeight: 42, margin: 9 },
  attach: { color: colors.violet, fontSize: 18 },
  messageInput: { flex: 1, fontSize: 10, color: colors.text },
  sendMessage: { width: 28, height: 28, borderRadius: 15, backgroundColor: colors.violet, alignItems: 'center', justifyContent: 'center' },
  sendText: { color: '#151425', fontSize: 13, fontWeight: '700' },
  footnote: { color: colors.dim, fontSize: 9, lineHeight: 14, marginTop: 10 },
  createGroup: { alignSelf: 'flex-start', marginTop: -7, marginBottom: 13 },
  groupCard: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, borderRadius: 6, overflow: 'hidden', marginBottom: 12 },
  groupImage: { width: '100%', height: 145, backgroundColor: colors.elevated },
  groupBody: { padding: 12 },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 5, marginBottom: 5 },
  cardDesc: { color: colors.muted, fontSize: 10, lineHeight: 16, marginBottom: 7 },
  reel: { height: 500, borderRadius: 6, overflow: 'hidden', backgroundColor: colors.elevated },
  reelImage: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  reelShade: { ...StyleSheet.absoluteFillObject, backgroundColor: '#07101d4d' },
  reelPlay: { color: '#fff', fontSize: 24, width: 58, height: 58, textAlign: 'center', textAlignVertical: 'center', overflow: 'hidden', borderWidth: 1, borderColor: '#ffffffa0', borderRadius: 30, backgroundColor: '#10182788' },
  reelCaption: { position: 'absolute', bottom: 14, left: 13, right: 12 },
  reelTitle: { color: colors.text, fontSize: 19, lineHeight: 25, fontWeight: '700', marginVertical: 7 },
  reelCreator: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 7 },
  followTag: { color: colors.teal, marginLeft: 'auto', fontSize: 9 },
  reelActionRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 14 },
  businessFeature: { height: 270, borderRadius: 6, overflow: 'hidden', marginBottom: 20 },
  businessImage: { flex: 1, justifyContent: 'flex-end' },
  businessShade: { ...StyleSheet.absoluteFillObject, backgroundColor: '#09111d99' },
  businessText: { padding: 15 },
  lightButton: { alignSelf: 'flex-start', backgroundColor: '#edf2fa' },
  businessRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.line },
  productImage: { width: 66, height: 60, borderRadius: 4, backgroundColor: colors.elevated },
  productInfo: { flex: 1 },
  arrow: { color: colors.teal, fontSize: 14 },
  planCard: { borderWidth: 1, borderColor: colors.line, borderRadius: 6, backgroundColor: colors.surface, padding: 14, marginBottom: 11 },
  planFeatured: { borderColor: '#b69cff7a' },
  planTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  planIcon: { color: colors.violet, fontSize: 19, marginBottom: 8 },
  planIconTeal: { color: colors.teal },
  planPrice: { color: '#d5dced', fontSize: 10, marginBottom: 9 },
  planFeature: { color: colors.muted, fontSize: 9, marginVertical: 4 },
  planButton: { marginTop: 10 },
  infoCard: { borderWidth: 1, borderColor: colors.line, borderRadius: 6, backgroundColor: colors.surface, padding: 14, marginBottom: 12 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.line },
  statusPill: { color: '#f3cf86', backgroundColor: '#f3cf8616', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 3, fontSize: 9 },
  approvalRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.line },
  approveText: { color: colors.teal, fontSize: 10, fontWeight: '700' },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderColor: colors.line, backgroundColor: '#111b2b', borderRadius: 5, padding: 11, marginTop: 10 },
  supportCard: { flex: 1, minHeight: 450, borderWidth: 1, borderColor: colors.line, borderRadius: 6, backgroundColor: colors.surface, padding: 12 },
  supportBrand: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  supportSpark: { width: 31, height: 31, borderRadius: 17, overflow: 'hidden', textAlign: 'center', textAlignVertical: 'center', color: colors.violet, backgroundColor: '#b69cff18' },
  assistantBubble: { alignSelf: 'flex-start', maxWidth: '90%', backgroundColor: colors.elevated, borderRadius: 6, padding: 10, marginTop: 14 },
  userBubble: { alignSelf: 'flex-end', maxWidth: '85%', backgroundColor: '#725da8', borderRadius: 6, padding: 10, marginTop: 10 },
  promptRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 13, marginBottom: 12 },
  promptChip: { borderWidth: 1, borderColor: '#b69cff55', borderRadius: 14, paddingVertical: 6, paddingHorizontal: 8 },
  promptText: { color: '#d2c4ff', fontSize: 8 },
  faqItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  faqQuestion: { color: colors.text, fontSize: 10, lineHeight: 16 },
  profileCover: { height: 135, justifyContent: 'flex-start', alignItems: 'flex-end', padding: 10, marginBottom: -1 },
  editCover: { color: colors.text, fontSize: 9, backgroundColor: '#0b1322cc', paddingVertical: 7, paddingHorizontal: 9, borderRadius: 3 },
  profileCard: { alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 6, paddingHorizontal: 13, paddingBottom: 12 },
  profileName: { color: colors.text, fontSize: 17, fontWeight: '700', marginTop: 7 },
  profileBio: { color: '#b3bfce', fontSize: 10, lineHeight: 16, textAlign: 'center', marginVertical: 9 },
  profileStats: { flexDirection: 'row', gap: 17, paddingBottom: 12, color: colors.muted, fontSize: 9 },
  statNumber: { color: colors.text, fontWeight: '700' },
  visibilityRow: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 11, borderTopWidth: 1, borderTopColor: colors.line },
  photoGrid: { flexDirection: 'row', gap: 5 },
  profilePhoto: { flex: 1, aspectRatio: 1, borderRadius: 3 },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 69, borderBottomWidth: 1, borderBottomColor: colors.line },
  settingGlyph: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: '#5be3cf0e', borderWidth: 1, borderColor: '#5be3cf33', borderRadius: 4 },
  modalShade: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0009' },
  menuSheet: { backgroundColor: '#101a29', paddingHorizontal: 18, paddingTop: 11, paddingBottom: 26, borderTopLeftRadius: 12, borderTopRightRadius: 12, borderWidth: 1, borderColor: colors.line },
  sheetHandle: { width: 37, height: 4, borderRadius: 2, backgroundColor: '#64738b', alignSelf: 'center', marginBottom: 17 },
  sheetTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 },
  sheetTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  closeMenu: { color: colors.muted, fontSize: 25, paddingHorizontal: 8 },
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  menuItem: { width: '31%', minHeight: 73, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.line, backgroundColor: '#ffffff04', borderRadius: 5, marginBottom: 7, padding: 5 },
  menuIcon: { color: colors.teal, fontSize: 18, marginBottom: 5 },
  menuLabel: { color: '#d3ddeb', fontSize: 8, textAlign: 'center' },
  previewOnly: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12, marginTop: 4 },
  exitPreview: { paddingVertical: 13, marginTop: 8, alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.line },
  exitPreviewText: { color: colors.violet, fontSize: 10, fontWeight: '700' }
});