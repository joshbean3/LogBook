# Logbook: one image, API + web (+ the optional worker entry). SQLite lives on a volume at /data; Litestream streams
# it to S3-compatible storage when LITESTREAM_REPLICA_URL is set (README: Backups).
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=1
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate

# ---------- build ----------
FROM base AS build
WORKDIR /app
ARG LITESTREAM_VERSION=0.3.13
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ ca-certificates curl && rm -rf /var/lib/apt/lists/*
# the litestream binary for this image's architecture (amd64 or arm64), from its pinned release
RUN ARCH="$(dpkg --print-architecture)" \
  && curl -fsSL "https://github.com/benbjohnson/litestream/releases/download/v${LITESTREAM_VERSION}/litestream-v${LITESTREAM_VERSION}-linux-${ARCH}.deb" -o /tmp/litestream.deb \
  && dpkg -i /tmp/litestream.deb && rm /tmp/litestream.deb && litestream version
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
COPY --from=build /usr/bin/litestream /usr/bin/litestream
COPY --from=build /out /app
COPY apps/api/bin/start.sh /app/bin/start.sh
COPY apps/api/litestream.yml /app/litestream.yml
COPY scripts /app/scripts
RUN mkdir -p /data && chmod +x /app/bin/start.sh /app/scripts/*.sh && chown -R node:node /data /app
USER node
VOLUME ["/data"]
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD node -e "fetch('http://localhost:'+process.env.PORT+'/api/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# start.sh: restore from the replica when the file is missing, then node under `litestream replicate -exec`;
# without LITESTREAM_REPLICA_URL it is plain `node dist/index.js`. The worker image is the same: CMD ["node", "dist/worker.js"].
CMD ["/app/bin/start.sh"]
