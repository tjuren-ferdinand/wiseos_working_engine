# WiseOS Web — Next.js frontend
# Build context: apps/web/ (set as service root in Railway)
# The web app has no internal workspace deps, so it builds standalone.
FROM node:20-slim AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

WORKDIR /app

# --- deps ---
FROM base AS deps
COPY package.json ./
# No lockfile in apps/web (lockfile is at monorepo root) — install fresh.
RUN pnpm install --no-frozen-lockfile

# --- build ---
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* vars are inlined at build time — must be build args.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

RUN pnpm build

# --- runtime ---
FROM base AS runner
ENV NODE_ENV=production

COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.mjs ./next.config.mjs
COPY --from=deps /app/node_modules ./node_modules

EXPOSE 3000

# Run Next directly via node — no pnpm needed at runtime.
CMD ["sh", "-c", "node node_modules/next/dist/bin/next start -p ${PORT:-3000}"]
