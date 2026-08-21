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
# Load DATABASE_URL via Node's dotenv (not bash `source` — a raw connection string
# has &, %, $ etc. that bash's shell-script parser mangles, e.g. truncating the
# value at an unquoted `&` or expanding a `$` in the password as a variable).
DATABASE_URL=$(node -e "require('dotenv').config({ path: '$APP_DIR/server/.env', quiet: true }); process.stdout.write(process.env.DATABASE_URL || '');")
[ -n "$DATABASE_URL" ] || fail "DATABASE_URL not set in server/.env"

# DATABASE_URL also carries Prisma-only query params (connection_limit, pool_timeout)
# that libpq's URI parser rejects outright. Use Node's URL parser to drop just those
# params — a hand-rolled regex can't safely extract user/password since it won't
# percent-decode them the way libpq does.
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

step "Running migrations..."
npm run migrate
ok "Migrations complete"

step "Verifying PDF export (Puppeteer/Chromium) can launch..."
# Read-only check, deliberately non-fatal (doesn't call fail/exit 1) — a
# Chromium launch failure here means PDF export is broken, not that the rest
# of the app can't run, and this script has no business silently running
# `apt-get install` as root against production infra on every deploy. If this
# fails, install the listed packages by hand and redeploy. See DEBT.md
# (2026-07-28) and the PDF export bug writeup for how this was diagnosed.
if node -e "
(async () => {
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    await browser.close();
})().catch((err) => { console.error(err.message); process.exit(1); });
"; then
    ok "Puppeteer/Chromium launches — PDF export should work"
else
    echo -e "${RED}⚠ Puppeteer/Chromium failed to launch — PDF export will fail until this is fixed.${NC}"
    echo -e "${RED}  On Debian/Ubuntu, install Chromium's required shared libraries and redeploy:${NC}"
    echo -e "${RED}  sudo apt-get install -y ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libgcc1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 lsb-release wget xdg-utils${NC}"
fi

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

