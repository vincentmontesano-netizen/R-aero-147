#!/usr/bin/env bash
# ─── R-AERO Training Academy — all-in-one container entrypoint ────────────────
# Starts an embedded PostgreSQL, applies versioned migrations, bootstraps an admin, then
# launches the Node application. Everything runs inside this single container.
set -euo pipefail
umask 077

PGDATA="${PGDATA:-/var/lib/postgresql/data}"
PGBIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)"
DB_NAME="raero"
DB_USER="raero"

mkdir -p "$PGDATA"
chown -R postgres:postgres "$PGDATA"
chmod 700 "$PGDATA"

if [ ! -s "$PGDATA/PG_VERSION" ]; then
  echo "[entrypoint] Initialisation de PostgreSQL…"
  su postgres -c "$PGBIN/initdb -D '$PGDATA' --auth-local=peer --auth-host=scram-sha-256 --encoding=UTF8" >/dev/null
fi

echo "[entrypoint] Démarrage de PostgreSQL…"
su postgres -c "$PGBIN/pg_ctl -D '$PGDATA' -o '-c listen_addresses=127.0.0.1 -p 5432' -w -t 60 start"

APP_PID=""
cleanup() {
  trap - EXIT TERM INT
  if [ -n "$APP_PID" ]; then
    kill -TERM "$APP_PID" 2>/dev/null || true
    wait "$APP_PID" 2>/dev/null || true
  fi
  echo "[entrypoint] Arrêt propre de PostgreSQL…"
  su postgres -c "$PGBIN/pg_ctl -D '$PGDATA' -m fast -w -t 20 stop" || true
}
trap cleanup EXIT
trap 'exit 143' TERM
trap 'exit 130' INT


# Configure this embedded cluster, upgrading old fixed-password volumes in place.
node scripts/provision-embedded-db.mjs
DB_PASS="$(cat "$PGDATA/.raero-password")"
export DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}"
unset DB_PASS

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

echo "[entrypoint] Application des migrations versionnées…"
pnpm db:migrate
pnpm db:bootstrap-admin

if [ "${SEED_DEMO_DATA:-false}" = "true" ]; then
  echo "[entrypoint] Insertion explicite des données de démonstration…"
  pnpm db:seed
fi

# Only application files are writable by the runtime user. Database data and
# source remain owned by their respective service/root users.
export STORAGE_DIR="${STORAGE_DIR:-/app/storage}"
mkdir -p "$STORAGE_DIR"
chown -R node:node "$STORAGE_DIR"
if [ -f "$STORAGE_DIR/.jwt_secret" ]; then
  chown root:root "$STORAGE_DIR/.jwt_secret"
  chmod 600 "$STORAGE_DIR/.jwt_secret"
fi
# Bootstrap credentials have no purpose in the serving process.
unset ADMIN_PASSWORD

echo "[entrypoint] Démarrage de l'application sur le port ${PORT:-3000}…"
setpriv --reuid=node --regid=node --init-groups --no-new-privs node dist/index.js &
APP_PID=$!
set +e
wait "$APP_PID"
APP_STATUS=$?
set -e
exit "$APP_STATUS"
