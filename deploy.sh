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
# Unset NODE_ENV so devDependencies (typescript, tsx, etc.) are installed for the build
NODE_ENV=development npm ci
ok "Server deps installed"

step "Building server (TypeScript → dist/)..."
npm run build
ok "Server built"

step "Initializing schema (first deploy only)..."
# On a brand-new empty database, restore the full schema from schema.sql before
# running node-pg-migrate. On subsequent deploys the pgmigrations table exists and
# this block is skipped entirely.
#
# DATABASE_URL carries Prisma-only query params (connection_limit, pool_timeout)
# that libpq's URI parser rejects outright. Use Node's URL parser (already on this
# box) to drop just those params — a hand-rolled regex can't safely extract
# user/password since it won't percent-decode them the way libpq does.
PSQL_URL=$(DATABASE_URL="$DATABASE_URL" node -e '
    const u = new URL(process.env.DATABASE_URL);
    ["connection_limit", "pool_timeout", "pgbouncer", "schema"].forEach((p) => u.searchParams.delete(p));
    process.stdout.write(u.toString());
') || fail "Could not parse DATABASE_URL"

TABLE_COUNT=$(psql "$PSQL_URL" -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'") || fail "Could not query database — check DATABASE_URL"
if [ "$TABLE_COUNT" -eq "0" ]; then
    psql "$PSQL_URL" < "$APP_DIR/server/schema.sql" || fail "Schema init failed"
    ok "Schema initialized from schema.sql"
else
    ok "Schema already exists — skipping init"
fi
unset PGPASSWORD

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

