#!/usr/bin/env bash
set -euo pipefail

cd /repo

export RAZROOM_STATE_DIR="/tmp/razroom-test"
export RAZROOM_CONFIG_PATH="${RAZROOM_STATE_DIR}/razroom.json"

echo "==> Build"
pnpm build

echo "==> Seed state"
mkdir -p "${RAZROOM_STATE_DIR}/credentials"
mkdir -p "${RAZROOM_STATE_DIR}/agents/main/sessions"
echo '{}' >"${RAZROOM_CONFIG_PATH}"
echo 'creds' >"${RAZROOM_STATE_DIR}/credentials/marker.txt"
echo 'session' >"${RAZROOM_STATE_DIR}/agents/main/sessions/sessions.json"

echo "==> Reset (config+creds+sessions)"
pnpm razroom reset --scope config+creds+sessions --yes --non-interactive

test ! -f "${RAZROOM_CONFIG_PATH}"
test ! -d "${RAZROOM_STATE_DIR}/credentials"
test ! -d "${RAZROOM_STATE_DIR}/agents/main/sessions"

echo "==> Recreate minimal config"
mkdir -p "${RAZROOM_STATE_DIR}/credentials"
echo '{}' >"${RAZROOM_CONFIG_PATH}"

echo "==> Uninstall (state only)"
pnpm razroom uninstall --state --yes --non-interactive

test ! -d "${RAZROOM_STATE_DIR}"

echo "OK"
