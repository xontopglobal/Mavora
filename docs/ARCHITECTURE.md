# Mavora — Architecture

## High-level components
- Web frontend: React + Vite, hosted on Netlify
- Backend API: Node.js + Express, hosted on Render
- Android/iOS application: Expo + React Native
- Identity, PostgreSQL and Storage: Supabase
- Payments: Flutterwave for eligible web payment flows; use Google Play Billing for Android digital benefits when Google Play policy requires it

Keep this architecture within the existing services. Do not add AWS, AWS Bedrock, Paystack, or AI services. The mobile support screen is a local prototype with canned responses; it does not connect to an AI service.

## Trust boundaries
Clients are untrusted. Never accept role, subscription status, payment success, ad approval, campaign spend or ownership claims from client-supplied fields without server-side authorization and database constraints.

## API responsibilities
- Validate auth tokens and user identity
- Enforce role and ownership checks
- Validate payment provider callbacks and transaction details
- Enforce Premium entitlements for paid features
- Apply rate limits and request validation
- Keep privileged secrets in server environment variables
- Keep `SUPABASE_SERVICE_ROLE_KEY` and Flutterwave secret credentials exclusively in the trusted backend environment

## Database security
RLS must be enabled for every user-facing table. Sensitive tables such as payments, ad reviews, reports and moderation actions require narrow policies. Test with multiple user roles. Never use service-role credentials in mobile or web builds.

The mobile app reads only Expo `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` values. These are public client configuration, not secrets; RLS and server-side authorization protect data and privileged operations. Never put the Supabase service-role key or Flutterwave secret credentials in an Expo or web environment variable.

## Media
Use private buckets for private content, signed URLs where appropriate, file-size/type validation, image moderation and lifecycle cleanup. Video streaming can be added as a later subsystem.
