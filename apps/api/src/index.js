import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createClient } from '@supabase/supabase-js';
import { constantTimeEqual, parseBearerToken, validateFlutterwaveReceipt } from './security.js';

const app = express();
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const flutterwaveSecret = process.env.FLUTTERWAVE_SECRET_KEY;
const webhookHash = process.env.FLUTTERWAVE_WEBHOOK_HASH;
const configuredOrigins = (process.env.CLIENT_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean);
const localOrigins = process.env.NODE_ENV === 'production'
  ? []
  : ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:8081'];
const allowedOrigins = new Set([...localOrigins, ...configuredOrigins]);
const authClient = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;
const serviceClient = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const validUuid = (value) => typeof value === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const userClient = (token) => createClient(supabaseUrl, supabaseAnonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  global: { headers: { Authorization: `Bearer ${token}` } }
});

app.use(helmet());
app.use(cors({ origin(origin, callback) {
  if (!origin || allowedOrigins.has(origin)) return callback(null, true);
  return callback(new Error('Origin not allowed by CORS'));
} }));
app.use(express.json({ limit: '1mb' }));
app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false }));

const requireAuth = asyncRoute(async (req, res, next) => {
  if (!authClient) return res.status(503).json({ error: 'Authentication service is not configured.' });
  const token = parseBearerToken(req.get('authorization'));
  if (!token) return res.status(401).json({ error: 'Authentication required.' });
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) return res.status(401).json({ error: 'Invalid or expired session.' });
  req.user = data.user;
  req.userClient = userClient(token);
  next();
});

function requirePermission(permission) {
  return asyncRoute(async (req, res, next) => {
    if (!serviceClient) return res.status(503).json({ error: 'Staff authorization is not configured.' });
    const { data: assignment, error: roleError } = await serviceClient
      .from('user_roles').select('role').eq('user_id', req.user.id).maybeSingle();
    if (roleError) return res.status(503).json({ error: 'Could not verify staff permissions.' });
    if (!assignment) return res.status(403).json({ error: 'Permission denied.' });
    if (assignment.role === 'super_admin') return next();
    const { data: permissionRow, error: permissionError } = await serviceClient
      .from('role_permissions').select('permission')
      .eq('role', assignment.role).eq('permission', permission).maybeSingle();
    if (permissionError) return res.status(503).json({ error: 'Could not verify staff permissions.' });
    if (!permissionRow) return res.status(403).json({ error: 'Permission denied.' });
    next();
  });
}

function reportDatabaseError(res, error, context) {
  console.error(`${context}:`, error?.message || error);
  return res.status(503).json({ error: 'The requested service is temporarily unavailable.' });
}

app.get('/health', (_req, res) => res.json({ ok: true, service: 'Mavora API', version: '0.3.0' }));
app.get('/api/status', (_req, res) => res.json({ name: 'Mavora', modules: ['auth-foundation','social-api','kyc-review','verified-billing'] }));

app.get('/api/me/security', requireAuth, asyncRoute(async (req, res) => {
  const [profile, age, entitlements, applications] = await Promise.all([
    req.userClient.from('profiles').select('id,username,display_name,is_private,follower_list_visibility,country_code,preferred_currency').eq('id', req.user.id).maybeSingle(),
    req.userClient.from('age_assurance').select('status,verified_at').eq('user_id', req.user.id).maybeSingle(),
    req.userClient.from('user_entitlements').select('entitlement_key,plan_code,created_at').eq('user_id', req.user.id),
    req.userClient.from('kyc_applications').select('id,application_type,status,reason_category,appeal_status,submitted_at,reviewed_at').eq('applicant_id', req.user.id).order('submitted_at', { ascending: false }).limit(5)
  ]);
  const failed = [profile, age, entitlements, applications].find((result) => result.error);
  if (failed) return reportDatabaseError(res, failed.error, 'Load account security');
  return res.json({ profile: profile.data, ageAssurance: age.data, entitlements: entitlements.data || [], kycApplications: applications.data || [] });
}));

app.get('/api/me/capabilities', requireAuth, asyncRoute(async (req, res) => {
  if (!serviceClient) return res.status(503).json({ error: 'Staff authorization is not configured.' });
  const { data: assignment, error: roleError } = await serviceClient
    .from('user_roles').select('role').eq('user_id', req.user.id).maybeSingle();
  if (roleError) return reportDatabaseError(res, roleError, 'Load user capabilities');
  if (!assignment) return res.json({ role: 'user', permissions: [] });
  const { data, error } = await serviceClient.from('role_permissions')
    .select('permission').eq('role', assignment.role);
  if (error) return reportDatabaseError(res, error, 'Load role permissions');
  return res.json({ role: assignment.role, permissions: (data || []).map((item) => item.permission) });
}));

app.get('/api/social/feed', requireAuth, asyncRoute(async (req, res) => {
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
  const { data: posts, error: postError } = await req.userClient.from('posts')
    .select('id,author_id,body,media_urls,visibility,created_at')
    .order('created_at', { ascending: false }).limit(limit);
  if (postError) return reportDatabaseError(res, postError, 'Load social feed');
  const authorIds = [...new Set((posts || []).map((post) => post.author_id))];
  let profiles = [];
  if (authorIds.length) {
    const { data, error } = await req.userClient.from('profiles')
      .select('id,username,display_name,avatar_url').in('id', authorIds);
    if (error) return reportDatabaseError(res, error, 'Load feed profiles');
    profiles = data || [];
  }
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  return res.json({ posts: (posts || []).map((post) => ({
    id: post.id,
    authorId: post.author_id,
    body: post.body,
    mediaUrls: post.media_urls,
    visibility: post.visibility,
    createdAt: post.created_at,
    author: profilesById.get(post.author_id) || null
  })) });
}));

app.post('/api/social/posts', requireAuth, asyncRoute(async (req, res) => {
  const { body, mediaUrls = [], visibility = 'public' } = req.body || {};
  const allowedAudiences = ['public', 'followers', 'friends', 'private', 'only_me'];
  const safeBody = typeof body === 'string' ? body.trim() : '';
  if ((!safeBody && !mediaUrls.length) || safeBody.length > 5000 || !Array.isArray(mediaUrls)
      || mediaUrls.length > 10 || !mediaUrls.every((value) => {
        try { return new URL(value).protocol === 'https:'; } catch { return false; }
      }) || !allowedAudiences.includes(visibility)) {
    return res.status(400).json({ error: 'Post content, media, or audience is invalid.' });
  }
  const { data, error } = await req.userClient.from('posts')
    .insert({ author_id: req.user.id, body: safeBody || null, media_urls: mediaUrls, visibility })
    .select('id,author_id,body,media_urls,visibility,created_at').single();
  if (error) return res.status(403).json({ error: 'Post could not be created.' });
  return res.status(201).json({ post: data });
}));

app.get('/api/social/people', requireAuth, asyncRoute(async (req, res) => {
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 30));
  const { data, error } = await req.userClient.from('profiles')
    .select('id,username,display_name,bio,avatar_url,is_private,created_at')
    .neq('id', req.user.id).order('created_at', { ascending: false }).limit(limit);
  if (error) return reportDatabaseError(res, error, 'Discover profiles');
  return res.json({ people: data || [] });
}));

app.patch('/api/me/profile', requireAuth, asyncRoute(async (req, res) => {
  const allowed = ['is_private', 'follower_list_visibility'];
  const update = Object.fromEntries(allowed.filter((key) => Object.hasOwn(req.body || {}, key)).map((key) => [key, req.body[key]]));
  if (!Object.keys(update).length || (update.is_private !== undefined && typeof update.is_private !== 'boolean')
      || (update.follower_list_visibility !== undefined && !['public', 'followers', 'friends', 'only_me'].includes(update.follower_list_visibility))) {
    return res.status(400).json({ error: 'Provide a valid profile privacy setting.' });
  }
  const { data, error } = await req.userClient.from('profiles').update(update).eq('id', req.user.id)
    .select('id,is_private,follower_list_visibility').single();
  if (error) return reportDatabaseError(res, error, 'Update profile privacy');
  return res.json({ profile: data });
}));

app.get('/api/membership/plans', requireAuth, asyncRoute(async (req, res) => {
  const [plans, prices] = await Promise.all([
    req.userClient.from('membership_plans').select('code,display_name,stage,requires_individual_kyc,requires_business_kyc').eq('active', true).order('stage'),
    req.userClient.from('membership_prices').select('plan_code,country_code,billing_period,currency,amount').eq('active', true)
  ]);
  const failed = [plans, prices].find((result) => result.error);
  if (failed) return reportDatabaseError(res, failed.error, 'Load membership catalog');
  return res.json({ plans: plans.data || [], prices: prices.data || [] });
}));

app.post('/api/social/friend-requests', requireAuth, asyncRoute(async (req, res) => {
  const recipientId = req.body?.recipientId;
  if (!validUuid(recipientId) || recipientId === req.user.id) return res.status(400).json({ error: 'A valid recipient is required.' });
  const { data, error } = await req.userClient.from('friend_requests')
    .insert({ sender_id: req.user.id, recipient_id: recipientId, status: 'pending' })
    .select('id,sender_id,recipient_id,status,created_at').single();
  if (error) return res.status(error.code === '23505' ? 409 : 403).json({ error: 'Friend request could not be created.' });
  return res.status(201).json({ request: data });
}));

app.post('/api/social/friend-requests/:id/accept', requireAuth, asyncRoute(async (req, res) => {
  if (!validUuid(req.params.id)) return res.status(400).json({ error: 'A valid request ID is required.' });
  const { data, error } = await req.userClient.rpc('accept_friend_request', { p_request_id: req.params.id });
  if (error) return res.status(error.code === 'P0002' ? 404 : 403).json({ error: 'Friend request could not be accepted.' });
  return res.json({ requestId: data, status: 'accepted' });
}));

app.post('/api/social/follow-requests', requireAuth, asyncRoute(async (req, res) => {
  if (!validUuid(req.body?.followedId)) return res.status(400).json({ error: 'A valid profile is required.' });
  const { data, error } = await req.userClient.rpc('request_follow', { p_followed_id: req.body.followedId });
  if (error) return res.status(error.code === '23505' ? 409 : 403).json({ error: 'Follow request could not be created.' });
  return res.status(data === 'requested' ? 202 : 200).json({ status: data });
}));

app.post('/api/social/follow-requests/:id/review', requireAuth, asyncRoute(async (req, res) => {
  if (!validUuid(req.params.id) || typeof req.body?.approve !== 'boolean') return res.status(400).json({ error: 'A request ID and decision are required.' });
  const { data, error } = await req.userClient.rpc('review_follow_request', {
    p_request_id: req.params.id,
    p_approve: req.body.approve
  });
  if (error) return res.status(error.code === 'P0002' ? 404 : 403).json({ error: 'Follow request could not be reviewed.' });
  return res.json({ requestId: data, status: req.body.approve ? 'accepted' : 'declined' });
}));

app.post('/api/social/blocks', requireAuth, asyncRoute(async (req, res) => {
  const blockedId = req.body?.blockedId;
  if (!validUuid(blockedId) || blockedId === req.user.id) return res.status(400).json({ error: 'A valid account is required.' });
  const { error } = await req.userClient.from('user_blocks').insert({ blocker_id: req.user.id, blocked_id: blockedId });
  if (error && error.code !== '23505') return res.status(403).json({ error: 'Account could not be blocked.' });
  return res.status(204).end();
}));

app.post('/api/social/reports', requireAuth, asyncRoute(async (req, res) => {
  const { targetType, targetId, reason } = req.body || {};
  if (!['user', 'post', 'message', 'business', 'ad'].includes(targetType)
      || !validUuid(targetId) || typeof reason !== 'string' || reason.trim().length < 3 || reason.trim().length > 500) {
    return res.status(400).json({ error: 'A valid report target and reason are required.' });
  }
  const { data, error } = await req.userClient.from('content_reports')
    .insert({ reporter_id: req.user.id, target_type: targetType, target_id: targetId, reason: reason.trim() })
    .select('id,status,created_at').single();
  if (error) return res.status(403).json({ error: 'Report could not be submitted.' });
  return res.status(201).json({ report: data });
}));

app.get('/api/me/kyc', requireAuth, asyncRoute(async (req, res) => {
  const { data, error } = await req.userClient.from('kyc_applications')
    .select('id,application_type,status,reason_category,appeal_status,submitted_at,reviewed_at')
    .eq('applicant_id', req.user.id).order('submitted_at', { ascending: false });
  if (error) return reportDatabaseError(res, error, 'Load KYC applications');
  return res.json({ applications: data || [] });
}));

app.post('/api/me/kyc', requireAuth, asyncRoute(async (req, res) => {
  const applicationType = req.body?.applicationType;
  if (!['individual', 'business'].includes(applicationType)) return res.status(400).json({ error: 'Choose an individual or business application.' });
  const { data: age, error: ageError } = await req.userClient.from('age_assurance')
    .select('status').eq('user_id', req.user.id).maybeSingle();
  if (ageError) return reportDatabaseError(res, ageError, 'Check age eligibility');
  if (age?.status !== 'eligible') return res.status(403).json({ error: 'Age eligibility must be verified before KYC submission.' });
  const { data: existing, error: existingError } = await req.userClient.from('kyc_applications')
    .select('id').eq('applicant_id', req.user.id).eq('application_type', applicationType)
    .in('status', ['submitted', 'in_review', 'needs_more_information']).limit(1);
  if (existingError) return reportDatabaseError(res, existingError, 'Check KYC application');
  if (existing?.length) return res.status(409).json({ error: 'An application of this type is already in review.' });
  const { data, error } = await req.userClient.from('kyc_applications')
    .insert({ applicant_id: req.user.id, application_type: applicationType, status: 'submitted' })
    .select('id,application_type,status,submitted_at').single();
  if (error) return res.status(403).json({ error: 'KYC application could not be submitted.' });
  return res.status(201).json({ application: data });
}));

app.get('/api/admin/kyc', requireAuth, requirePermission('kyc.read'), asyncRoute(async (_req, res) => {
  const { data, error } = await serviceClient.from('kyc_applications')
    .select('id,applicant_id,application_type,status,reason_category,appeal_status,submitted_at,reviewed_at')
    .in('status', ['submitted', 'in_review', 'needs_more_information']).order('submitted_at', { ascending: true });
  if (error) return reportDatabaseError(res, error, 'Load KYC review queue');
  return res.json({ applications: data || [] });
}));

app.post('/api/admin/kyc/:id/review', requireAuth, requirePermission('kyc.review'), asyncRoute(async (req, res) => {
  if (!validUuid(req.params.id)) return res.status(400).json({ error: 'A valid application ID is required.' });
  const { decision, reasonCategory = null } = req.body || {};
  if (!['verified', 'rejected', 'needs_more_information', 'suspended'].includes(decision)
      || (reasonCategory !== null && (typeof reasonCategory !== 'string' || reasonCategory.length > 80))) {
    return res.status(400).json({ error: 'A valid decision and reason category are required.' });
  }
  const { data, error } = await req.userClient.rpc('review_kyc', {
    p_application_id: req.params.id,
    p_decision: decision,
    p_reason_category: reasonCategory
  });
  if (error) return res.status(error.code === 'P0002' ? 404 : 403).json({ error: 'KYC decision could not be recorded.' });
  return res.json({ applicationId: data, status: decision });
}));

app.post('/api/billing/checkout', requireAuth, asyncRoute(async (req, res) => {
  if (!serviceClient || !flutterwaveSecret) return res.status(503).json({ error: 'Billing is not configured.' });
  const { planCode, billingPeriod, currency } = req.body || {};
  if (!['premium', 'business_pro'].includes(planCode)
      || !['monthly', 'annual'].includes(billingPeriod)
      || typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) {
    return res.status(400).json({ error: 'A valid plan, billing period, and currency are required.' });
  }
  if (!req.user.email) return res.status(400).json({ error: 'A verified account email is required for checkout.' });

  const [profileResult, ageResult, planResult] = await Promise.all([
    req.userClient.from('profiles').select('country_code').eq('id', req.user.id).maybeSingle(),
    req.userClient.from('age_assurance').select('status').eq('user_id', req.user.id).maybeSingle(),
    serviceClient.from('membership_plans').select('code,requires_individual_kyc,requires_business_kyc').eq('code', planCode).eq('active', true).maybeSingle()
  ]);
  const failed = [profileResult, ageResult, planResult].find((result) => result.error);
  if (failed) return reportDatabaseError(res, failed.error, 'Check checkout eligibility');
  if (ageResult.data?.status !== 'eligible') return res.status(403).json({ error: 'Age eligibility must be verified before checkout.' });
  if (!profileResult.data?.country_code) return res.status(409).json({ error: 'Set your country before checkout.' });
  const plan = planResult.data;
  if (!plan) return res.status(404).json({ error: 'This membership plan is unavailable.' });

  if (plan.requires_individual_kyc || plan.requires_business_kyc) {
    const applicationType = plan.requires_business_kyc ? 'business' : 'individual';
    const { data: verifiedApplication, error } = await req.userClient.from('kyc_applications')
      .select('id').eq('applicant_id', req.user.id).eq('application_type', applicationType).eq('status', 'verified').limit(1);
    if (error) return reportDatabaseError(res, error, 'Check KYC eligibility');
    if (!verifiedApplication?.length) return res.status(403).json({ error: 'Verified identity is required for this plan.' });
  }

  const { data: price, error: priceError } = await serviceClient.from('membership_prices')
    .select('amount,currency,country_code').eq('plan_code', planCode)
    .eq('country_code', profileResult.data.country_code).eq('billing_period', billingPeriod)
    .eq('currency', currency).eq('active', true).maybeSingle();
  if (priceError) return reportDatabaseError(res, priceError, 'Load regional membership price');
  if (!price) return res.status(409).json({ error: 'This plan is not currently offered for your region and currency.' });
  if (!process.env.FLUTTERWAVE_REDIRECT_URL) return res.status(503).json({ error: 'Billing return URL is not configured.' });

  const providerReference = `mavora_${randomUUID()}`;
  const { error: insertError } = await serviceClient.from('payment_transactions').insert({
    user_id: req.user.id,
    provider: 'flutterwave',
    provider_reference: providerReference,
    amount: price.amount,
    currency: price.currency,
    purpose: 'subscription',
    plan_code: planCode,
    billing_period: billingPeriod,
    checkout_country: price.country_code,
    status: 'pending'
  });
  if (insertError) return reportDatabaseError(res, insertError, 'Create pending payment');

  let providerResponse;
  try {
    const response = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${flutterwaveSecret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tx_ref: providerReference,
        amount: price.amount,
        currency: price.currency,
        redirect_url: process.env.FLUTTERWAVE_REDIRECT_URL,
        customer: { email: req.user.email },
        customizations: { title: `Mavora ${planCode}` }
      })
    });
    providerResponse = await response.json();
    if (!response.ok || providerResponse.status !== 'success' || !providerResponse.data?.link) {
      await serviceClient.from('payment_transactions').update({ status: 'failed' }).eq('provider_reference', providerReference);
      return res.status(502).json({ error: 'Payment provider could not start checkout.' });
    }
  } catch (error) {
    console.error('Flutterwave checkout request failed:', error.message);
    await serviceClient.from('payment_transactions').update({ status: 'failed' }).eq('provider_reference', providerReference);
    return res.status(502).json({ error: 'Payment provider could not start checkout.' });
  }
  return res.status(201).json({ checkoutUrl: providerResponse.data.link, reference: providerReference });
}));

app.post('/api/webhooks/flutterwave', asyncRoute(async (req, res) => {
  if (!serviceClient || !flutterwaveSecret || !webhookHash) return res.status(503).json({ received: false, error: 'Billing webhook is not configured.' });
  const suppliedHash = req.get('verif-hash');
  if (!constantTimeEqual(webhookHash, suppliedHash)) return res.status(401).json({ received: false, error: 'Webhook authentication failed.' });
  const providerTransactionId = String(req.body?.data?.id ?? '');
  const providerReference = String(req.body?.data?.tx_ref ?? '');
  if (!/^\d+$/.test(providerTransactionId) || !providerReference) return res.status(400).json({ received: false, error: 'Invalid provider event.' });

  const { data: payment, error: paymentError } = await serviceClient.from('payment_transactions')
    .select('id,user_id,provider_reference,amount,currency,status,purpose,plan_code,billing_period')
    .eq('provider', 'flutterwave').eq('provider_reference', providerReference).maybeSingle();
  if (paymentError) return reportDatabaseError(res, paymentError, 'Load webhook payment');
  if (!payment) return res.status(404).json({ received: true, processed: false, error: 'Payment reference not found.' });

  const { data: account, error: accountError } = await serviceClient.auth.admin.getUserById(payment.user_id);
  if (accountError || !account.user?.email) return res.status(503).json({ received: true, processed: false, error: 'Could not verify payment owner.' });

  let verificationResponse;
  try {
    const response = await fetch(`https://api.flutterwave.com/v3/transactions/${encodeURIComponent(providerTransactionId)}/verify`, {
      headers: { Authorization: `Bearer ${flutterwaveSecret}` }
    });
    verificationResponse = await response.json();
    if (!response.ok || verificationResponse.status !== 'success' || !verificationResponse.data) {
      return res.status(502).json({ received: true, processed: false, error: 'Provider verification is unavailable.' });
    }
  } catch (error) {
    console.error('Flutterwave verification request failed:', error.message);
    return res.status(502).json({ received: true, processed: false, error: 'Provider verification is unavailable.' });
  }

  const verified = verificationResponse.data;
  const receipt = validateFlutterwaveReceipt({
    providerReference: payment.provider_reference,
    providerTransactionId,
    amount: payment.amount,
    currency: payment.currency,
    email: account.user.email
  }, verified);
  if (!receipt.ok) return res.status(422).json({ received: true, processed: false, error: 'Provider transaction did not match the pending payment.' });

  const { data: finalizedId, error: finalizeError } = await serviceClient.rpc('finalize_verified_payment', {
    p_provider_reference: payment.provider_reference,
    p_provider_transaction_id: providerTransactionId,
    p_amount: verified.amount,
    p_currency: verified.currency,
    p_provider_status: verified.status
  });
  if (finalizeError) return reportDatabaseError(res, finalizeError, 'Finalize verified payment');
  return res.json({ received: true, processed: true, transactionId: finalizedId });
}));

app.use((error, _req, res, _next) => {
  if (error?.message === 'Origin not allowed by CORS') return res.status(403).json({ error: 'Origin not allowed.' });
  console.error('Unhandled API error:', error?.message || error);
  return res.status(500).json({ error: 'An unexpected server error occurred.' });
});

const port = Number(process.env.PORT || 8787);
app.listen(port, () => console.log(`Mavora API listening on ${port}`));
