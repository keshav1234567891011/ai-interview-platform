# Build from repository root. BACKEND_API_URL is non-secret, server-only, and baked into rewrites.
FROM node:24-bookworm-slim AS dependencies
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

FROM node:24-bookworm-slim AS builder
ARG BACKEND_API_URL=http://backend:8000
ENV BACKEND_API_URL=$BACKEND_API_URL NEXT_TELEMETRY_DISABLED=1
WORKDIR /app/frontend
COPY --from=dependencies /app/frontend/node_modules ./node_modules
COPY frontend/ ./
COPY config/development.json /app/config/development.json
RUN npm run build

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=builder --chown=node:node /app/frontend/.next/standalone ./
COPY --from=builder --chown=node:node /app/frontend/.next/static ./frontend/.next/static
COPY --from=builder --chown=node:node /app/frontend/public ./frontend/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3000').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "frontend/server.js"]
