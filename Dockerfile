# ── Base ──────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS base
RUN apt-get update \
	&& apt-get install -y --no-install-recommends openssl ca-certificates \
	&& rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ── Dependencies ──────────────────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci
RUN npx prisma generate

# ── Build ─────────────────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public
ENV NEXT_TELEMETRY_DISABLED=1
ENV RESEND_API_KEY=local-resend-api-key
ENV NEXT_PUBLIC_APP_URL=http://localhost:3000
ENV GOOGLE_CLIENT_ID=local-google-client-id
ENV GOOGLE_CLIENT_SECRET=local-google-client-secret
ENV AUTH_SECRET=local-dev-auth-secret-change-me
RUN npm run build

# ── Production ────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
