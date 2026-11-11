# Mavora Social — Approved Development Specification

**Version:** 1.0  
**Date:** 11 November 2026  
**Status:** Approved product decisions; implementation pending  
**Product:** Mavora Social  
**Owner:** Xontopglobal  
**Primary rollout:** Android first, responsive web alongside it; iOS later

## 1. Product vision and design principles

Mavora is a standalone, international social networking, community and business platform. It must have a distinctive visual identity, original templates, navigation, typography, iconography, colour system, motion and background treatment. Facebook and other social products may be used as functional references only; do not copy their branding, proprietary assets or screen layouts.

Product principles:
- Adult-only service: minimum age 18.
- Simple, low-friction standard account registration.
- Progressive profile completion; collect only information needed for a feature.
- Stronger identity verification before KYC-gated premium, business, advertising or monetisation capabilities.
- Privacy and security enforced server-side, not only by hiding UI.
- Clear user controls, transparent decisions, appeal paths and auditability.
- Internationalisation: country, language, time zone and currency are separate preferences.

## 2. Platforms and existing architecture

Preserve the existing monorepo and Expo/EAS configuration:
- `apps/mobile`: Expo React Native Android client (primary release).
- `apps/web`: React + Vite responsive web client.
- `apps/api`: Node.js + Express API.
- `supabase/migrations`: PostgreSQL schema, functions, triggers and RLS.
- Supabase Auth, PostgreSQL, Realtime and Storage.
- Payments: Flutterwave for supported web/payment flows; use Google Play Billing where Google Play policy requires it for digital benefits sold in the Android app.

Do not replace the existing Android package identifier, Expo owner, EAS project ID, Supabase project settings or signing configuration without explicit approval.

## 3. Account creation and 18+ eligibility

Supported sign-up methods:
- Email and password.
- Phone number and password with OTP verification.
- Google sign-in after the complete OAuth/deep-link flow is implemented and tested.

Normal account onboarding should remain simple. Collect display name, date of birth/age eligibility, country of residence, required account credentials and acceptance of Terms and Privacy Policy. Collect language, time zone and preferred currency as independent settings.

Age rules:
- Mavora is an 18+ service. Users must confirm they are at least 18.
- Use a proportionate age-assurance method appropriate to local legal requirements and risk. Do not assume a self-declared birthday alone is sufficient where stronger assurance is required.
- Do not collect government identity documents from every ordinary user by default.
- Prevent underage access, provide a report path, and define safe handling/deletion of data from an account found to belong to a minor.
- Do not describe Mavora as legally compliant until jurisdiction-specific review and implementation are complete.

## 4. Profiles, friends, followers and privacy

### Friend system
- Search users and send/cancel friend requests.
- Accept or decline incoming requests.
- Remove friends.
- Show mutual friends and request status.
- Notify users of requests and decisions.
- Block/report users; blocking must restrict contact and visibility in both directions as defined by policy.

### Follow system
- Follow and unfollow independently of friendship.
- Display follower and following lists/counts subject to privacy settings.
- Public profiles can accept follows without approval.
- Private profiles require approval of follow requests.

### Friendship and follow interaction
- Friendship is mutual and only exists after acceptance.
- Recommended default: accepting a friend request establishes mutual follows, but users can unfollow without ending the friendship.
- Friend status and follow status must be stored separately.

### Profile visibility
- Public profile: permitted public content can be discovered by non-followers.
- Private profile: protected posts and profile details are available only to approved followers/friends according to the user's per-content audience setting.
- Friend request acceptance and follow approval remain separate controls.
- Users can configure who may send friend requests, follow, message, tag, see online status and view posts.
- Provide post audiences: Public, Friends, Followers, Only me (where appropriate).
- Support tag review, block, mute, report and restricted interactions.
- RLS and server-side authorization must enforce all visibility decisions.

## 5. Social and community features

- Home feed with posts, text, photos and video.
- Stories and short-form video/reels.
- Reactions, comments, replies, sharing and saves.
- Search and discovery.
- Groups: public, private and hidden; owners, moderators, invitations, join requests and member controls.
- Messaging: conversations, participant authorization, blocking rules, abuse reporting and appropriate realtime controls.
- Notifications and notification preferences.
- Pages and organisation/business profiles.
- Accessibility, reduced motion and light/dark themes.

## 6. Three membership stages

### Stage 1 — Mavora Free
- Basic personal account and profile.
- Feed, posts, reactions and comments.
- Friends, follows and groups.
- Standard messaging and discovery.
- Basic privacy, safety and support controls.

### Stage 2 — Mavora Premium
- Premium personal profile and eligible creator tools.
- Enhanced content tools and analytics.
- Access to premium services that require verified identity.
- Monthly and annual billing.

### Stage 3 — Mavora Business / Pro
- Verified business/organisation profile.
- Product and service listings and discovery.
- Eligible advertising campaign creation and management.
- Advanced business analytics and management tools.
- Monthly and annual billing.

Plan names, benefits, prices, regional availability, limits and entitlements must be configurable by authorised staff. Do not hard-code a single global price or assume all benefits are available in every country.

## 7. KYC and verification

Both individual and business KYC are required for applicable premium services:
- Individual KYC verifies the natural person.
- Business KYC verifies the business/organisation and the authorised representative where applicable.
- Standard free registration does not require KYC unless a specific legal or safety requirement applies.
- KYC must be handled by a reputable provider selected after legal, security, regional coverage and data-processing review.
- Store provider references, status, verification timestamps and minimum necessary results where possible; avoid storing raw identity documents unless there is a documented legal necessity.
- Encrypt sensitive data, restrict staff access, define retention/deletion schedules and record access in audit logs.
- KYC states should include at least `not_started`, `submitted`, `in_review`, `verified`, `rejected`, `needs_more_information`, `expired` and `suspended`.
- Rejections or holds must provide a reason category, user notice and appeal/re-submission route where appropriate.

## 8. Premium upgrade and administrator approval

Approval authority: the Mavora developer and explicitly authorised administrators.

Recommended workflow:
1. User selects a plan and billing period.
2. System checks country, eligibility, KYC requirements and regional availability.
3. Payment is initiated through an eligible billing channel.
4. Server verifies provider signature and fetches transaction details directly from the provider.
5. Server validates amount, currency, reference, user, purpose and idempotency.
6. KYC and any required business checks are reviewed.
7. The authorised reviewer approves, rejects or requests more information.
8. Entitlement is activated only when all required conditions pass.
9. User receives status and a reasoned decision.

Payment verification and KYC verification are separate states. A successful payment must not bypass failed KYC or a legitimate compliance hold. Define refund/void handling for paid requests that are rejected, subject to payment-provider and consumer-law requirements. Every decision must be audited.

## 9. Currency and internationalisation

- Country is stored as ISO 3166-1 alpha-2.
- Currency is stored as ISO 4217.
- Phone numbers use E.164.
- Language and time zone are independent preferences.
- Suggest a local display currency based on country, but allow a user preference where commercially and legally supported.
- Do not infer currency from continent; countries in the same continent use different currencies.
- Clearly distinguish display currency from actual charge/settlement currency.
- Show exchange-rate source/time, conversion and fees where applicable.
- Pricing, tax, billing methods and available plans are region-configurable.
- Record the currency and amount actually charged for every transaction.

## 10. Business profiles and marketplace

- Business/organisation pages with logo, cover, description, category, country, website and contact links.
- Verified business indicator only after approved business KYC.
- Products and services with descriptions, images, price/currency, category, country and external link.
- Clearly communicate whether Mavora is only a discovery/referral service or processes transactions. Initial scope is discovery/referral, not escrow or order fulfilment.
- Premium/Pro entitlements gate business tools as configured.

## 11. Advertising and moderation

- Eligible active Premium/Business users may submit campaigns.
- Every ad requires manual review before publication.
- Admin can approve, reject, request changes, pause or stop a campaign.
- Rejections include reasons and resubmission route.
- Payment is verified server-side before scheduling/activation.
- Ads are clearly labelled as sponsored.
- Enforce budget, duration, category, prohibited-content and country rules.
- Keep a full review and campaign audit trail.

## 12. Developer and administrator control centre

Private dashboard with role-based permissions:
- User lookup and support case handling.
- KYC review for individuals and businesses.
- Premium/Pro upgrade and entitlement review.
- Subscription and payment reconciliation.
- Scam/fraud reports and investigations.
- Account restriction, suspension and reinstatement.
- Advertising review and campaign controls.
- Content reports, moderation queues and appeals.
- FAQ/help content management.
- Pricing, plans, currencies and regional availability.
- Security events, audit logs and operational analytics.

Safety controls:
- Admins may restrict, temporarily suspend or disable accounts where credible scam/fraud evidence or policy violations justify action.
- Every action requires a reason, actor, timestamp, scope and evidence/reference.
- Provide user notification and appeal/review routes unless legally prohibited or doing so would compromise an active investigation.
- Use least-privilege roles; sensitive actions require stronger authentication and may require dual approval.
- No hidden or unaudited account manipulation.
- Separate support, moderation, KYC, payment and super-admin permissions.

## 13. AI Support and FAQ

- Mavora AI Support Assistant for navigation, account help, subscription guidance, safety education and FAQ retrieval.
- Searchable FAQ/help centre with categories, updated articles and escalation to human support.
- AI must not make final KYC, fraud guilt, account termination or payment dispute decisions.
- Clearly identify AI-generated assistance and provide human escalation for sensitive or unresolved cases.
- Do not send identity documents, payment credentials or unnecessary personal data to an AI model.
- Apply rate limits, abuse controls, logging minimisation and retention policy.

## 14. Security, privacy and compliance

Design and assess against applicable laws and standards, including Nigeria NDPA 2023, EU GDPR, UK GDPR and other applicable national/regional laws. Legal applicability must be assessed by jurisdiction; no blanket compliance claim.

Required controls:
- Data minimisation, purpose limitation, privacy notices and consent/other lawful-basis records.
- User rights workflows: access, correction, export/portability where applicable, objection/restriction where applicable, deletion and complaint contact.
- Retention schedule, secure deletion, backup lifecycle and legal holds.
- Encryption in transit and at rest; secrets only in server-side secret storage.
- Strong authentication, optional/required MFA for staff, secure session/device management and login alerts.
- RLS for all user-facing Supabase tables and private storage buckets.
- Threat modelling, dependency scanning, audit logging, backup/restore testing and incident response.
- Data processor agreements and cross-border transfer review for vendors.
- Accurate Google Play Data Safety declarations and in-app/public account deletion process.
- Privacy by default and privacy impact assessment for high-risk processing, including KYC and fraud detection.

## 15. Scam and account safety centre

- Report users, posts, messages, businesses, ads and suspicious links.
- Automated risk signals may prioritise review, but must not be the sole basis for severe enforcement without appropriate safeguards.
- Rate-limit suspicious behaviour and apply graduated interventions.
- Allow staff to place temporary holds, disable accounts, restrict ads or suspend monetisation when justified.
- Preserve evidence securely and limit access.
- Provide appeals and reinstate accounts when cleared.
- Publish clear community standards and scam-prevention guidance.

## 16. Distinctive visual identity

Create an original Mavora design system:
- Unique brand palette and background language.
- Original typography hierarchy, icon set and components.
- Custom navigation and feed layout.
- Distinctive profile, story and business-page templates.
- Light and dark themes, accessibility contrast and reduced-motion support.
- Responsive mobile-first design with web adaptation.
- Avoid Facebook/Instagram logos, brand marks, copied layouts and proprietary assets.

Before building a full UI, present three genuinely distinct Mavora visual directions for selection. Then implement the selected direction consistently across screens.

## 17. Implementation phases

1. Audit and stabilise current Expo, web, API and Supabase foundation.
2. Select Mavora visual direction and establish design tokens/components.
3. Authentication, 18+ eligibility, profile onboarding and account preferences.
4. Profile visibility, friend requests, friendships, follows, blocks and reports.
5. Feed, posts, media, reactions, comments, stories and groups.
6. Messaging, notifications and search/discovery.
7. Individual/business KYC and secure review workflow.
8. Three membership stages, entitlements, regional pricing and billing.
9. Admin dashboard, moderation, scam controls and audit logs.
10. Business pages, marketplace, ads and approval workflow.
11. AI support, FAQ, security and privacy centres.
12. Web parity, accessibility, performance, security testing and Android release.

## 18. Release gates

No production or public release until:
- RLS and authorization tests pass for every role and visibility state.
- Friend/follow/private profile edge cases are tested with multiple accounts.
- KYC vendor, retention and access controls are reviewed.
- Payment webhooks are signature-verified, server-verified and idempotent.
- Admin actions are permissioned and audited.
- Reporting, blocking, moderation and appeals work.
- Account export/deletion and privacy notices are implemented.
- 18+ safeguards are tested.
- Android device, accessibility, network-loss and upgrade tests pass.
- Google Play Billing and current Play policies are checked.
- Data Safety declarations match actual app and SDK behaviour.

## 19. Current source baseline findings

The uploaded repository is a foundation, not a completed social network:
- Mobile app currently provides a basic email auth shell and placeholder tab content.
- Phone OTP is only a request scaffold; the full verification flow is missing.
- Google sign-in is a setup notice/scaffold, not a complete OAuth callback.
- Existing database has profiles, follows, posts, groups, businesses, products, services, messaging, ads, transactions, blocks and reports as starter schema.
- Existing schema has only `free` and `premium` subscription values; it does not yet model three membership stages or KYC review.
- Friend requests, friendship state, profile privacy settings, KYC, FAQ, AI support, admin audit logs and account enforcement workflows are not yet implemented.
- Existing RLS migration explicitly warns that private profile rules and multiple production controls need hardening.
- Expo/EAS project ID and Android package configuration are present; preserve them.

This document is a product/engineering specification. It is not evidence that any listed feature is already implemented or legally certified.
