FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY server ./server
COPY src ./src
COPY scripts/build-server.mjs ./scripts/build-server.mjs
RUN npm run build:server

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends blender ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/dist-server ./dist-server
COPY scripts/blender/build_venue.py scripts/blender/build_job.py ./scripts/blender/
ENV NODE_ENV=production HOME=/tmp PORT=3001 BLENDER_PATH=/usr/bin/blender
COPY scripts/smoke-blender.mjs ./scripts/smoke-blender.mjs
USER node
RUN node scripts/smoke-blender.mjs
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:3001/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist-server/main.mjs"]
