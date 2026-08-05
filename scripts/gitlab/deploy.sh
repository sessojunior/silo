#!/bin/sh
set -eu

fail() {
  printf '%s\n' "deploy.sh: $*" >&2
  exit 1
}

require_var() {
  name="$1"
  value="${2:-}"
  if [ -z "$value" ]; then
    fail "variavel obrigatoria ausente: $name"
  fi
}

shell_quote() {
  printf "'%s'" "$(printf '%s' "$1" | sed "s/'/'\\\\''/g")"
}

require_var DEPLOY_SSH_HOST "${DEPLOY_SSH_HOST:-}"
require_var DEPLOY_SSH_USER "${DEPLOY_SSH_USER:-}"
require_var DEPLOY_SSH_PRIVATE_KEY "${DEPLOY_SSH_PRIVATE_KEY:-}"
require_var DEPLOY_PATH "${DEPLOY_PATH:-}"
require_var REGISTRY_DEPLOY_USER "${REGISTRY_DEPLOY_USER:-}"
require_var REGISTRY_DEPLOY_PASSWORD "${REGISTRY_DEPLOY_PASSWORD:-}"
require_var CI_REGISTRY "${CI_REGISTRY:-}"
require_var DEPLOY_IMAGE "${DEPLOY_IMAGE:-}"

DEPLOY_SSH_PORT="${DEPLOY_SSH_PORT:-22}"
DEPLOY_COMPOSE_FILE="${DEPLOY_COMPOSE_FILE:-docker-compose.deploy.yml}"
REGISTRY_HOST="${REGISTRY_HOST:-$CI_REGISTRY}"

private_key_file="$(mktemp)"
known_hosts_file="$(mktemp)"
cleanup() {
  rm -f "$private_key_file" "$known_hosts_file"
}
trap cleanup EXIT INT TERM

printf '%s\n' "$DEPLOY_SSH_PRIVATE_KEY" > "$private_key_file"
chmod 600 "$private_key_file"

ssh-keyscan -p "$DEPLOY_SSH_PORT" "$DEPLOY_SSH_HOST" > "$known_hosts_file" 2>/dev/null || {
  fail "nao foi possivel obter a chave SSH de $DEPLOY_SSH_HOST"
}

remote_env="DEPLOY_PATH=$(shell_quote "$DEPLOY_PATH") \
DEPLOY_COMPOSE_FILE=$(shell_quote "$DEPLOY_COMPOSE_FILE") \
SILO_IMAGE=$(shell_quote "$DEPLOY_IMAGE") \
REGISTRY_HOST=$(shell_quote "$REGISTRY_HOST") \
REGISTRY_DEPLOY_USER=$(shell_quote "$REGISTRY_DEPLOY_USER") \
REGISTRY_DEPLOY_PASSWORD=$(shell_quote "$REGISTRY_DEPLOY_PASSWORD")"

ssh \
  -i "$private_key_file" \
  -p "$DEPLOY_SSH_PORT" \
  -o UserKnownHostsFile="$known_hosts_file" \
  -o StrictHostKeyChecking=yes \
  "$DEPLOY_SSH_USER@$DEPLOY_SSH_HOST" \
  "$remote_env sh -se" <<'REMOTE'
set -eu

cd "$DEPLOY_PATH"

printf '%s\n' "$REGISTRY_DEPLOY_PASSWORD" | docker login "$REGISTRY_HOST" -u "$REGISTRY_DEPLOY_USER" --password-stdin

docker compose -f "$DEPLOY_COMPOSE_FILE" config >/dev/null
docker compose -f "$DEPLOY_COMPOSE_FILE" pull
docker compose -f "$DEPLOY_COMPOSE_FILE" up -d --remove-orphans --wait --wait-timeout 300

docker compose -f "$DEPLOY_COMPOSE_FILE" ps
docker compose -f "$DEPLOY_COMPOSE_FILE" exec -T api python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:4000/health', timeout=5).read()"
docker compose -f "$DEPLOY_COMPOSE_FILE" exec -T worker python -m silo.worker.healthcheck
REMOTE
