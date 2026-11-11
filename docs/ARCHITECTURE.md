# Mavora — Architecture

## High-level components
- Android/iOS: Expo + React Native
- Web: React + Vite
- API: Node.js + Express
- Identity, PostgreSQL, realtime and storage: Supabase
- Payments: Flutterwave for eligible web payment flows; Google Play Billing where required for Android digital benefits
- Hosting direction: API on Render; web on Vercel; Supabase managed backend

## Trust boundaries
Clients are untrusted. Never accept role, subscription status, payment success, ad approval, campaign spend or ownership claims from client-supplied fields without server-side authorization and database constraints.

## API responsibilities
- Validate auth tokens and user identity
- Enforce role and ownership checks
- Validate payment provider callbacks and transaction details
- Enforce Premium entitlements for paid features
- Apply rate limits and request validation
- Keep privileged secrets in server environment variables

## Database security
RLS must be enabled for every user-facing table. Sensitive tables such as payments, ad reviews, reports and moderation actions require narrow policies. Test with multiple user roles. Never use service-role credentials in mobile or web builds.

## Media
Use private buckets for private content, signed URLs where appropriate, file-size/type validation, image moderation and lifecycle cleanup. Video streaming can be added as a later subsystem.
