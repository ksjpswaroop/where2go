FROM node:24-bookworm-slim AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY services/safety-api/package.json services/safety-api/
COPY packages/safety-db/package.json packages/safety-db/
COPY packages/safety-api-zod/package.json packages/safety-api-zod/
COPY packages/safety-openai/package.json packages/safety-openai/
COPY packages/safety-core/package.json packages/safety-core/
RUN pnpm install --frozen-lockfile --filter @where2go/safety-api...

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter @where2go/safety-api build

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000
COPY --from=build /app/services/safety-api/dist ./dist
COPY --from=build /app/services/safety-api/package.json ./
EXPOSE 5000
CMD ["node", "--enable-source-maps", "dist/index.mjs"]
