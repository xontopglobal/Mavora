# Mavora — Global Social Platform

**Connect. Share. Discover. Grow.**

Project owner / developer contact: **Israel Sunny**  
Organization: **Xontopglobal**  
Contact: xontopglobal@gmail.com · +2348115459455

## Product direction
Android first, responsive web alongside it, iOS later. Mavora is planned as a global social network with profiles, feed, groups, messaging, business listings, a product/service discovery marketplace, Free and Premium accounts, and administrator-reviewed advertising.

## Repository layout
- `apps/mobile` — Expo React Native Android/iOS client
- `apps/web` — responsive React + Vite web client
- `apps/api` — Node.js + Express API
- `supabase/migrations` — database schema, triggers and starter RLS
- `docs` — product requirements, architecture, security and launch checklist

## Current implementation status
This pack is a development foundation, not a finished or production-ready social network. It includes runnable client shells, an API foundation, database migrations and implementation notes. The feed, full group workflows, realtime messaging, media pipelines, complete Google OAuth/deep linking, subscription entitlements, Flutterwave transaction verification, admin console, moderation workflows, analytics and account deletion still require implementation and testing.

## Prerequisites
- Node.js 20 LTS or newer compatible LTS
- Git
- VS Code
- Supabase project
- Android phone with Expo Go for early testing, or Android Studio emulator
- Expo account / EAS CLI when preparing installable builds

## Start Android app
```bash
cd apps/mobile
copy .env.example .env
npm install
npx expo start
```
On Windows PowerShell, `copy` works. Add Supabase public URL and anon key to `.env`. Scan the QR code using Expo Go. A development build is needed for some native integrations and final device testing.

## Start web app
```bash
cd apps/web
copy .env.example .env
npm install
npm run dev
```

## Start API
```bash
cd apps/api
copy .env.example .env
npm install
npm run dev
```
Health check: `http://localhost:8787/health`

## Supabase setup
1. Create a Supabase project.
2. Open SQL Editor.
3. Run migration files in ascending order from `supabase/migrations`.
4. Configure Auth providers, redirect URLs, email templates and phone/SMS provider.
5. Never expose the Supabase service-role key in either client app.
6. Review and test every RLS policy with separate user accounts before real data is used.

## Google sign-in
The clients include an OAuth entry point scaffold. Configure Google provider credentials and redirect URLs in Supabase and implement/test the correct Expo AuthSession/deep-link flow for the chosen Expo SDK before release. Do not assume Google sign-in is complete merely because the button exists.

## Payments
Use Flutterwave test mode first. The API webhook route is only a secure starting point: production implementation must verify the provider signature, fetch and verify the transaction server-to-server, validate expected amount/currency/reference, process idempotently, and record an audit trail. Do not activate subscriptions or ads from a client redirect.
Google Play Billing rules may require Play Billing for digital Premium benefits sold inside Android. Confirm current Google Play requirements and eligible regional programs before launch.

## Before production or Play Store submission
Complete the release checklist in `docs/GO_LIVE_CHECKLIST.md`. In particular: security audit, RLS tests, moderation/report/block, privacy policy, terms, account deletion, age protections, Data Safety declaration, content rating, app signing, target API requirements, internal/closed testing and actual Android-device testing.

## Brand and public contact details
The supplied address is included in the private project contact record. Confirm it is intended for public display before publishing it in app listings or legal pages.
