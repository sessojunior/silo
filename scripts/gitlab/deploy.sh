#!/bin/sh
set -eu

: "${DEPLOY_SSH_HOST:?DEPLOY_SSH_HOST nao definido}"
: "${DEPLOY_SSH_USER:?DEPLOY_SSH_USER nao definido}"
: "${DEPLOY_SSH_PRIVATE_KEY:?DEPLOY_SSH_PRIVATE_KEY nao definido}"
: "${DEPLOY_PATH:?DEPLOY_PATH nao definido}"
: "${DEPLOY_IMAGE:?DEPLOY_IMAGE nao definido}"
: "${REGISTRY_DEPLOY_USER:?REGISTRY_DEPLOY_USER nao definido}"
: "${REGISTRY_DEPLOY_PASSWORD:?REGISTRY_DEPLOY_PASSWORD nao definido}"
: "${CI_REGISTRY:?CI_REGISTRY nao definido}"

DEPLOY_SSH_PORT="${DEPLOY_SSH_PORT:-22}"
DEPLOY_COMPOSE_FILE="${DEPLOY_COMPOSE_FILE:-docker-compose.deploy.yml}"
DEPLOY_BASE_PATH="${DEPLOY_BASE_PATH:-/silo}"

SSH_KEY_FILE="$(mktemp)"
KNOWN_HOSTS_FILE="$(mktemp)"

cleanup() {
  rm -f "$SSH_KEY_FILE" "$KNOWN_HOSTS_FILE"
}

trap cleanup EXIT

printf '%s\n' "$DEPLOY_SSH_PRIVATE_KEY" | tr -d '\r' > "$SSH_KEY_FILE"
chmod 600 "$SSH_KEY_FILE"

ssh-keyscan -p "$DEPLOY_SSH_PORT" "$DEPLOY_SSH_HOST" > "$KNOWN_HOSTS_FILE" 2>/dev/null

printf '%s\n' "$REGISTRY_DEPLOY_PASSWORD" | ssh \
  -i "$SSH_KEY_FILE" \
  -p "$DEPLOY_SSH_PORT" \
  -o BatchMode=yes \
  -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile="$KNOWN_HOSTS_FILE" \
  "$DEPLOY_SSH_USER@$DEPLOY_SSH_HOST" \
  "docker login '$CI_REGISTRY' -u '$REGISTRY_DEPLOY_USER' --password-stdin"

ssh \
  -i "$SSH_KEY_FILE" \
  -p "$DEPLOY_SSH_PORT" \
  -o BatchMode=yes \
  -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile="$KNOWN_HOSTS_FILE" \
  "$DEPLOY_SSH_USER@$DEPLOY_SSH_HOST" \
  "DEPLOY_PATH='$DEPLOY_PATH' DEPLOY_IMAGE='$DEPLOY_IMAGE' DEPLOY_COMPOSE_FILE='$DEPLOY_COMPOSE_FILE' DEPLOY_BASE_PATH='$DEPLOY_BASE_PATH' sh -s" <<'REMOTE'
set -eu

cd "$DEPLOY_PATH"
export SILO_IMAGE="$DEPLOY_IMAGE"
export HEALTHCHECK_URL="http://127.0.0.1:3000${DEPLOY_BASE_PATH%/}/health"

docker compose -f "$DEPLOY_COMPOSE_FILE" pull
docker compose -f "$DEPLOY_COMPOSE_FILE" up -d --remove-orphans --force-recreate
docker compose -f "$DEPLOY_COMPOSE_FILE" ps

attempts=30
while [ "$attempts" -gt 0 ]; do
  if docker compose -f "$DEPLOY_COMPOSE_FILE" exec -T silo node -e "fetch(process.env.HEALTHCHECK_URL).then((response) => { process.exit(response.ok ? 0 : 1); }).catch(() => process.exit(1));"; then
    exit 0
  fi

  attempts=$((attempts - 1))
  sleep 2
done

echo "Healthcheck failed"
docker compose -f "$DEPLOY_COMPOSE_FILE" logs --tail=100 silo || true
exit 1
REMOTE