# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY tsconfig*.json nest-cli.json ./
COPY apps ./apps
COPY libs ./libs

RUN npm run build:bayanihub-admin-service

FROM node:22-alpine AS runner

ENV NODE_ENV=production
ENV BAYANIHUB_ADMIN_PORT=3004

WORKDIR /app

COPY package*.json ./
RUN apk upgrade --no-cache zlib \
  && npm ci --omit=dev --ignore-scripts \
  && rm package-lock.json \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nestjs

COPY --chown=nestjs:nodejs --from=builder /app/dist ./dist

USER nestjs

EXPOSE 3004

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD node -e "require('net').createConnection(${BAYANIHUB_ADMIN_PORT:-3004}, '127.0.0.1').on('connect', s => { s.end(); process.exit(0); }).on('error', () => process.exit(1));"

CMD ["node", "dist/apps/bayanihub-admin-service/main"]
