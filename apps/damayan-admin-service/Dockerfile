# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json .npmrc ./
ARG GITHUB_TOKEN
RUN npm ci

COPY tsconfig*.json nest-cli.json ./
COPY apps ./apps
COPY libs ./libs

RUN npm run build:damayan-admin-service

FROM node:22-alpine AS runner

ENV NODE_ENV=production
WORKDIR /app

COPY package*.json .npmrc ./
ARG GITHUB_TOKEN
RUN apk upgrade --no-cache zlib \
  && npm ci --omit=dev \
  && rm -f .npmrc package-lock.json \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nestjs

COPY --chown=nestjs:nodejs --from=builder /app/dist ./dist

USER nestjs

EXPOSE 3201

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3201/api/v1/health', (res) => { if (res.statusCode !== 200) process.exit(1); }).on('error', () => process.exit(1));"

CMD ["node", "dist/apps/damayan-admin-service/main"]
