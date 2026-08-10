# Stage 1: Install dependencies (needs TipTap Pro token for payload-richtext-tiptap)
FROM oven/bun:1-slim AS deps
WORKDIR /app

COPY package.json bun.lock .npmrc ./
ARG TIPTAP_AUTH_TOKEN
ENV TIPTAP_AUTH_TOKEN=$TIPTAP_AUTH_TOKEN

RUN bun install --frozen-lockfile

# Stage 2: Build
FROM oven/bun:1-slim AS builder
WORKDIR /app

COPY --from=deps /app/node_modules node_modules
COPY . .

# Next standalone expects a public dir even if empty.
RUN mkdir -p public

# Payload/Next read these at build time; runtime values come from compose/.env.
ENV PAYLOAD_SECRET=build-time-only
ENV DATABASE_URI=mongodb://127.0.0.1/build-placeholder
ENV NEXT_TELEMETRY_DISABLED=1

RUN bun run build \
  && rm -rf node_modules \
  && rm -rf /root/.bun/install/cache

# Stage 3: Production runtime — slim base + Next standalone only (no full node_modules)
FROM oven/bun:1-slim AS runner
WORKDIR /app

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/okf-ruleset ./okf-ruleset

USER nextjs
EXPOSE 3000

ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

CMD ["bun", "run", "server.js"]
