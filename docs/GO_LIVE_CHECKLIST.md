# Mavora — Go-Live and Google Play Checklist

## Product completeness
- [ ] Finish feed, profiles, follow graph, comments and reactions
- [ ] Finish group creation, membership, roles, invitations and moderation
- [ ] Finish secure messaging and realtime membership checks
- [ ] Finish business profiles and marketplace listings
- [ ] Finish Premium entitlements and subscription lifecycle
- [ ] Finish manual ad review, approval, payment and campaign delivery
- [ ] Finish admin dashboard, audit logs and support workflows

## Security
- [ ] Threat model and independent security review
- [ ] RLS tests for every table and each user role
- [ ] API auth, authorization, validation and rate limits
- [ ] Secrets only on server; rotate exposed credentials
- [ ] Webhook signature, server-to-server transaction verification and idempotency
- [ ] Abuse, spam, fraud, reporting, blocking and moderation processes
- [ ] Backups, restore test, monitoring and incident response

## Legal and privacy
- [ ] Privacy policy and terms
- [ ] Data retention and export process
- [ ] In-app account deletion and public web deletion request
- [ ] Age rating and minor protections
- [ ] Data Safety form accurate to actual SDK/data behavior
- [ ] Confirm contact address is intended for public display

## Google Play and device testing
- [ ] Confirm package ID and signing ownership
- [ ] Build signed Android App Bundle (AAB)
- [ ] Meet current target API and Play policy requirements
- [ ] Complete app content, content rating and store listing
- [ ] Complete internal/closed testing requirements applicable to the account
- [ ] Test install, upgrade, permissions, network loss and accessibility on real Android phones
- [ ] Test account creation, recovery, deletion, notifications and payment flows
- [ ] Confirm Google Play Billing compliance for digital benefits

## Release gate
Do not submit until all required features, security checks, policy declarations and device tests pass.
