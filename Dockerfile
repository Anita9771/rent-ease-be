FROM node:20-alpine AS base
RUN corepack enable pnpm
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --filter api...

FROM deps AS builder
COPY apps/api ./apps/api
WORKDIR /app/apps/api
RUN pnpm build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable pnpm
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=deps /app/apps/api/package.json ./package.json
COPY --from=deps /app/apps/api/node_modules ./node_modules
EXPOSE 4000
CMD ["node", "dist/main.js"]

