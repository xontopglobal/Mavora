# Mavora — Product Requirements

## 1. Product identity
- Name: Mavora
- Tagline: Connect. Share. Discover. Grow.
- Founder / developer contact: Israel Sunny
- Organization: Xontopglobal
- Email: xontopglobal@gmail.com
- Phone: +2348115459455
- Address supplied: 200c Aba Owerri Road, Aba, Abia State, Nigeria

## 2. Platforms and rollout
1. Android application is the first release target.
2. Responsive web application is developed alongside Android.
3. iOS is a later expansion, with shared API and compatible React Native architecture.

## 3. Global registration and profiles
Initial account methods:
- Email + password
- Phone number + password, with phone verification
- Google sign-in

Facebook sign-in is deferred. Keep signup low-friction; collect profile details progressively. Country, language, currency and time zone are independent preferences. Store country using ISO 3166-1 alpha-2, currency using ISO 4217, and phone numbers in E.164 format. Never assume country determines preferred language or display currency.

Password recovery:
- Email reset link
- Phone OTP verification followed by secure password update
- Google account recovery for Google-authenticated users

## 4. Free and Premium
Free: personal profile, social feed, posts, follows, reactions, comments, ordinary links, messaging, groups and discovery.
Premium: business profile, dedicated product/service listings, advertising campaign creation and management, and advanced analytics.
Pricing is a commercial decision and must be configurable by region and billing channel. Do not hard-code a single NGN price as globally applicable.

## 5. Social and community
- Feed with text and media posts
- Profiles, follows, comments, reactions
- Public/private/hidden groups
- Group admins, moderators, invitations and join requests
- Messaging and conversation membership controls
- Report, block, mute and moderation workflows

## 6. Marketplace
Premium business members can publish product/service listings with title, description, category, images, display price/currency, country and external website/contact link. The initial marketplace is a discovery/referral layer, not an order-processing or escrow system.

## 7. Advertising
- Only active Premium members can submit paid campaigns.
- Admin controls minimum budget, permitted durations and campaign rules.
- All campaigns enter manual review before publication.
- Rejections include a reason and allow editing/resubmission.
- After approval, payment must be verified server-side before scheduling/activation.
- Campaigns stop at end date or budget exhaustion.
- Sponsored content is clearly labelled.
- Admin tools include review queue, audit trail, pause/reject/approve and reporting.

## 8. Admin
Role-based access for user support, moderation, ad review, subscription support, payment reconciliation, categories and reporting. Payment/security privileges must be restricted and audited.

## 9. Safety and compliance
Age-appropriate access, protections for minors, UGC moderation, report/block, spam/fraud controls, privacy policy, terms, data export, account deletion, data retention rules and applicable privacy law compliance are release requirements.
