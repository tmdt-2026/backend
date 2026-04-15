# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=22-alpine

FROM node:${NODE_VERSION} AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

# ─── DEPS ────────────────────────────────────────────────────────────────────
FROM base AS deps
COPY package*.json ./
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm ci --omit=dev --ignore-scripts && \
    npm cache clean --force

# ─── BUILD ───────────────────────────────────────────────────────────────────
FROM base AS build
ARG APP_NAME
ARG HAS_PRISMA=false
ENV APP_NAME=${APP_NAME}
ENV HAS_PRISMA=${HAS_PRISMA}

COPY package*.json ./
COPY nest-cli.json tsconfig*.json ./
COPY apps ./apps

RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm ci

# ✅ Generate Prisma clients FIRST (before build)
RUN if [ "${HAS_PRISMA}" = "true" ]; then \
      echo "🔄 Pre-generating Prisma clients..."; \
      find /app/apps -type d -name "prisma" | while read prisma_dir; do \
        schema="$prisma_dir/schema.prisma"; \
        if [ -f "$schema" ]; then \
          echo "  → Generating: $schema"; \
          DATABASE_URL="mysql://root:root@localhost:3306/db" \
          ./node_modules/.bin/prisma generate --schema="$schema"; \
        fi; \
      done; \
      echo "✅ Prisma clients pre-generated"; \
    fi

RUN echo "🔨 Building ${APP_NAME}..." && \
    npm run build ${APP_NAME} && \
    echo "✅ Build done"

# ─── RUNTIME ─────────────────────────────────────────────────────────────────
FROM base AS runtime
ARG APP_NAME
ARG HAS_PRISMA=false
ENV NODE_ENV=production
ENV APP_NAME=${APP_NAME}
ENV HAS_PRISMA=${HAS_PRISMA}

COPY package*.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist/apps/${APP_NAME} ./dist

# ✅ Copy apps folder with prisma schemas and migrations
COPY --from=build /app/apps ./apps

# ✅ Copy entire node_modules/@prisma folder (includes all custom clients)
RUN --mount=type=bind,from=build,source=/app/node_modules/@prisma,target=/build/@prisma \
    if [ "${HAS_PRISMA}" = "true" ] && [ -d "/build/@prisma" ]; then \
      rm -rf ./node_modules/@prisma; \
      cp -r /build/@prisma ./node_modules/@prisma; \
      echo "✅ Copied @prisma with all clients"; \
    fi

# ✅ Copy .prisma folder (generated types)
RUN --mount=type=bind,from=build,source=/app/node_modules/.prisma,target=/build/.prisma \
    if [ "${HAS_PRISMA}" = "true" ] && [ -d "/build/.prisma" ]; then \
      rm -rf ./node_modules/.prisma; \
      cp -r /build/.prisma ./node_modules/.prisma; \
      echo "✅ Copied .prisma types"; \
    fi

# ✅ Setup prisma folder for migrations
RUN if [ "${HAS_PRISMA}" = "true" ]; then \
      mkdir -p ./prisma; \
      if [ -d "./apps/${APP_NAME}/prisma" ]; then \
        cp -r ./apps/${APP_NAME}/prisma/* ./prisma/; \
        echo "✅ Copied prisma schema & migrations"; \
      fi; \
    fi

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["sh", "-c", "\
  if [ \"$HAS_PRISMA\" = \"true\" ] && [ -f \"./prisma/schema.prisma\" ]; then \
    echo '🔄 Running Prisma migrations...'; \
    ./node_modules/.bin/prisma migrate deploy --schema ./prisma/schema.prisma; \
    echo '✅ Migrations completed'; \
  fi && \
  echo \"🚀 Starting $APP_NAME...\" && \
  node dist/main.js \
"]