# ── Build Stage ─────────────────────────────────────────────
# ARG CACHE_BUSTER forces Railway to rebuild from scratch, ignoring cached layers.
ARG CACHE_BUSTER=force-rebuild-v3
FROM node:22-slim AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies (including playwright for CDP client)
RUN npm ci || npm install

# Copy source
COPY tsconfig.json ./
COPY src ./src

# Compile TypeScript to dist/
RUN npm run build

# ── Runtime Stage ──────────────────────────────────────────
FROM node:22-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV WORKER_PORT=3100

# No browser binaries or display server needed — Browserbase is the browser provider.
# Playwright is used only as a CDP client (chromium.connectOverCDP), not for local launches.

# Copy node_modules (includes playwright package for CDP client)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Copy compiled output
COPY --from=builder /app/dist ./dist

EXPOSE 3100

# Health check — uses the /health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3100/health').then(r=>process.exit(r.status===200?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
