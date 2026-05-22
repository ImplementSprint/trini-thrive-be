FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build:bayanihub-sitemanager-service

FROM node:22-alpine AS runner
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY --from=builder /app/dist ./dist
EXPOSE 3303
CMD ["node", "dist/apps/bayanihub-sitemanager-service/main"]
