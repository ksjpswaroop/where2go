# Where2Go Local E2E Test Report

Test date: June 27, 2026

Local app:

```text
http://127.0.0.1:3000
```

Artifacts:

| Artifact | Path |
|---|---|
| Final JSON results | `/Users/swaroop/Documents/where2go/outputs/local-e2e-20260627/e2e-results-final.json` |
| Desktop screenshot | `/Users/swaroop/Documents/where2go/outputs/local-e2e-20260627/desktop-plan-error-state.png` |
| Mobile screenshot | `/Users/swaroop/Documents/where2go/outputs/local-e2e-20260627/mobile-plan-error-state.png` |

## Summary

All final local E2E checks passed.

The app is working as an honest real-data shell: it loads locally, validates inputs, calls real server routes, calls real Open-Meteo weather, and returns an explicit `NO_CANDIDATES` response because event/place provider credentials are not configured.

## Tests Run

| Area | Result | Notes |
|---|---|---|
| `GET /api/provider-health` | Pass | Reports configured/missing providers correctly |
| Profile read | Pass | Returns current profile |
| Profile save/read | Pass | Persists in current local runtime memory store |
| Plan generation | Pass | Returns `NO_CANDIDATES` without real activity providers |
| AI parse route | Pass | Reports AI provider status |
| Missing plan fetch | Pass | Returns `PLAN_NOT_FOUND` |
| Missing share fetch | Pass | Returns `SHARE_NOT_FOUND` |
| Missing-plan feedback | Pass | Now returns `PLAN_NOT_FOUND` |
| Desktop browser flow | Pass | Form enables after location, generation shows provider-gated error state |
| Mobile browser flow | Pass | Same flow works on 390px mobile viewport |

## Fixed During Testing

The feedback endpoint accepted feedback for nonexistent plan IDs.
It now checks that the plan exists before storing feedback and returns:

```json
{
  "error": {
    "code": "PLAN_NOT_FOUND",
    "message": "Plan was not found."
  }
}
```

## Missing Before Real Production Use

| Missing item | Impact |
|---|---|
| `GOOGLE_MAPS_API_KEY` | No real Google Places, ratings, hours, map links, restaurant discovery, or place candidates |
| `GOOGLE_SEARCH_API_KEY` and `GOOGLE_SEARCH_ENGINE_ID` | No Google web-discovered local activity pages |
| `GOOGLE_AI_API_KEY` and `GOOGLE_AI_MODEL` | Google AI/Gemini parsing and plan explanation are unavailable |
| `TICKETMASTER_API_KEY` | No ticketed concerts, sports, theater, comedy, or family event candidates |
| `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` | OpenRouter fallback is unavailable |
| `OPENAI_API_KEY` and `OPENAI_MODEL` | OpenAI fallback is unavailable |
| Ollama model `llama3.1` | Ollama endpoint is reachable, but the configured model is not installed locally |
| `DATABASE_URL` | Plans, shares, feedback, and profiles are only in local memory |
| Auth | `/api/profiles/me` currently uses an anonymous local profile |
| Vercel environment setup | Production/preview deployments still need environment variables configured |
| Real successful plan result test | Blocked until Google Places or Ticketmaster credentials produce live candidates |
| Share and feedback happy-path E2E | Blocked until a real generated plan exists |

## Being Developed

| Area | Current state |
|---|---|
| Web app | Implemented locally as a Next.js App Router app in `apps/web` |
| Shared API contracts | Implemented in `packages/schemas` |
| Deterministic recommendation engine | Implemented in `packages/core` |
| Real provider adapters | Implemented for Google Maps/Places, Google Web Search, Google AI/Gemini, Ticketmaster, Open-Meteo, Ollama, OpenRouter, OpenAI |
| MVP UI | Implemented for request, constraints, provider health, generation state, result shell, error state |
| Persistence | Implemented with Postgres when `DATABASE_URL` exists, memory otherwise |
| Native apps | Not started; should reuse shared schemas/core once web loop is validated |

## Recommended Next Development Order

1. Configure Google Maps/Places, Google Web Search, Google AI, and Ticketmaster locally and on Vercel.
2. Install or change the Ollama model, or configure OpenRouter/OpenAI as AI fallbacks.
3. Add Postgres storage and auth before private saved plans.
4. Run a successful real-candidate E2E test covering plan result, share, and feedback.
5. Add Google Routes travel-time checks and richer restaurant selection.
6. Add Expo mobile and desktop shells only after the web recommendation loop works with real data.
