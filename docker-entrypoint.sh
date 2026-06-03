#!/usr/bin/env bash
# ─── R-AERO Training Academy — all-in-one container entrypoint ────────────────
# Starts an embedded PostgreSQL, applies the schema, seeds demo data, then
# launches the Node application. Everything runs inside this single container.
set -euo pipefail

PGDATA="${PGDATA:-/var/lib/postgresql/data}"
PGBIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)"
DB_NAME="raero"
DB_USER="raero"
DB_PASS="raero"

export DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}"

mkdir -p "$PGDATA"
chown -R postgres:postgres "$PGDATA"
chmod 700 "$PGDATA"

if [ ! -s "$PGDATA/PG_VERSION" ]; then
  echo "[entrypoint] Initialisation de PostgreSQL…"
  su postgres -c "$PGBIN/initdb -D '$PGDATA' --auth-local=trust --auth-host=md5 --encoding=UTF8" >/dev/null
fi

echo "[entrypoint] Démarrage de PostgreSQL…"
su postgres -c "$PGBIN/pg_ctl -D '$PGDATA' -o '-c listen_addresses=127.0.0.1 -p 5432' -w -t 60 start"

# Create role and database if they do not exist yet.
su postgres -c "psql -tAc \"SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'\"" | grep -q 1 \
  || su postgres -c "psql -c \"CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}' SUPERUSER;\""
su postgres -c "psql -tAc \"SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'\"" | grep -q 1 \
  || su postgres -c "psql -c \"CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};\""

# Persist a stable session secret across restarts when JWT_SECRET isn't provided,
# so existing logins survive container restarts. A user-supplied JWT_SECRET wins.
if [ -z "${JWT_SECRET:-}" ]; then
  SECRET_DIR="${STORAGE_DIR:-/app/storage}"
  SECRET_FILE="${SECRET_DIR}/.jwt_secret"
  mkdir -p "$SECRET_DIR"
  if [ ! -s "$SECRET_FILE" ]; then
    head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' > "$SECRET_FILE"
    chmod 600 "$SECRET_FILE"
    echo "[entrypoint] JWT_SECRET généré et persisté ($SECRET_FILE)."
  fi
  export JWT_SECRET="$(cat "$SECRET_FILE")"
fi

echo "[entrypoint] Application du schéma (drizzle-kit push)…"
pnpm db:push

echo "[entrypoint] Insertion des données de démonstration…"
pnpm db:seed || echo "[entrypoint] seed ignoré (non bloquant)"

echo "[entrypoint] Démarrage de l'application sur le port ${PORT:-3000}…"
exec node dist/index.js
