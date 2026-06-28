# Where2Go Goal-Based Feature Tracker

Last verified: June 27, 2026

Local app:

```text
http://127.0.0.1:3000
```

## Status Legend

| Status | Meaning |
|---|---|
| Done | Implemented and verified locally |
| Working | Implemented and working for the currently available local environment |
| Credential-gated | Implemented, but blocked from full verification until API keys or production services are configured |
| Partial | Some implementation exists, but important behavior is missing |
| Pending | Not implemented yet |

## Verification Snapshot

| Check | Result | Notes |
|---|---|---|
| `pnpm typecheck` | Pass | All workspace packages typecheck |
| `pnpm lint` | Pass | Web app and shared packages pass lint/type lint |
| `pnpm build` | Pass | Next.js production build succeeds |
| `pnpm vercel:whoami` | Fails as expected | Non-interactive check reports no `VERCEL_TOKEN` or readable CLI auth token |
| `pnpm vercel:bootstrap` | Fails as expected | Missing `VERCEL_TOKEN`; dry-run is non-mutating and cannot inspect/create/link the Vercel project without REST auth |
| `pnpm vercel:env:sync` | Fails as expected | Repo is not linked to Vercel; missing `.vercel/project.json` |
| `pnpm milestone0:check` | Fails as expected | `.env.local` exists with non-secret defaults; P0 provider keys and `DATABASE_URL` are missing |
| `pnpm milestone0:check:vercel` | Fails as expected | Repo is not linked to Vercel; missing `.vercel/project.json`; CLI login is required |
| `pnpm milestone0:smoke` | Fails as expected | Google/Ticketmaster/Postgres smoke tests are blocked until P0 keys are present |
| `GET /api/provider-health` | Pass | Reports provider configuration accurately |
| `POST /api/plans/generate` | Credential-gated | Local form submission reaches the API and returns `424 Failed Dependency` until event/place provider keys are configured |
| `POST /api/ai/parse-request` | Partial | Route works, but local Ollama model `llama3.1` is missing and cloud AI keys are absent |
| Desktop browser flow | Credential-gated | Playwright loads the app, fills the request form, and submits; screenshot saved at `outputs/local-web-smoke.png`; plan generation is blocked by missing provider keys |
| Mobile browser flow | Pass | Previously verified at 390px viewport |

Current provider health:

| Provider | Current status | Meaning |
|---|---|---|
| Google Maps Platform | `not_configured` | Missing `GOOGLE_MAPS_API_KEY` |
| Google Places | `not_configured` | Missing `GOOGLE_MAPS_API_KEY` |
| Google Web Search | `not_configured` | Missing `GOOGLE_SEARCH_API_KEY` and `GOOGLE_SEARCH_ENGINE_ID` |
| Google AI / Gemini | `not_configured` | Missing `GOOGLE_AI_API_KEY` and `GOOGLE_AI_MODEL` |
| Ticketmaster | `not_configured` | Missing `TICKETMASTER_API_KEY` |
| Open-Meteo weather | `configured` | Keyless real weather fallback works |
| Ollama | `configured` by endpoint default, AI call fails | `llama3.1` model is not installed locally |
| OpenRouter | `not_configured` | Missing `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` |
| OpenAI | `not_configured` | Missing `OPENAI_API_KEY` and `OPENAI_MODEL` |
| Postgres storage | `not_configured` | Missing `DATABASE_URL`; using local memory store |

## Goal 1: Develop Once, Deploy Everywhere Foundation

| Feature | Status | Implemented in | Working verification | Missing / next step |
|---|---|---|---|---|
| pnpm workspace | Done | `pnpm-workspace.yaml`, `package.json` | Build/typecheck/lint pass | None |
| Vercel-ready web app | Done | `apps/web` | `next build` passes | Configure Vercel project/env vars |
| Vercel project settings verifier | Done | `scripts/verify-milestone-0.mjs` | Checks expected `rootDirectory=apps/web` and `framework=nextjs` when linked with `VERCEL_TOKEN` | Requires Vercel link and token |
| Shared API schemas | Done | `packages/schemas` | Imported by API, UI, core | Add generated client SDK later |
| Shared recommendation core | Done | `packages/core` | Typecheck/build pass | Tune scoring with real usage data |
| Shared provider layer | Done | `packages/providers` | Provider health and no-candidate path pass | Add live-key verification |
| Milestone 0 verifier | Done | `scripts/verify-milestone-0.mjs` | Reports missing local/Vercel env gates correctly | Rerun after secrets and Vercel link are added |
| Provider smoke verifier | Done | `scripts/smoke-providers.mjs` | Reports missing keys correctly | Rerun after secrets are added |
| Non-interactive Vercel auth check | Done | `scripts/check-vercel-auth.mjs` | Reports missing token/auth without starting device login | Run after `pnpm vercel:login` or `VERCEL_TOKEN` setup |
| Vercel project bootstrap script | Done | `scripts/bootstrap-vercel-project.mjs` | Dry-run is non-mutating; fails safely until `VERCEL_TOKEN` exists | Run `pnpm vercel:bootstrap:apply` after token setup |
| Vercel settings repair script | Done | `scripts/configure-vercel-project.mjs` | Fails safely until `.vercel/project.json` and `VERCEL_TOKEN` exist | Run after Vercel link/auth |
| Vercel env sync script | Done | `scripts/sync-vercel-env.mjs` | Fails safely until `.vercel/project.json`, `VERCEL_TOKEN`, and real P0 values exist | Run after Vercel link/auth and local secrets |
| Native app reuse strategy | Pending | Planned architecture only | Not started | Build Expo/mobile shell after web loop works |
| Desktop app reuse strategy | Pending | Planned architecture only | Not started | Build Tauri/Electron shell after web loop works |

## Goal 2: Let a Family Request an Outing

| Feature | Status | Implemented in | Working verification | Missing / next step |
|---|---|---|---|---|
| Natural-language request input | Done | `apps/web/src/components/where2go-app.tsx` | Browser flow verified | AI parsing should prefill controls after AI provider works |
| Location label and coordinates | Done | `where2go-app.tsx` | Generate button enables after location fields are entered | Add address autocomplete/geocoding |
| Browser geolocation button | Working | `where2go-app.tsx` | UI implemented | Needs manual browser permission test |
| Date/start/home-by controls | Done | `where2go-app.tsx` | Browser flow verified | Add timezone display and validation copy |
| Budget, drive, adults, kids controls | Done | `where2go-app.tsx` | Browser flow verified | Save defaults to authenticated profile later |
| Indoor/outdoor and meal controls | Done | `where2go-app.tsx` | Browser flow verified | Add finer categories |
| Interest and avoid controls | Done | `where2go-app.tsx` | Browser flow verified | Add preference learning |
| Quick presets | Done | `where2go-app.tsx` | Browser flow verified | Add more presets after user testing |

## Goal 3: Use Real Local Signals

| Feature | Status | Implemented in | Working verification | API keys / next step |
|---|---|---|---|---|
| Weather lookup | Working | `packages/providers/src/index.ts` | Open-Meteo returns real weather status | Decide whether to keep Open-Meteo or move to Tomorrow/OpenWeather for production terms |
| Google Places activity search | Credential-gated | `packages/providers/src/index.ts` | Reports missing key correctly | Set `GOOGLE_MAPS_API_KEY` |
| Google Places restaurant search | Credential-gated | `packages/providers/src/index.ts` | Reports missing key correctly | Set `GOOGLE_MAPS_API_KEY` |
| Google ratings/reviews/hours/map links | Credential-gated | Google Places adapter | Not live-verified | Set `GOOGLE_MAPS_API_KEY` and verify field masks |
| Google web search discovery | Credential-gated | `packages/providers/src/index.ts` | Reports missing key correctly | Set `GOOGLE_SEARCH_API_KEY` and `GOOGLE_SEARCH_ENGINE_ID` |
| Ticketmaster event discovery | Credential-gated | `packages/providers/src/index.ts` | Reports missing key correctly | Set `TICKETMASTER_API_KEY` |
| Google Routes real travel time | Pending | Not implemented | Not available | Add Routes API adapter and traffic-aware route scoring |
| Eventbrite events | Pending | Not implemented | Not available | Add Eventbrite provider if API access is available |
| Meetup/community events | Pending | Not implemented | Not available | Add Meetup or alternative community event source |
| City/tourism/parks calendars | Pending | Not implemented | Not available | Add city feed ingestion by launch market |
| Yelp food enrichment | Pending | Declared in `.env.example`, not wired | Not available | Implement Yelp adapter or remove from env plan |
| Parking integrations | Pending | Not implemented | Not available | Add SpotHero/ParkWhiz only after event/place loop works |
| NPS/nature data | Pending | Not implemented | Not available | Add National Park Service API if outdoor trips become priority |

## Goal 4: Generate a Useful Plan

| Feature | Status | Implemented in | Working verification | Missing / next step |
|---|---|---|---|---|
| Candidate normalization | Done | `packages/providers` and `packages/schemas` | Typecheck/build pass | Live-provider data QA after keys |
| Deterministic scoring | Done | `packages/core/src/index.ts` | Typecheck/build pass | Tune weights with real feedback |
| Budget fit calculation | Done | `packages/core/src/index.ts` | Covered by core path | Needs live price validation |
| Drive-limit scoring | Partial | `packages/core/src/index.ts` | Uses provider distance/estimates | Replace with Google Routes travel time |
| Weather-aware scoring | Done | `packages/core/src/index.ts` | Weather provider works | More nuanced heat/rain thresholds |
| Family/age fit scoring | Partial | `packages/core/src/index.ts` | Basic min/max age support | Most providers do not supply age ranges |
| Best plan selection | Credential-gated | `packages/core/src/index.ts` | Core works; no live candidates locally | Requires Google/Ticketmaster candidates |
| Cheaper backup | Credential-gated | `packages/core/src/index.ts` | Core implemented | Requires multiple candidates |
| Rain/low-effort backup | Credential-gated | `packages/core/src/index.ts` | Core implemented | Requires multiple candidates |
| Timeline construction | Credential-gated | `packages/core/src/index.ts` | Core implemented | Verify after successful live plan |
| Directions and booking actions | Credential-gated | `packages/core` and providers | Links generated when URLs exist | Verify with live candidates |
| Successful plan result E2E | Credential-gated | API/UI implemented | Blocked | Configure providers and run happy path |

## Goal 5: Explain Recommendations With Cheap AI

| Feature | Status | Implemented in | Working verification | API keys / next step |
|---|---|---|---|---|
| AI provider order | Done | `AI_PROVIDER_ORDER`, `packages/providers` | Code path verified | Tune provider priority per environment |
| Google AI / Gemini calls | Credential-gated | `packages/providers/src/index.ts` | Reports missing key/model | Set `GOOGLE_AI_API_KEY`, `GOOGLE_AI_MODEL` |
| Ollama OpenAI-compatible calls | Partial | `packages/providers/src/index.ts` | Endpoint attempted; model missing | Run `ollama pull llama3.1` or set `OLLAMA_MODEL` to installed model |
| OpenRouter calls | Credential-gated | `packages/providers/src/index.ts` | Reports missing key/model | Set `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` |
| OpenAI calls | Credential-gated | `packages/providers/src/index.ts` | Reports missing key/model | Set `OPENAI_API_KEY`, `OPENAI_MODEL` |
| AI request parsing | Partial | `/api/ai/parse-request` | Route works; all AI providers unavailable/failing | Configure one AI provider |
| AI plan explanation | Credential-gated | `explainPlanWithAI` | Code path implemented | Needs successful plan + AI provider |
| No hallucinated facts guardrail | Done | AI system prompt | Implemented | Add eval tests |
| Cost controls | Partial | Provider order exists | No telemetry yet | Add per-call logging, budget caps, model fallback policy |

## Goal 6: Save, Share, and Learn

| Feature | Status | Implemented in | Working verification | Missing / next step |
|---|---|---|---|---|
| Plan storage | Working locally | `apps/web/src/lib/plan-store.ts` | Memory mode works | Set `DATABASE_URL` for durable storage |
| Postgres schema bootstrap | Done | `plan-store.ts` | Build/typecheck pass | Verify against real Postgres |
| Fetch plan by ID | Done | `/api/plans/[planId]` | Missing-plan 404 verified | Happy path requires generated plan |
| Feedback endpoint | Done | `/api/plans/[planId]/feedback` | Missing-plan 404 verified after fix | Happy path requires generated plan |
| Share endpoint | Credential-gated by generated plan | `/api/plans/[planId]/share` | Missing plan protection exists | Happy path requires generated plan |
| Public share resolve | Done | `/api/share/[shareToken]` | Missing-share 404 verified | Happy path requires generated plan/share |
| Anonymous profile | Working locally | `/api/profiles/me` | Profile read/write verified | Replace with real auth/user ID |
| Authenticated profiles | Pending | Not implemented | Not available | Add Clerk/Auth0/Descope or chosen auth provider |
| Preference learning | Pending | Feedback stored only | Not available | Convert feedback into ranking signals |

## Goal 7: Web User Experience and Brand

| Feature | Status | Implemented in | Working verification | Missing / next step |
|---|---|---|---|---|
| Responsive MVP planning UI | Done | `where2go-app.tsx` | Desktop/mobile browser flows pass | Add deeper empty/loading/success polish |
| Provider health panel | Done | `where2go-app.tsx`, `/api/provider-health` | Verified | Add admin-only mode later |
| Clear provider-gated error state | Done | UI and API error envelope | Verified with `NO_CANDIDATES` | Add setup help links for dev/admin |
| LinkedIn blue palette | Done | `globals.css`, design spec | Build/browser smoke passed | None |
| Family-led-by-woman logo | Done | `apps/web/public/where2go-logo.png` | Browser smoke passed | Consider vector/SVG refinement for crisp app icon |
| Results view shell | Credential-gated | `where2go-app.tsx` | Not live-verified with successful plan | Needs real candidates |
| Timeline visual | Credential-gated | `where2go-app.tsx` | Not live-verified with successful plan | Needs real candidates |
| Alternatives panel | Credential-gated | `where2go-app.tsx` | Not live-verified with successful plan | Needs multiple candidates |
| Map rendering | Pending | Not implemented | Not available | Add map component after Google Maps key/client restrictions |
| Saved/Profile full pages | Pending | Nav placeholders only | Not available | Add routes and authenticated UX |

## Goal 8: API Endpoint Tracker

| Method | Endpoint | Status | Notes |
|---|---|---|---|
| `POST` | `/api/plans/generate` | Working / credential-gated | Works through no-provider path; successful plan blocked by keys |
| `GET` | `/api/plans/{planId}` | Done | Missing-plan 404 verified |
| `POST` | `/api/plans/{planId}/feedback` | Done | Now validates plan existence |
| `POST` | `/api/plans/{planId}/share` | Credential-gated | Requires stored plan |
| `GET` | `/api/share/{shareToken}` | Done | Missing-share 404 verified |
| `GET` | `/api/profiles/me` | Working locally | Anonymous profile only |
| `PUT` | `/api/profiles/me` | Working locally | Memory/Postgres-backed store |
| `POST` | `/api/ai/parse-request` | Partial | Route works; no configured working AI model |
| `GET` | `/api/provider-health` | Done | Current provider status verified |

## API Key and Environment Tracker

| Environment variable | Required for | Current local state | Priority |
|---|---|---|---|
| `GOOGLE_MAPS_API_KEY` | Places, restaurants, ratings, hours, map links, future routes | Missing | P0 |
| `GOOGLE_SEARCH_API_KEY` | Google Programmable Search JSON API | Missing | P0 |
| `GOOGLE_SEARCH_ENGINE_ID` | Programmable Search engine ID (`cx`) | Missing | P0 |
| `GOOGLE_AI_API_KEY` | Google AI / Gemini model calls | Missing | P0 |
| `GOOGLE_AI_MODEL` | Gemini model selection | Present in `.env.local` as `gemini-2.5-flash` | P0 |
| `TICKETMASTER_API_KEY` | Ticketed events | Missing | P0 |
| `OLLAMA_BASE_URL` | Local/remote Ollama endpoint | Present in `.env.local` as `http://localhost:11434` | P1 |
| `OLLAMA_MODEL` | Ollama model name | Present in `.env.local` as `llama3.1`, but model is not installed | P1 |
| `OPENROUTER_API_KEY` | Cheap cloud AI fallback | Missing | P1 |
| `OPENROUTER_MODEL` | OpenRouter model selection | Missing | P1 |
| `OPENROUTER_SITE_URL` | OpenRouter attribution | Optional, default local URL | P2 |
| `OPENAI_API_KEY` | OpenAI cloud AI fallback | Missing | P1 |
| `OPENAI_MODEL` | OpenAI model selection | Missing | P1 |
| `DATABASE_URL` | Durable plans, shares, feedback, profiles | Missing; memory mode active | P0 before production |
| `TOMORROW_API_KEY` | Production weather alternative | Declared but not wired | P3 |
| `OPENWEATHER_API_KEY` | Production weather alternative | Declared but not wired | P3 |
| `YELP_API_KEY` | Optional restaurant enrichment | Declared but not wired | P3 |

## Production Readiness Gaps

| Gap | Why it matters | Suggested next action |
|---|---|---|
| No real activity provider credentials | App cannot return actual outing plans | Configure Google Maps/Places, Google Web Search, and Ticketmaster first |
| No durable database configured | Local memory data disappears on restart | Add Vercel Postgres/Neon/Supabase and set `DATABASE_URL` |
| No auth | Profiles are anonymous and shared | Add auth before private saved plans |
| Ollama model missing | Local AI parsing/explanation fails | Install `llama3.1` or change `OLLAMA_MODEL` |
| No cloud AI provider configured | Vercel cannot rely on localhost Ollama | Configure Google AI first, then OpenRouter or OpenAI as fallbacks |
| Vercel CLI login required | Local CLI cannot link or deploy the project | Run `pnpm vercel:login` or set a valid `VERCEL_TOKEN` |
| No successful real-plan E2E | Core happy path is not proven with live data | Run E2E after provider keys are configured |
| No map or route-time UI | User cannot visually inspect route yet | Add Google Maps/Routes after key setup |
| No rate limiting | Anonymous generation can be abused | Add rate limits before public deployment |
| No observability | Provider failures are only visible in responses | Add logs, request IDs, metrics, and error tracking |
| No automated test suite committed | Current E2E is ad hoc via browser automation | Add Playwright tests to repo |

## Recommended Goal Order

1. P0: Configure Google Maps/Places, Google Web Search, Google AI, and Ticketmaster in local `.env.local` and Vercel.
2. P0: Add durable Postgres storage and verify generated plans can be saved, shared, and fetched after restart.
3. P1: Make Google AI work locally and on Vercel, then configure OpenRouter/OpenAI as fallbacks or install a local Ollama model.
4. P1: Run successful real-candidate E2E: request -> generated plan -> share -> feedback.
5. P1: Add Google Routes travel times and map rendering.
6. P2: Add auth and real profile pages.
7. P2: Add committed Playwright tests and CI.
8. P3: Add optional providers: Yelp, city/tourism feeds, Eventbrite/Meetup alternatives, parking, NPS.
9. P3: Start Expo mobile and desktop shells after the web recommendation loop is validated with live data.
