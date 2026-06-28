# Milestone 0 Environment Runbook

Last checked: June 27, 2026

Milestone 0 objective:

```text
Make Local and Vercel Environments Real
```

This milestone is complete only when local and Vercel provider health both show real configured providers for Google Maps/Places, Google Web Search, Google AI, Ticketmaster, and durable database storage.

## Current Evidence

| Check | Current result |
|---|---|
| Local `.env.local` | Present, copied from `.env.example` with non-secret defaults and blank secret values |
| Shell provider secrets | Missing except non-secret Ollama tuning vars |
| Local provider health | App runs, but P0 providers are `not_configured` |
| Vercel project link | Missing `.vercel/project.json` |
| Vercel connected team | `ScholarIT` found |
| Existing Vercel project named Where2Go | Not found in listed projects |
| Vercel auth | `pnpm vercel:whoami` is non-interactive and reports missing `VERCEL_TOKEN` or CLI auth |
| Vercel project bootstrap | Added as `pnpm vercel:bootstrap`; currently blocked by missing `VERCEL_TOKEN` |
| Milestone verifier | Added as `pnpm milestone0:check` |
| Provider smoke verifier | Added as `pnpm milestone0:smoke`; currently blocked by missing P0 keys |
| Vercel env sync | Added as `pnpm vercel:env:sync`; currently blocked by missing `.vercel/project.json` |

## Required Local Secrets

Create `.env.local` from `.env.example` and fill these P0 values:

```env
GOOGLE_MAPS_API_KEY=
GOOGLE_SEARCH_API_KEY=
GOOGLE_SEARCH_ENGINE_ID=
GOOGLE_AI_API_KEY=
GOOGLE_AI_MODEL=gemini-2.5-flash
TICKETMASTER_API_KEY=
DATABASE_URL=
```

P1 fallback AI values:

```env
OPENROUTER_API_KEY=
OPENROUTER_MODEL=
OPENAI_API_KEY=
OPENAI_MODEL=
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1
```

Do not commit `.env.local`.

## Local Setup Flow

1. Create a local secret file:

```bash
cp .env.example .env.local
```

2. Fill the P0 values in `.env.local`.

3. Start the web app:

```bash
pnpm --dir apps/web exec next dev --hostname 127.0.0.1 --port 3000
```

4. Verify Milestone 0 locally:

```bash
pnpm milestone0:check
```

5. Verify that provider keys work against upstream APIs:

```bash
pnpm milestone0:smoke
```

Expected local exit condition:

```text
P0 Google Maps/Places: OK
P0 Google Web Search: OK
P0 Google AI / Gemini: OK
P0 Ticketmaster: OK
P0 Durable database: OK
Runtime provider health: configured for each P0 provider
Provider smoke verification: ok for Google Places, Google Web Search, Google AI, Ticketmaster, and Postgres
```

## Vercel Setup Flow

The repo is not currently linked to a Vercel project.

1. Link or create the Vercel project:

```bash
pnpm vercel:login
pnpm vercel:whoami
pnpm vercel:link
```

Use the `ScholarIT` team when prompted.

If a valid `VERCEL_TOKEN` is available, the repo can dry-run the Vercel project bootstrap, then create or reuse the `where2go` project, configure it for `apps/web`, and write `.vercel/project.json`:

```bash
pnpm vercel:bootstrap
pnpm vercel:bootstrap:apply
```

For a monorepo link from the repository root, use:

```bash
pnpm vercel:link:repo
```

Expected Vercel project settings:

| Setting | Value |
|---|---|
| Project name | `where2go` |
| Framework Preset | `Next.js` |
| Root Directory | `apps/web` |
| Install Command | Vercel default for `pnpm` |
| Build Command | Vercel default or `turbo build` for the selected root |
| Output Directory | Vercel default for Next.js |

After linking and setting `VERCEL_TOKEN`, check or repair those settings:

```bash
pnpm vercel:settings:check
pnpm vercel:settings:apply
```

2. Add the same P0 variables in Vercel Dashboard or CLI.

CLI pattern:

```bash
echo "secret-value" | pnpm dlx vercel@latest env add GOOGLE_MAPS_API_KEY production preview development
```

Repeat for:

```text
GOOGLE_MAPS_API_KEY
GOOGLE_SEARCH_API_KEY
GOOGLE_SEARCH_ENGINE_ID
GOOGLE_AI_API_KEY
GOOGLE_AI_MODEL
TICKETMASTER_API_KEY
DATABASE_URL
```

If `.env.local` contains the real P0 values and `VERCEL_TOKEN` is available, the repo can sync them through the Vercel REST API:

```bash
pnpm vercel:env:sync
pnpm vercel:env:sync:apply
```

The sync applies each P0 key to production, preview, and development.

3. Pull Vercel envs into local `.env.local`:

```bash
pnpm vercel:env:pull
```

4. If `VERCEL_TOKEN` is available, verify Vercel env names through the REST API:

```bash
pnpm milestone0:check:vercel
```

Without `VERCEL_TOKEN`, the script can verify local runtime health and Vercel link state, but cannot list Vercel environment variables through the REST API.

## Verifier Commands

| Command | Purpose |
|---|---|
| `pnpm milestone0:check:local` | Check local files/process env only |
| `pnpm milestone0:check` | Check local env plus live `/api/provider-health` |
| `pnpm milestone0:check:vercel` | Check local env, runtime provider health, Vercel link, and Vercel env names when `VERCEL_TOKEN` exists |
| `pnpm milestone0:smoke` | Call Google Places, Google Web Search, Google AI, Ticketmaster, and Postgres once to prove keys work |
| `pnpm vercel:whoami` | Verify Vercel auth without starting device login |
| `pnpm vercel:whoami:cli` | Run the interactive Vercel CLI whoami command |
| `pnpm vercel:login` | Refresh local Vercel CLI auth through device login |
| `pnpm vercel:bootstrap` | Dry-run the Vercel project bootstrap using `VERCEL_TOKEN`; does not mutate Vercel or local files |
| `pnpm vercel:bootstrap:apply` | Create/reuse/configure the Vercel project and write `.vercel/project.json` |
| `pnpm vercel:link` | Link this repo to a Vercel project using `pnpm dlx vercel@latest` |
| `pnpm vercel:link:repo` | Link a monorepo project from the repository root |
| `pnpm vercel:settings:check` | Check linked Vercel project settings through `VERCEL_TOKEN` |
| `pnpm vercel:settings:apply` | Patch linked Vercel project to `rootDirectory=apps/web` and `framework=nextjs` |
| `pnpm vercel:env:ls` | List Vercel env vars through the Vercel CLI |
| `pnpm vercel:env:pull` | Pull Vercel env vars into `.env.local` |
| `pnpm vercel:env:sync` | Dry-run P0 env sync from `.env.local` to Vercel |
| `pnpm vercel:env:sync:apply` | Upsert P0 env vars to Vercel production, preview, and development through `VERCEL_TOKEN` |
| `pnpm vercel:deploy` | Deploy with Vercel CLI |

## Completion Criteria

Milestone 0 can be marked complete only when all of these are true:

1. `.env.local` or process environment contains every P0 key.
2. Local `/api/provider-health` reports:
   - `google-maps-platform: configured`
   - `google-places: configured`
   - `google-web-search: configured`
   - `google-ai: configured`
   - `ticketmaster: configured`
   - `postgres-storage: configured`
3. `.vercel/project.json` exists and points to the intended Vercel project.
4. Vercel project settings use `rootDirectory=apps/web` and `framework=nextjs`.
5. Vercel production, preview, and development environments contain the same P0 keys.
6. A Vercel preview deployment reports the same P0 provider health.
7. `pnpm milestone0:smoke` passes locally with real upstream calls.
8. `pnpm typecheck`, `pnpm lint`, and `pnpm build` pass.

## Upstream Setup References

| Provider | Official setup/reference |
|---|---|
| Google AI / Gemini | [Gemini API key](https://ai.google.dev/gemini-api/docs/api-key), [generateContent API](https://ai.google.dev/api/generate-content) |
| Google Places | [Places Text Search](https://developers.google.com/maps/documentation/places/web-service/text-search) |
| Google Web Search | [Programmable Search JSON API](https://developers.google.com/custom-search/v1/introduction), [cse.list reference](https://developers.google.com/custom-search/v1/reference/rest/v1/cse/list) |
| Ticketmaster | [Discovery API v2](https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/) |
| Vercel env vars | [Environment Variables](https://vercel.com/docs/environment-variables) |

## Current Blockers

| Blocker | Owner action |
|---|---|
| Google Maps API key is not available in this workspace | Provide or create `GOOGLE_MAPS_API_KEY` |
| Google Programmable Search API key and search engine ID are not available | Provide or create `GOOGLE_SEARCH_API_KEY` and `GOOGLE_SEARCH_ENGINE_ID` |
| Google AI API key is not available | Provide or create `GOOGLE_AI_API_KEY` |
| Ticketmaster API key is not available | Provide or create `TICKETMASTER_API_KEY` |
| Durable Postgres database URL is not available | Provision database and provide `DATABASE_URL` |
| Vercel CLI auth is not complete | Run `pnpm vercel:login` or provide a valid `VERCEL_TOKEN` |
| Vercel project is not linked | After auth is fixed, run `pnpm vercel:link` or `pnpm vercel:link:repo` and select/create the Where2Go project |
