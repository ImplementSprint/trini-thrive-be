FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json .npmrc ./
ARG GITHUB_TOKEN
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build:bayanihub-enduser-service

FROM node:22-alpine AS runner
WORKDIR /app
COPY package*.json .npmrc ./
ARG GITHUB_TOKEN
RUN npm ci --omit=dev --ignore-scripts \
  && rm -f .npmrc package-lock.json
COPY --from=builder /app/dist ./dist
EXPOSE 3302
CMD ["node", "dist/apps/bayanihub-enduser-service/main"]
