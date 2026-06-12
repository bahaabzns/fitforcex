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

# Load server env vars (DATABASE_URL etc.) so deploy steps can use them
if [ -f "$APP_DIR/server/.env" ]; then
    set -a
    # shellcheck source=server/.env
    source "$APP_DIR/server/.env"
    set +a
fi

step "Pulling latest code..."
git fetch origin
git reset --hard origin/main
ok "Code updated"

step "Installing server dependencies..."
cd "$APP_DIR/server"
npm ci
ok "Server deps installed"

step "Building server (TypeScript → dist/)..."
npm run build
ok "Server built"

step "Initializing schema (first deploy only)..."
# On a brand-new empty database, restore the full schema from schema.sql before
# running node-pg-migrate. On subsequent deploys the pgmigrations table exists and
# this block is skipped entirely.
TABLE_COUNT=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'" 2>/dev/null || echo "0")
if [ "$TABLE_COUNT" -eq "0" ]; then
    psql "$DATABASE_URL" < "$APP_DIR/server/schema.sql" || fail "Schema init failed"
    ok "Schema initialized from schema.sql"
else
    ok "Schema already exists — skipping init"
fi

step "Running migrations..."
npm run migrate
ok "Migrations complete"

step "Installing client dependencies..."
cd "$APP_DIR/client"
# Unset NODE_ENV so npm ci installs devDependencies needed for the build
# (tailwindcss, @tailwindcss/postcss, etc. are devDeps but required at build time)
NODE_ENV=development npm ci
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

