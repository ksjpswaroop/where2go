# Where2Go Web App First Build Goals

Last updated: June 27, 2026

This document narrows the product plan to the web app only.
Mobile and desktop apps should wait until the web recommendation loop is proven with real provider data.

## Web App Build Principle

The first web app should not try to be a full event marketplace.
It should prove one loop:

```text
User asks where to go -> app finds real candidates -> app ranks options -> user acts, shares, or gives feedback
```

Everything below is sequenced to validate that loop.

## Milestone 0: Make Local and Vercel Environments Real

Goal: remove the current credential blockers so the app can generate real plans.

| Item | Status | Acceptance criteria | Priority |
|---|---|---|---|
| Configure Google Maps/Places | Not started | `GET /api/provider-health` reports `google-maps-platform: configured` and `google-places: configured` | P0 |
| Configure Google Web Search | Not started | `GET /api/provider-health` reports `google-web-search: configured` | P0 |
| Configure Google AI / Gemini | Not started | `GET /api/provider-health` reports `google-ai: configured` | P0 |
| Configure Ticketmaster | Not started | `GET /api/provider-health` reports `ticketmaster: configured` | P0 |
| Configure durable database | Not started | `GET /api/provider-health` reports `postgres-storage: configured` | P0 |
| Add repeatable environment verifier | Done | `pnpm milestone0:check` and `pnpm milestone0:check:vercel` report exact local/Vercel blockers | P0 |
| Add provider smoke verifier | Done | `pnpm milestone0:smoke` proves Google Places, Google Web Search, Google AI, Ticketmaster, and Postgres can be reached with configured keys | P0 |
| Verify Vercel project settings | Done | `pnpm milestone0:check:vercel` checks the linked project uses `rootDirectory=apps/web` and `framework=nextjs` when `VERCEL_TOKEN` is present | P0 |
| Configure fallback AI provider | Not started | OpenRouter or OpenAI is configured for non-Google fallback | P1 |
| Mirror env vars on Vercel | Not started | Vercel preview has same provider health as local | P0 |

Required environment variables:

| Variable | Required for |
|---|---|
| `GOOGLE_MAPS_API_KEY` | Places, restaurants, ratings, hours, map links |
| `GOOGLE_SEARCH_API_KEY` + `GOOGLE_SEARCH_ENGINE_ID` | Google web search discovery |
| `GOOGLE_AI_API_KEY` + `GOOGLE_AI_MODEL` | Google AI / Gemini parsing and explanation |
| `TICKETMASTER_API_KEY` | Ticketed events |
| `DATABASE_URL` | Durable plans, shares, feedback, profiles |
| `OLLAMA_BASE_URL` + `OLLAMA_MODEL` | Local or hosted Ollama AI |
| `OPENROUTER_API_KEY` + `OPENROUTER_MODEL` | Cheap cloud AI fallback |
| `OPENAI_API_KEY` + `OPENAI_MODEL` | OpenAI fallback |

Milestone exit:

```text
Provider health shows at least Google Maps/Places, Google Web Search, Google AI, Ticketmaster, and database available.
pnpm milestone0:check passes locally.
pnpm milestone0:smoke passes locally.
pnpm milestone0:check:vercel passes after the Vercel project is linked and configured for apps/web.
```

## Milestone 1: Generate a Real Successful Plan

Goal: make the core flow return a real plan, not only the current `NO_CANDIDATES` state.

| Feature | Current state | Web app goal | Acceptance criteria |
|---|---|---|---|
| Plan request form | Implemented | Keep as primary first screen | User can submit location, budget, time, family size, interests |
| Real candidate retrieval | Credential-gated | Fetch live Google Maps/Places, Google Web Search, and Ticketmaster candidates | API response includes at least one real event/place candidate in a target city |
| Candidate normalization | Implemented | Validate real provider payloads | No malformed candidates crash scoring |
| Plan scoring | Implemented | Tune first practical weights | Best plan respects budget, drive limit, weather, and family constraints |
| Best plan response | Credential-gated | Return `status: ready` or `partial` with `bestPlan` | UI renders real title, stops, cost, timeline, reasons, and actions |
| Backups | Credential-gated | Generate cheaper and rain/low-effort backups when enough candidates exist | UI shows up to two meaningful alternatives |

Milestone exit:

```text
A Dallas-area test request produces a real plan with at least one action link and one explanation.
```

## Milestone 2: Make Results Actionable

Goal: turn generated output into a usable family decision screen.

| Feature | Current state | Web app goal | Acceptance criteria |
|---|---|---|---|
| Result card | Implemented shell | Polish real successful result state | Best plan is readable on desktop and mobile |
| Cost display | Implemented | Show confidence and caveats | User can distinguish exact provider prices from estimates |
| Timeline | Implemented shell | Verify with real plan data | Timeline shows leave, activity, meal, and return steps |
| Actions | Implemented | Confirm directions/tickets/website links | Action buttons open valid external destinations |
| Alternatives | Implemented shell | Make backups comparable | User can compare cost and travel at a glance |
| Provider caveats | Implemented | Keep factual and short | Missing prices/hours are visible without overwhelming user |

Milestone exit:

```text
A user can choose whether to do the plan without reading debug output or raw provider data.
```

## Milestone 3: Add Map and Travel Reality

Goal: answer whether the family can actually get there.

| Feature | Current state | Web app goal | Acceptance criteria |
|---|---|---|---|
| Map view | Pending | Add Google map or static route preview | User sees candidate/stops spatially |
| Google Routes travel time | Pending | Add traffic-aware travel estimates | Drive estimates come from Routes API, not distance heuristics |
| Route caveats | Pending | Surface traffic/time risk | UI flags when plan exceeds drive limit |
| Nearby food routing | Partial | Choose food near activity or route | Meal stop does not create unreasonable detour |

Milestone exit:

```text
The plan includes live travel time, not just approximate distance-based driving.
```

## Milestone 4: Persist, Share, and Learn

Goal: make generated plans useful after the first request.

| Feature | Current state | Web app goal | Acceptance criteria |
|---|---|---|---|
| Database persistence | Postgres path implemented, not configured | Use real database locally/preview | Plans survive server restart |
| Share link | Implemented but happy path blocked | Verify with real generated plan | Public share URL loads the same plan |
| Feedback | Implemented | Capture accept/reject/save on real plans | Feedback persists and rejects nonexistent plan IDs |
| Anonymous profile | Implemented | Keep for MVP | User defaults persist during session/runtime |
| Auth profile | Pending | Add before private saved plans | Signed-in user can save/reload family defaults |

Milestone exit:

```text
A real generated plan can be shared and feedback can be stored durably.
```

## Milestone 5: Deploy Web MVP on Vercel

Goal: get a working preview/prod web app before starting native shells.

| Feature | Current state | Web app goal | Acceptance criteria |
|---|---|---|---|
| Vercel build | Locally buildable | Deploy preview | Preview deployment builds successfully |
| Environment variables | Missing | Configure provider keys and database | Provider health is healthy on preview |
| Error handling | Implemented basic envelope | Production-safe messages | User sees clear recovery action; secrets never leak |
| Rate limiting | Pending | Protect anonymous generation | Abusive repeated generation is throttled |
| Observability | Pending | Add logs/metrics/error tracking | Provider failures can be diagnosed from logs |
| Smoke tests | Manual/ad hoc | Add repeatable Playwright tests | CI or local script verifies core flow |

Milestone exit:

```text
Vercel preview can generate a real plan from live providers.
```

## Milestone 6: Improve Discovery Quality

Goal: improve recommendations after the basic live loop works.

| Feature | Current state | Web app goal | Acceptance criteria |
|---|---|---|---|
| City/tourism feeds | Pending | Add high-signal local calendars | Local free/community events improve candidate pool |
| Parks/recreation data | Pending | Add family-friendly public activities | Outdoor and low-cost results improve |
| Eventbrite/Meetup alternatives | Pending | Add if API access is practical | Community events appear when relevant |
| Yelp or menu enrichment | Pending | Add richer food data if needed | Food recommendations improve beyond Google-only |
| Parking | Pending | Add downtown-event friction signal | Plans can warn about parking cost/friction |
| Crowding/friction score | Pending | Estimate effort level | User sees low-effort vs high-effort tradeoff |

Milestone exit:

```text
Recommendations feel meaningfully better than a plain event search list.
```

## Web App First Backlog

| Rank | Goal | Why first |
|---:|---|---|
| 1 | Configure Google Maps/Places, Google Web Search, Google AI, Ticketmaster, and database | Without these, the app cannot prove real planning |
| 2 | Run successful real-plan E2E | Confirms the core product loop works |
| 3 | Polish result state with real data | The product lives or dies on the recommendation screen |
| 4 | Add routes/map/travel time | Logistics are central to “where should we go?” |
| 5 | Verify share and feedback happy paths | Needed for retention and learning |
| 6 | Deploy Vercel preview with env vars | Makes the product testable outside local machine |
| 7 | Add auth and saved profiles | Useful after the recommendation loop is proven |
| 8 | Add more data providers | Improves quality after the core loop is stable |
| 9 | Add native mobile/desktop shells | Reuse web-proven core after product fit is clearer |

## Definition of Web MVP Complete

The web MVP is complete when all of the following are true:

1. User can enter a family outing request from `/`.
2. App fetches real places/events from configured providers.
3. App returns one best plan and at least one backup for a normal metro-area query.
4. Plan includes cost, travel time, timeline, food if requested, actions, and reasons.
5. Weather and provider caveats are visible.
6. Share link works for a generated plan.
7. Feedback works for a generated plan and persists.
8. Vercel preview/prod has required environment variables.
9. Build, lint, typecheck, and browser E2E pass.
10. No mock events or fake places are used.

## Explicitly Not First

These should not block the web MVP:

| Not first | Reason |
|---|---|
| iOS app | Build after web loop is proven |
| Android app | Build after web loop is proven |
| Desktop app | Build after web loop is proven |
| Group planning | Needs basic single-family planning first |
| Deals/coupons | Useful later, not needed to prove core decision loop |
| Full admin console | Provider health is enough for first build |
