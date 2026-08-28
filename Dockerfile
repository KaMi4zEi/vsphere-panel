# Dockerfile

# ---- Stage 1: Build ----
FROM node:22.23.2-alpine3.24 AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci --include=dev --legacy-peer-deps
COPY . .

RUN npx prisma generate
RUN npm run build

# ---- Stage 2: Initialisation du schéma ----
FROM node:22.23.2-alpine3.24 AS db-init
WORKDIR /app
COPY package*.json ./
RUN npm ci --include=dev --legacy-peer-deps
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts
CMD ["npx", "prisma", "db", "push"]

# ---- Stage 3: Runner ----
FROM node:22.23.2-alpine3.24 AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# App Next.js
RUN mkdir -p ./public
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static


# Prisma client généré (pour l'app Next.js)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["./docker-entrypoint.sh"]
