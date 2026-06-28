# Where2Go Implementation Notes

## Current Repo Shape

The first implementation is a Turborepo-style pnpm workspace:

| Path | Purpose |
|---|---|
| `apps/web` | Next.js App Router web app for Vercel |
| `packages/schemas` | Shared Zod schemas and TypeScript API contracts |
| `packages/core` | Deterministic scoring, itinerary building, cost/travel checks |
| `packages/providers` | Real provider adapters for Google Maps/Places, Google Web Search, Google AI/Gemini, Ticketmaster, Open-Meteo, Ollama, OpenRouter, and OpenAI |

## Run Commands

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm build
pnpm --dir apps/web exec next dev --hostname 127.0.0.1 --port 3000
```

Local URL:

```text
http://127.0.0.1:3000
```

## No Mock Data Policy

The app does not fabricate events or places.
If no real activity providers are configured, `POST /api/plans/generate` returns `NO_CANDIDATES` with provider status details.

Open-Meteo is used as a real keyless weather provider so weather can be verified locally.

## Production Credential Gates

| Capability | Required environment variables |
|---|---|
| Google Maps/Places, ratings, hours, map links | `GOOGLE_MAPS_API_KEY` |
| Google web search discovery | `GOOGLE_SEARCH_API_KEY`, `GOOGLE_SEARCH_ENGINE_ID` |
| Google AI / Gemini explanations and parsing | `GOOGLE_AI_API_KEY`, `GOOGLE_AI_MODEL` |
| Ticketed events | `TICKETMASTER_API_KEY` |
| Local or remote Ollama explanations | `OLLAMA_BASE_URL`, `OLLAMA_MODEL` |
| OpenRouter explanations/parsing | `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, optional `OPENROUTER_SITE_URL` |
| OpenAI explanations/parsing | `OPENAI_API_KEY`, `OPENAI_MODEL` |
| Persistent plans, shares, feedback, profiles | `DATABASE_URL` |

Without `DATABASE_URL`, storage uses an explicit in-memory development store.
That is acceptable for local testing only; Vercel production should use Postgres-compatible storage.

## Implemented Endpoints

| Method | Path |
|---|---|
| `POST` | `/api/plans/generate` |
| `GET` | `/api/plans/{planId}` |
| `POST` | `/api/plans/{planId}/feedback` |
| `POST` | `/api/plans/{planId}/share` |
| `GET` | `/api/share/{shareToken}` |
| `GET` | `/api/profiles/me` |
| `PUT` | `/api/profiles/me` |
| `POST` | `/api/ai/parse-request` |
| `GET` | `/api/provider-health` |

## Verification Completed

The current implementation has passed:

```bash
pnpm typecheck
pnpm lint
pnpm build
```

Browser smoke checks passed on desktop and mobile viewports against the local dev server.
The current local generation path correctly returns `NO_CANDIDATES` because Google Places and Ticketmaster credentials are not configured.
