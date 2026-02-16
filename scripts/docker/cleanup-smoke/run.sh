#!/usr/bin/env bash
set -euo pipefail

cd /repo

export MOLTBOT_STATE_DIR="/tmp/moltbot-test"
export MOLTBOT_CONFIG_PATH="${MOLTBOT_STATE_DIR}/moltbot.json"

echo "==> Build"
pnpm build

echo "==> Seed state"
mkdir -p "${MOLTBOT_STATE_DIR}/credentials"
mkdir -p "${MOLTBOT_STATE_DIR}/agents/main/sessions"
echo '{}' >"${MOLTBOT_CONFIG_PATH}"
echo 'creds' >"${MOLTBOT_STATE_DIR}/credentials/marker.txt"
echo 'session' >"${MOLTBOT_STATE_DIR}/agents/main/sessions/sessions.json"

echo "==> Reset (config+creds+sessions)"
pnpm moltbot reset --scope config+creds+sessions --yes --non-interactive

test ! -f "${MOLTBOT_CONFIG_PATH}"
test ! -d "${MOLTBOT_STATE_DIR}/credentials"
test ! -d "${MOLTBOT_STATE_DIR}/agents/main/sessions"

echo "==> Recreate minimal config"
mkdir -p "${MOLTBOT_STATE_DIR}/credentials"
echo '{}' >"${MOLTBOT_CONFIG_PATH}"

echo "==> Uninstall (state only)"
pnpm moltbot uninstall --state --yes --non-interactive

test ! -d "${MOLTBOT_STATE_DIR}"

echo "OK"
