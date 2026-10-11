# Logbook: one image, API + web. SQLite lives on a volume at /data.
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=1
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate

# ---------- build ----------
FROM base AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile
COPY packages ./packages
COPY apps ./apps
RUN pnpm --filter @logbook/web build && pnpm --filter @logbook/api build
# production node_modules for the api only (better-sqlite3 stays external)
RUN pnpm --filter @logbook/api deploy --prod --legacy /out && cp -r apps/api/dist /out/dist && cp -r apps/web/dist /out/dist/public

# ---------- run ----------
FROM base AS run
WORKDIR /app
ENV NODE_ENV=production PORT=8787 DATABASE_PATH=/data/logbook.db
COPY --from=build /out /app
RUN mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME ["/data"]
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD node -e "fetch('http://localhost:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
