# ─── R-AERO Training Academy — single all-in-one image ───────────────────────
# Front-end + back-end + PostgreSQL in one container. Build once, run anywhere:
#   docker build -t r-aero-academy .
#   docker run -p 3000:3000 r-aero-academy
# Set ADMIN_EMAIL and ADMIN_PASSWORD for the first installation.
FROM node:20-bookworm

# Install PostgreSQL server (embedded database) + CA certs.
RUN apt-get update \
    && apt-get install -y --no-install-recommends postgresql postgresql-contrib ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@10.4.1

WORKDIR /app

# Install dependencies first (better layer caching). Full install: the build,
# tsx (versioned migrations and first admin) are needed at container start.
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/
RUN pnpm install --frozen-lockfile

# Copy the rest of the source and build front-end + back-end.
COPY . .
RUN pnpm build

# Runtime configuration. JWT_SECRET is intentionally NOT defaulted here: when unset,
# the entrypoint generates a strong random secret and persists it in the storage volume
# (stable across restarts). Provide your own JWT_SECRET to override.
ENV NODE_ENV=production \
    PORT=3000 \
    VITE_APP_ID=r-aero-training-academy \
    STORAGE_DIR=/app/storage \
    PGDATA=/var/lib/postgresql/data

RUN mkdir -p /app/storage /var/lib/postgresql/data \
    && chown -R postgres:postgres /var/lib/postgresql \
    && chmod +x docker-entrypoint.sh

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=5 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
