#!/usr/bin/env bash
# Disposable Docker integration checks; does not contact providers or publish ports.
set -euo pipefail
umask 077
IMAGE_REF="${1:?Usage: bash scripts/ci-container-smoke.sh IMAGE}"
RUN_PREFIX="raero-ci-$(date +%s)-$$"
DB_VOLUME="${RUN_PREFIX}-db"
STORAGE_VOLUME="${RUN_PREFIX}-storage"
ENV_FILE="$(mktemp)"
BACKUP_ROOT="$(mktemp -d)"
RESTORED_CONTAINER="${RUN_PREFIX}-restored"
RESTORED_DB="${RUN_PREFIX}-restored-db"
RESTORED_STORAGE="${RUN_PREFIX}-restored-storage"
cleanup() {
  trap - EXIT
  docker stop -t 30 "$RUN_PREFIX" "$RESTORED_CONTAINER" >/dev/null 2>&1 || true
  docker rm "$RUN_PREFIX" "$RESTORED_CONTAINER" >/dev/null 2>&1 || true
  docker volume rm "$DB_VOLUME" "$STORAGE_VOLUME" "$RESTORED_DB" "$RESTORED_STORAGE" >/dev/null 2>&1 || true
  rm -f "$ENV_FILE"
  rm -rf "$BACKUP_ROOT"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
python3 - "$ENV_FILE" <<'PY'
import secrets, sys
from pathlib import Path
Path(sys.argv[1]).write_text('ADMIN_EMAIL=ci-fixture@example.test\nADMIN_PASSWORD='+secrets.token_urlsafe(32)+'\nSEED_DEMO_DATA=false\n')
PY
docker volume create "$DB_VOLUME" >/dev/null
docker volume create "$STORAGE_VOLUME" >/dev/null
docker run -d --name "$RUN_PREFIX" --network none --stop-timeout 30 --env-file "$ENV_FILE" \
  -v "$DB_VOLUME:/var/lib/postgresql/data" -v "$STORAGE_VOLUME:/app/storage" "$IMAGE_REF" >/dev/null
ready() {
  for ((attempt=0; attempt<30; attempt++)); do
    if docker exec "$RUN_PREFIX" node -e "fetch('http://127.0.0.1:3000/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then return 0; fi
    if [ "$(docker inspect --format '{{.State.Running}}' "$RUN_PREFIX")" != true ]; then break; fi
    sleep 2
  done
  echo 'Container did not become ready.' >&2
  docker logs --tail 40 "$RUN_PREFIX" >&2
  return 1
}
ready
for script in docker-smoke embedded-db-smoke runtime-user-smoke health-smoke; do
  docker exec -i "$RUN_PREFIX" node --input-type=module < "scripts/$script.mjs"
done
docker restart -t 30 "$RUN_PREFIX" >/dev/null
ready
docker exec -i -e RAERO_SMOKE_RESTART=true "$RUN_PREFIX" node --input-type=module < scripts/docker-smoke.mjs
docker exec -i "$RUN_PREFIX" node --input-type=module < scripts/embedded-db-smoke.mjs
# Restore a cold backup into new volumes and preserve the pre-backup session.
docker cp "$RUN_PREFIX:/tmp/raero-smoke-cookie" "$BACKUP_ROOT/cookie"
docker stop -t 30 "$RUN_PREFIX" >/dev/null
python3 scripts/backup-container.py backup "$RUN_PREFIX" "$BACKUP_ROOT/backup"
python3 scripts/backup-container.py restore "$BACKUP_ROOT/backup" "$RESTORED_DB" "$RESTORED_STORAGE"
docker run -d --name "$RESTORED_CONTAINER" --network none --stop-timeout 30 \
  -v "$RESTORED_DB:/var/lib/postgresql/data" -v "$RESTORED_STORAGE:/app/storage" "$IMAGE_REF" >/dev/null
docker cp "$BACKUP_ROOT/cookie" "$RESTORED_CONTAINER:/tmp/raero-smoke-cookie"
# Reuse the readiness routine without changing cleanup's original container identity.
( RUN_PREFIX="$RESTORED_CONTAINER"; ready )
docker exec -i -e RAERO_SMOKE_RESTART=true "$RESTORED_CONTAINER" node --input-type=module < scripts/docker-smoke.mjs
docker exec -i "$RESTORED_CONTAINER" node --input-type=module < scripts/embedded-db-smoke.mjs
echo 'Container and restore verification complete; disposable resources will be removed.' 
