# SafeTrip AI — Production Readiness & App Store Launch Plan

_Last updated: June 18, 2026_

This document describes what already exists, and exactly what still needs to be
built, configured, and verified before SafeTrip AI can be shipped to the Apple
App Store and Google Play as a dependable, real-world safety product.

Because SafeTrip is a **safety app**, the bar is higher than for a typical
consumer app: the emergency-alert path must work reliably even when things go
wrong (phone dead, app closed, server restarting, carrier delays). Most of the
remaining work below is about closing that reliability gap and satisfying the
two app stores' policy requirements.

---

## 1. What's already built

**Mobile app (Expo, iOS + Android)**
- Clerk authentication (email + password + Google sign-in), auth-gated app shell.
- Tabs: Home dashboard, Map, Contacts, Settings.
- Safety Timer with countdown, extend, and "I'm safe"; on expiry it escalates.
- OS-level local notification scheduled at the timer's expiry so a missed
  check-in still alerts the traveler when the app is **closed or backgrounded**.
- Smart Check-ins (landed / at hotel / leaving / I'm safe) with location pins.
- Emergency Contacts CRUD with a primary contact.
- Trips (create / edit / end / reactivate), surfaced as the active trip on Home.
- "Send Safety Package" via the native SMS composer — includes battery %, last
  known location, destination, and route; respects share-location settings.
- Battery safety mode (low-battery SOS prompt).
- AI Hotel Safety Scanner (0–100 scores).
- Settings: profile, battery thresholds, privacy, and a Permissions section for
  notification + location status.

**Backend (Express + PostgreSQL, Drizzle ORM)**
- Clerk auth proxy + `requireAuth` with just-in-time user provisioning.
- Per-user authorized REST API for all resources + `/dashboard/summary`.
- AI Hotel Scanner endpoint (OpenAI via the Replit AI integration).
- Server-side escalation: a 30-second sweep that claims lapsed safety timers
  (idempotently, via `escalated_at`) and **texts emergency contacts through
  Twilio**, with per-contact delivery tracking and bounded retry/backoff.

**Quality**
- Unit tests for safety-critical logic (scanner scale, timer expiry) and
  integration tests for the escalation sweep (16 tests passing).

---

## 2. Critical gaps before production

These are the items that genuinely block a trustworthy launch. They are ordered
by impact on user safety.

### 2.1 Backend hosting must be always-on and single-instance
- The escalation scheduler is an **in-process 30-second timer** guarded by a
  single-process flag (no cross-instance lock). This has two consequences:
  - It must run on an **always-on deployment** (Replit Reserved VM), **not** an
    autoscale deployment — autoscale scales to zero when idle, which would stop
    the scheduler and silently prevent emergency texts from ever being sent.
  - It must run as **exactly one instance**. Two instances would either
    double-send alerts or race on claiming timers.
- **Action:** deploy the API server as a Reserved VM (single instance), confirm
  the scheduler logs a heartbeat in production, and add an external uptime
  monitor that pages someone if the server goes down.

### 2.2 Real SMS deliverability (Twilio production setup)
- The code is wired for Twilio via `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
  and `TWILIO_PHONE_NUMBER`, but the currently connected account holds **test
  credentials that cannot text real phone numbers**.
- For production SMS in the US you must complete carrier compliance or messages
  will be filtered/blocked:
  - **A2P 10DLC** brand + campaign registration for a local long code, **or** a
    **verified toll-free number**, **or** a short code.
  - International recipients require sender IDs / numbers valid in their country.
- **Action:** provision a real Twilio account, buy/verify a sending number,
  complete 10DLC (or toll-free verification), set the three secrets in the
  production environment, and send end-to-end test alerts to real handsets.

### 2.3 Confirm delivery, not just "sent"
- Today a "sent" status means Twilio **accepted** the message, not that the
  carrier **delivered** it. For a safety app that distinction matters.
- **Action:** add a Twilio status-callback webhook to record `delivered` /
  `undelivered` / `failed`, and surface true delivery state in the app's
  escalation summary. (Proposed as a follow-up task.)

### 2.4 Escalate further when no contact can be reached
- If every contact text fails, the system currently exhausts retries and stops.
- **Action:** define and implement a fallback (e.g. notify a secondary channel,
  email, or a clearly-communicated limitation). At minimum, make the app tell
  the traveler plainly that no contact could be reached.

### 2.5 Production auth (Clerk) configuration
- The app currently runs against a **development Clerk instance**.
- **Action:** create the Clerk **production instance**, configure production
  Google OAuth credentials, set the production publishable/secret keys in both
  the mobile build and the backend, and (recommended) a custom auth domain.

### 2.6 Mobile app must point at the production API
- The app resolves its API base URL from `EXPO_PUBLIC_DOMAIN`. Store builds must
  bake in the **deployed backend URL**, not a Replit dev domain.
- **Action:** set `EXPO_PUBLIC_DOMAIN` to the production API domain in the EAS
  production build profile and verify a release build talks to prod.

---

## 3. App Store / Play Store requirements

### 3.1 Build & submission pipeline (EAS)
- There is **no `eas.json`** yet, so the project can't produce store binaries.
- **Action:** add EAS Build profiles (development / preview / production), wire
  credentials, and use EAS Submit for both stores. You'll need:
  - Apple: a paid **Apple Developer Program** account, App Store Connect app
    record, bundle id `com.safetrip.app`, signing handled by EAS.
  - Google: a **Google Play Developer** account, a Play Console app, an upload
    key / Play App Signing, and a service-account JSON for EAS Submit.
- Manage `ios.buildNumber` and `android.versionCode` increments per release.

### 3.2 Store assets & metadata
- The app reuses a single `icon.png` for icon, splash, and favicon.
- **Action:** produce proper assets:
  - iOS app icon set, Android **adaptive icon** (foreground + background layers),
    and a polished splash screen.
  - Phone (and required tablet, if any) **screenshots** for both stores.
  - Google Play **feature graphic**, short/long descriptions, category.
  - App name, subtitle/keywords, support URL, marketing URL.

### 3.3 Privacy & policy (both stores scrutinize this for safety/location apps)
- **Action:**
  - Publish a **Privacy Policy** and **Terms of Service** (URLs required by both
    stores) covering location, contacts, and SMS data.
  - Complete Apple's **App Privacy** "nutrition label" and Google Play's **Data
    Safety** form accurately (location, account data, etc.).
  - Justify location usage strings (already present) and confirm you only use
    **when-in-use** location (no background location entitlement is requested,
    which keeps review simpler).
  - **Apple requires in-app account deletion** — add a "Delete account" flow
    that removes the user and their data server-side.
  - Provide a **demo account** and reviewer notes (how to trigger a safety timer
    / see an alert) so reviewers can exercise the core flow.
  - Add a clear **in-app disclaimer**: SafeTrip is not a replacement for calling
    emergency services, and SMS delivery is best-effort/carrier-dependent.

---

## 4. Hardening & reliability (strongly recommended)

- **Crash & error monitoring:** add Sentry (or similar) on mobile and backend so
  field failures of the safety path are visible.
- **Backend robustness:** request validation on all routes, rate limiting on
  auth and AI endpoints, structured logging/alerting, and a real healthcheck
  that the uptime monitor watches.
- **Database:** move from `drizzle-kit push` to **versioned migrations** for
  production, and enable automated **backups** + a tested restore.
- **AI scanner:** handle model/timeout/quota errors gracefully so a scanner
  failure never shows a misleadingly "safe" score; confirm model availability
  and latency in the deployed environment.
- **Secrets management:** ensure all production secrets (`CLERK_*`, `TWILIO_*`,
  `DATABASE_URL`, OpenAI access) are set in the production environment only.

---

## 5. Testing before release

- **On real devices** (cannot be verified in this environment): notification
  delivery when the app is closed/locked/killed; end-to-end SMS to real phones;
  battery-SOS; location permission grant/deny paths.
- Expand automated coverage for delivery retries and the dashboard escalation
  summary.
- Run a full **beta** via TestFlight (iOS) and Play **Internal/Closed testing**
  with real users before public release.

---

## 6. Suggested launch sequence

1. Stand up production backend (Reserved VM, single instance) + production
   Postgres with migrations and backups.
2. Configure production Clerk + Twilio (with 10DLC/toll-free) + secrets; send
   real end-to-end test alerts.
3. Add `eas.json`, account-deletion flow, disclaimers, and crash monitoring.
4. Produce icons/splash/screenshots and write store listings + privacy policy.
5. Build with EAS pointing at the production API; complete App Privacy / Data
   Safety forms.
6. Beta test on TestFlight + Play Internal testing on real devices.
7. Submit for review with a demo account and reviewer notes; iterate on feedback.
8. Release, then watch uptime, crash, and SMS-delivery dashboards closely.

---

### Quick status snapshot

| Area | Status |
| --- | --- |
| Core mobile features | Built |
| Backend API + auth | Built |
| Server-side SMS escalation (code) | Built |
| Automated safety-logic tests | Built |
| Always-on single-instance hosting | **To do** |
| Production Twilio + 10DLC/toll-free | **To do** |
| SMS delivery confirmation | **To do** |
| Production Clerk instance | **To do** |
| EAS build/submit config | **To do** |
| Store assets + listings | **To do** |
| Privacy policy + store privacy forms | **To do** |
| In-app account deletion (Apple) | **To do** |
| Crash/error monitoring | **To do** |
| DB migrations + backups | **To do** |
| Real-device + beta testing | **To do** |
