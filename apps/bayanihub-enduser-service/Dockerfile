# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json .npmrc ./
RUN --mount=type=secret,id=GITHUB_TOKEN \
    GITHUB_TOKEN="$(cat /run/secrets/GITHUB_TOKEN)" npm ci --ignore-scripts

COPY tsconfig*.json nest-cli.json ./
COPY apps ./apps
COPY libs ./libs

RUN npm run build:bayanihub-enduser-service

FROM node:22-alpine AS runner

ENV NODE_ENV=production
ENV BAYANIHUB_ENDUSER_PORT=3001

WORKDIR /app
COPY package*.json .npmrc ./
RUN --mount=type=secret,id=GITHUB_TOKEN \
    GITHUB_TOKEN="$(cat /run/secrets/GITHUB_TOKEN)" \
    npm ci --omit=dev --ignore-scripts \
  && rm -f .npmrc package-lock.json
COPY --from=builder /app/dist ./dist
EXPOSE 3302
CMD ["node", "dist/apps/bayanihub-enduser-service/main"]
