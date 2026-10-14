#!/usr/bin/env bash
# Deploy the latest `time-linked-layers` to the production server.
#
# Usage: DEPLOY_HOST=you@bioimadata-01.utu.fi deploy/deploy.sh
#
# DEPLOY_HOST must be an SSH login with sudo rights. Git and the build run as
# the unprivileged APP_USER; sudo is only used for systemctl.
set -euo pipefail

: "${DEPLOY_HOST:?set DEPLOY_HOST, e.g. you@bioimadata-01.utu.fi}"
APP_USER="${APP_USER:-neuroglancer-fork}"
APP_PATH="${APP_PATH:-/opt/neuroglancer-fork}"
BRANCH="${BRANCH:-time-linked-layers}"
SERVICE="${SERVICE:-neuroglancer-fork}"

ssh -t "$DEPLOY_HOST" bash -es -- "$APP_USER" "$APP_PATH" "$BRANCH" "$SERVICE" <<'REMOTE'
set -euo pipefail
app_user=$1 app_path=$2 branch=$3 service=$4

sudo -u "$app_user" -H bash -es -- "$app_path" "$branch" <<'AS_APP_USER'
set -euo pipefail
cd "$1"
git fetch origin "$2"
git checkout "$2"
git merge --ff-only "origin/$2"
npm ci
npm run build -- --no-typecheck --no-lint
echo "Deployed $(git rev-parse --short HEAD)"
AS_APP_USER

# http.server reads from disk per request, so a restart is not required after a
# rebuild; this just makes sure the service is enabled and running.
sudo systemctl enable --now "$service"
systemctl --no-pager --lines=0 status "$service"
REMOTE
