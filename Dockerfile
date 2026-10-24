# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:24-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000 DATABASE_PATH=/data/bill-hub.sqlite
RUN mkdir -p /data /app/.next/cache && chown -R node:node /data /app
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
COPY --chown=node:node db/sqlite.mjs ./db/sqlite.mjs
COPY --chown=node:node lib/config.mjs ./lib/config.mjs
COPY --chown=node:node scripts/preflight.mjs scripts/migrate.mjs scripts/backup.mjs scripts/healthcheck.mjs scripts/docker-entrypoint.sh ./scripts/
COPY --chown=node:node drizzle ./drizzle
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD ["node", "scripts/healthcheck.mjs"]
ENTRYPOINT ["sh", "scripts/docker-entrypoint.sh"]
