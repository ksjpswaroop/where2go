# Where2Go + SafeTrip Merge Architecture

Canonical monorepo: `/Users/swaroop/Documents/where2go`

## Topology

| Path | Role |
|------|------|
| `apps/web` | Next.js — Family Day (MapChat) + Solo Travel web shell |
| `apps/mobile` | Expo — dual-mode mobile (SafeTrip safety + Explore planning) |
| `services/safety-api` | Always-on Express API — timers, escalation, hotel scanner |
| `packages/core` | Deterministic outing planner |
| `packages/safety-core` | Itinerary timers, venue safety, risk scoring |
| `packages/api-client` | Typed planning + safety clients |

## Deployment

- **Planning API:** Vercel (`apps/web`)
- **Safety API:** Fly.io / Railway single instance (`services/safety-api/fly.toml`)
- **Never** run escalation scheduler on Vercel serverless

## Commands

```bash
pnpm dev:web
pnpm dev:mobile
pnpm dev:safety-api
pnpm safety:codegen
pnpm safety:db:push
```
