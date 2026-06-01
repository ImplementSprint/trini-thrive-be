# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json .npmrc ./
ARG GITHUB_TOKEN
RUN npm ci --ignore-scripts

COPY tsconfig*.json nest-cli.json ./
COPY apps ./apps
COPY libs ./libs

RUN npm run build:bayanihub-sitemanager-service

FROM node:22-alpine AS runner

ENV NODE_ENV=production
ENV BAYANIHUB_SITEMANAGER_PORT=3003

WORKDIR /app
COPY package*.json .npmrc ./
ARG GITHUB_TOKEN
RUN npm ci --omit=dev --ignore-scripts \
  && rm -f .npmrc package-lock.json
COPY --from=builder /app/dist ./dist
EXPOSE 3303
CMD ["node", "dist/apps/bayanihub-sitemanager-service/main"]
