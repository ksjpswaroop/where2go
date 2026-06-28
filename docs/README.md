# Where2Go Documentation Index

This folder is the implementation documentation pack for the first Where2Go build.
It turns the product research, feature matrix, and platform decisions into documents
that engineering, product, and design can work from.

## Source Of Truth

| Document | Purpose | Audience |
|---|---|---|
| [Product Design](./01-product-design.md) | Product goals, users, MVP scope, feature phases, core journeys, acceptance criteria | Product, design, engineering |
| [System Architecture](./02-system-architecture.md) | Monorepo structure, deployment model, shared packages, data flow, platform strategy | Engineering |
| [AI Provider Architecture](./03-ai-provider-architecture.md) | Google AI/Gemini-first routing with OpenRouter, OpenAI, and Ollama fallbacks | Engineering, product |
| [API Endpoints](./04-api-endpoints.md) | REST endpoint definitions, request/response contracts, errors, auth, caching | Engineering |
| [High-Fidelity Web Design Spec](./05-web-design-spec.md) | Page-by-page web app layouts, states, responsive behavior, visual system | Design, frontend |
| [Implementation Notes](./06-implementation-notes.md) | Current repo implementation, run commands, provider credentials, deployment gates | Engineering |
| [Local E2E Test Report](./07-local-e2e-test-report.md) | Latest local browser/API test results, missing pieces, active development areas | Engineering, product |
| [Goal-Based Feature Tracker](./08-goal-based-feature-tracker.md) | Verified feature status, API key gates, pending work, and recommended goal order | Product, engineering |
| [Web App First Build Goals](./09-web-app-first-build-goals.md) | Web-only milestone sequence, acceptance criteria, and MVP completion definition | Product, engineering |
| [Milestone 0 Environment Runbook](./10-milestone-0-environment-runbook.md) | Local and Vercel setup steps, verifier commands, and current credential blockers | Engineering |
| [OpenAPI Draft](./api/openapi.yaml) | Machine-readable draft for MVP API surface | Engineering |

## Product Build Decision

Build the web app first:

1. Next.js web app deployed on Vercel.
2. Shared TypeScript packages for recommendation logic, schemas, AI routing, and provider adapters.
3. Responsive web/PWA as the first consumer experience.
4. Expo iOS/Android and Tauri desktop after the core recommendation loop is validated.

## MVP Outcome

The MVP must answer one question well:

> Given our family, budget, time, weather, and drive limit, what should we do today?

The first release should generate:

1. Today's Best Plan.
2. Cheaper Alternative.
3. Rain / Low-Effort Backup.
4. Timeline.
5. Cost breakdown.
6. Food nearby.
7. Directions and booking handoffs.
8. Why-this-plan explanation.
9. Share link.
10. Feedback capture.

## Phase Boundaries

| Phase | Scope |
|---|---|
| Phase 1: MVP | Plan request, family profile, constraints, place/event discovery, scoring, itinerary, food, cost, explanation, actions, sharing, feedback |
| Phase 2: V1 | City/parks signals, crowd/friction estimate, weekend optimizer, parking check, confidence score, calendar save, favorites/avoid list, leave-now alerts |
| Phase 3: V2 | Plan change alerts, group planning, deals and coupons |
