#!/bin/bash
set -euo pipefail

APP_DIR="/home/fitforce/app"

GREEN='\033[0;32m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

step() { echo -e "\n${CYAN}==> $1${NC}"; }
ok()   { echo -e "${GREEN}✓ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; exit 1; }

cd "$APP_DIR" || fail "Could not cd to $APP_DIR"

step "Pulling latest code..."
git pull origin main
ok "Code updated"

step "Installing server dependencies..."
cd "$APP_DIR/server"
npm ci --omit=dev
ok "Server deps installed"

step "Running migrations..."
npm run migrate
ok "Migrations complete"

step "Installing client dependencies..."
cd "$APP_DIR/client"
npm ci
ok "Client deps installed"

step "Building Next.js..."
npm run build
ok "Build complete"

step "Restarting apps..."
pm2 restart fitforce-api
pm2 restart fitforce-web
ok "Apps restarted"

echo ""
pm2 status
