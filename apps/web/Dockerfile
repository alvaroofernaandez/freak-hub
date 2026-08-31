# syntax=docker/dockerfile:1

# --- Base -------------------------------------------------------------------
FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /app

# --- Dependencies -----------------------------------------------------------
FROM base AS deps

# Only the manifests, so the install layer is cached until a dependency changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,target=/pnpm-store \
    pnpm config set store-dir /pnpm-store && \
    pnpm install --frozen-lockfile --filter @freak-hub/web...

# --- Build ------------------------------------------------------------------
FROM base AS build

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY . .

# Clerk's publishable key is inlined into the client bundle at build time.
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY \
    NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_TELEMETRY_DISABLED=1

RUN pnpm --filter @freak-hub/web build

# --- Runtime ----------------------------------------------------------------
FROM node:24-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000

RUN addgroup -g 10001 nextjs && adduser -D -u 10001 -G nextjs nextjs

# `output: "standalone"` ships only the files the server actually needs.
COPY --from=build --chown=nextjs:nextjs /app/apps/web/.next/standalone ./
COPY --from=build --chown=nextjs:nextjs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=nextjs:nextjs /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000

CMD ["node", "apps/web/server.js"]
