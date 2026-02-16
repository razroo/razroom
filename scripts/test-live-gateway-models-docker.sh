#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE_NAME="${RAZROOM_IMAGE:-${RAZROOM_IMAGE:-razroom:local}}"
CONFIG_DIR="${RAZROOM_CONFIG_DIR:-${RAZROOM_CONFIG_DIR:-$HOME/.razroom}}"
WORKSPACE_DIR="${RAZROOM_WORKSPACE_DIR:-${RAZROOM_WORKSPACE_DIR:-$HOME/.razroom/workspace}}"
PROFILE_FILE="${RAZROOM_PROFILE_FILE:-${RAZROOM_PROFILE_FILE:-$HOME/.profile}}"

PROFILE_MOUNT=()
if [[ -f "$PROFILE_FILE" ]]; then
  PROFILE_MOUNT=(-v "$PROFILE_FILE":/home/node/.profile:ro)
fi

echo "==> Build image: $IMAGE_NAME"
docker build -t "$IMAGE_NAME" -f "$ROOT_DIR/Dockerfile" "$ROOT_DIR"

echo "==> Run gateway live model tests (profile keys)"
docker run --rm -t \
  --entrypoint bash \
  -e COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
  -e HOME=/home/node \
  -e NODE_OPTIONS=--disable-warning=ExperimentalWarning \
  -e RAZROOM_LIVE_TEST=1 \
  -e RAZROOM_LIVE_GATEWAY_MODELS="${RAZROOM_LIVE_GATEWAY_MODELS:-${RAZROOM_LIVE_GATEWAY_MODELS:-all}}" \
  -e RAZROOM_LIVE_GATEWAY_PROVIDERS="${RAZROOM_LIVE_GATEWAY_PROVIDERS:-${RAZROOM_LIVE_GATEWAY_PROVIDERS:-}}" \
  -e RAZROOM_LIVE_GATEWAY_MODEL_TIMEOUT_MS="${RAZROOM_LIVE_GATEWAY_MODEL_TIMEOUT_MS:-${RAZROOM_LIVE_GATEWAY_MODEL_TIMEOUT_MS:-}}" \
  -v "$CONFIG_DIR":/home/node/.razroom \
  -v "$WORKSPACE_DIR":/home/node/.razroom/workspace \
  "${PROFILE_MOUNT[@]}" \
  "$IMAGE_NAME" \
  -lc "set -euo pipefail; [ -f \"$HOME/.profile\" ] && source \"$HOME/.profile\" || true; cd /app && pnpm test:live"
