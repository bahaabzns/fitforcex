# FitForce X — Hostinger VPS Deployment Guide

**Stack:** Express 5 (port 4000) · Next.js 16 (port 3000) · PostgreSQL · Cloudflare R2 · Nginx · PM2  
**Target OS:** Ubuntu 22.04 LTS  
**Estimated time:** 1.5 – 2 hours (first deploy)

---

## Table of Contents

1. [Buy & Configure Your VPS on Hostinger](#1-buy--configure-your-vps-on-hostinger)
2. [First SSH Login & Root Security](#2-first-ssh-login--root-security)
3. [Create a Deploy User](#3-create-a-deploy-user)
4. [Install Node.js via nvm](#4-install-nodejs-via-nvm)
5. [Install & Configure PostgreSQL](#5-install--configure-postgresql)
6. [Install Nginx & PM2](#6-install-nginx--pm2)
7. [Point Your Domain to the VPS](#7-point-your-domain-to-the-vps)
8. [Upload Your Code](#8-upload-your-code)
9. [Configure Environment Variables](#9-configure-environment-variables)
10. [Install Dependencies & Run Migrations](#10-install-dependencies--run-migrations)
11. [Build the Next.js Frontend](#11-build-the-nextjs-frontend)
12. [Configure PM2 Process Manager](#12-configure-pm2-process-manager)
13. [Configure Nginx Reverse Proxy](#13-configure-nginx-reverse-proxy)
14. [SSL Certificate with Let's Encrypt](#14-ssl-certificate-with-lets-encrypt)
15. [Cloudflare R2 Bucket Setup](#15-cloudflare-r2-bucket-setup)
16. [Sentry Project Setup](#16-sentry-project-setup)
17. [Firewall Rules](#17-firewall-rules)
18. [Verify Everything is Live](#18-verify-everything-is-live)
19. [How to Redeploy After Changes](#19-how-to-redeploy-after-changes)
20. [Useful Commands Reference](#20-useful-commands-reference)

---

## 1. Buy & Configure Your VPS on Hostinger

### Choose a Plan

Go to **hostinger.com → VPS Hosting**.

For a new SaaS with under 100 coaches, **KVM 2** is a safe starting point:

| Plan | RAM | CPU | Storage | Price |
|------|-----|-----|---------|-------|
| KVM 1 | 4 GB | 2 vCPU | 50 GB NVMe | ~$5/mo |
| **KVM 2** ✓ | **8 GB** | **4 vCPU** | **100 GB NVMe** | **~$8/mo** |
| KVM 4 | 16 GB | 6 vCPU | 200 GB NVMe | ~$14/mo |

KVM 1 works for MVP. Upgrade to KVM 2 when you have real users.

### OS Selection

During setup, select:
- **OS:** Ubuntu 22.04 LTS (64-bit)
- **Panel:** None (we'll manage everything manually)

### After Purchase

Hostinger sends you:
- VPS IP address (e.g., `195.123.45.67`)
- Root password (or SSH key option)

Save both. You will need them in Step 2.

---

## 2. First SSH Login & Root Security

### Connect as Root

On your local machine (Windows Terminal / PowerShell / macOS Terminal):

```bash
ssh root@YOUR_VPS_IP
```
ssh root@76.13.145.228
When prompted, type the root password Hostinger gave you. You are now inside the server.

### Update the System

```bash
apt update && apt upgrade -y
apt install -y curl wget git unzip build-essential ufw fail2ban
```

This takes 2-3 minutes. Let it finish.

### Harden SSH — Disable Password Login

First, add your local SSH public key to the server so you can log in without a password.

**On your local machine** (open a new terminal window, don't close the server one):

```bash
# If you don't have an SSH key yet, generate one first:
ssh-keygen -t ed25519 -C "your-email@example.com"

# Print your public key:
cat ~/.ssh/id_ed25519.pub
```

Copy the entire output (starts with `ssh-ed25519 ...`).

**Back on the server:**

```bash
mkdir -p ~/.ssh
nano ~/.ssh/authorized_keys
```

Paste your public key, then save: `Ctrl+X` → `Y` → `Enter`.

```bash
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

Now disable password authentication:

```bash
nano /etc/ssh/sshd_config
```

Find and change these lines (use `Ctrl+W` to search):

```
PasswordAuthentication no
PermitRootLogin no
```

> **Important:** Don't close this terminal yet. Open a second terminal and test that `ssh root@YOUR_VPS_IP` now fails before you proceed.

Restart SSH:

```bash
systemctl restart ssh
```

---

## 3. Create a Deploy User

Never run your app as root. Create a dedicated user:

```bash
adduser fitforce
# Enter a strong password when prompted
# Press Enter for all other fields

usermod -aG sudo fitforce

# Copy root SSH keys so the new user can also log in via SSH key
mkdir -p /home/fitforce/.ssh
cp ~/.ssh/authorized_keys /home/fitforce/.ssh/
chown -R fitforce:fitforce /home/fitforce/.ssh
chmod 700 /home/fitforce/.ssh
chmod 600 /home/fitforce/.ssh/authorized_keys
```

Test the new user in a **new terminal window** before proceeding:

```bash
ssh fitforce@YOUR_VPS_IP
```

If it connects, you are good. All remaining steps run as `fitforce` unless stated otherwise.

---

## 4. Install Node.js via nvm

**As the `fitforce` user:**

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Load nvm into current shell (or close and reopen the terminal)
source ~/.bashrc

# Install Node.js 20 LTS
nvm install 20
nvm use 20
nvm alias default 20

# Verify
node -v    # should print v20.x.x
npm -v     # should print 10.x.x
```

---

## 5. Install & Configure PostgreSQL

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

### Create the Database and User

```bash
sudo -u postgres psql
```

You are now inside the PostgreSQL shell (`postgres=#`). Run these commands one by one — replace the password with something strong:

```sql
CREATE USER fitforce_user WITH PASSWORD 'Canyouseeme@441199';
CREATE DATABASE fitforce_db OWNER fitforce_user;
GRANT ALL PRIVILEGES ON DATABASE fitforce_db TO fitforce_user;
\q
```

### Test the Connection

```bash
psql -U fitforce_user -d fitforce_db -h localhost
# Enter the password you just set
# You should see: fitforce_db=>
\q
```

### Get the Database URL

Your `DATABASE_URL` for the `.env` file will be:

```
postgresql://fitforce_user:STRONG_DB_PASSWORD_HERE@localhost:5432/fitforce_db
```

---

## 6. Install Nginx & PM2

```bash
# Nginx — web server / reverse proxy
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx

# PM2 — Node.js process manager (keeps apps alive, auto-restarts on crash)
npm install -g pm2
###hereee
# Verify
nginx -v       # nginx/1.x.x
pm2 --version  # 5.x.x
```

---

## 7. Point Your Domain to the VPS

### In Hostinger hPanel (or wherever your domain is registered):

1. Go to **DNS Zone** for your domain
2. Delete any existing **A records** for `@` and `www`
3. Add two new A records:

| Type | Name | Points to | TTL |
|------|------|-----------|-----|
| A | `@` | `YOUR_VPS_IP` | 300 |
| A | `www` | `YOUR_VPS_IP` | 300 |

DNS changes propagate in 5-30 minutes. You can check propagation at [dnschecker.org](https://dnschecker.org).

> **If your domain is on Cloudflare:** Add the A records there instead, and set the proxy status to **DNS only** (grey cloud) for now. You can enable the orange cloud (proxy) later.

---

## 8. Upload Your Code

### Option A — Git (Recommended)

If your repo is on GitHub:

```bash
cd /home/fitforce
git clone https://github.com/bahaabzns/fitforcex.git app
cd app
```

If the repo is private, either:
- Use a **GitHub Personal Access Token** as the password when prompted
- Or add the VPS SSH key to GitHub (see Step 8b below)

#### 8b — Add VPS SSH Key to GitHub (for private repos)

```bash
# On the VPS, generate an SSH key for the deploy user
ssh-keygen -t ed25519 -C "fitforce-vps-deploy"
# Press Enter for all prompts (no passphrase)

cat ~/.ssh/id_ed25519.pub
```

Copy the output. Go to **GitHub → Settings → SSH and GPG keys → New SSH key** and paste it.

Then clone with SSH:

```bash
git clone git@github.com:YOUR_USERNAME/fitforce-x.git app
```

### Option B — Upload via SCP (if not using Git)

On your **local machine:**

```bash
scp -r /path/to/fitforce-x fitforce@YOUR_VPS_IP:/home/fitforce/app
```

---

## 9. Configure Environment Variables

### Server `.env`

```bash
cd /home/fitforce/app/server
nano .env
```

Paste and fill in every value:

```env
# ── Database ──────────────────────────────────────────────────────
DATABASE_URL=postgresql://fitforce_user:STRONG_DB_PASSWORD_HERE@localhost:5432/fitforce_db

# ── Server ────────────────────────────────────────────────────────
PORT=4000
NODE_ENV=production
ALLOWED_ORIGINS=https://yourdomain.com

# ── Auth ──────────────────────────────────────────────────────────
# Generate with: node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
JWT_SECRET=GENERATE_A_LONG_RANDOM_STRING_HERE
ADMIN_JWT_SECRET=GENERATE_A_DIFFERENT_LONG_RANDOM_STRING_HERE

# ── Cloudflare R2 File Storage ────────────────────────────────────
S3_REGION=auto
S3_ENDPOINT=https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
S3_BUCKET=fitforce-uploads
S3_ACCESS_KEY=YOUR_R2_ACCESS_KEY
S3_SECRET_KEY=YOUR_R2_SECRET_KEY
S3_PUBLIC_URL=https://pub-YOUR_HASH.r2.dev

# ── Observability ─────────────────────────────────────────────────
SENTRY_DSN=https://YOUR_KEY@sentry.io/YOUR_PROJECT_ID
LOG_LEVEL=info
```

**Generate secrets right now:**

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
# Run this twice — once for JWT_SECRET, once for ADMIN_JWT_SECRET
```

Paste each output into the correct field.

Save: `Ctrl+X` → `Y` → `Enter`

Lock down the file so only the app user can read it:

```bash
chmod 600 /home/fitforce/app/server/.env
```

### Client `.env.production`

```bash
cd /home/fitforce/app/client
nano .env.production
```

```env
NEXT_PUBLIC_API_URL=https://yourdomain.com
```

Save and exit.

---

## 10. Install Dependencies & Run Migrations

### Server

```bash
cd /home/fitforce/app/server
npm ci --omit=dev
```

`npm ci` is faster than `npm install` and installs exactly what's in `package-lock.json`. The `--omit=dev` flag skips devDependencies (nodemon, jest, etc.) — you don't need them in production.

### Run Database Migrations

```bash
cd /home/fitforce/app/server
npm run migrate
```

You should see output like:

```
> node-pg-migrate up
Migrating files:
- 001_baseline
Finished running 1 migration!
```

If you see errors, check that `DATABASE_URL` in `.env` is correct and PostgreSQL is running:

```bash
sudo systemctl status postgresql
```

### Client

```bash
cd /home/fitforce/app/client
npm ci
```

---

## 11. Build the Next.js Frontend

```bash
cd /home/fitforce/app/client
npm run build
```

This takes 1-3 minutes. A successful build ends with:

```
✓ Compiled successfully
Route (app)   ...
```

If the build fails, the most common cause is a missing `NEXT_PUBLIC_API_URL`. Double-check your `client/.env.production` file.

---

## 12. Configure PM2 Process Manager

PM2 keeps both apps running, restarts them if they crash, and starts them automatically when the server reboots.

### Create the PM2 Ecosystem File

```bash
cd /home/fitforce/app
nano ecosystem.config.cjs
```

Paste:

```js
module.exports = {
    apps: [
        {
            name: 'fitforce-api',
            script: 'server.js',
            cwd: '/home/fitforce/app/server',
            instances: 1,
            exec_mode: 'fork',
            node_args: '--max-old-space-size=512',
            env_production: {
                NODE_ENV: 'production',
                PORT: 4000,
            },
            error_file: '/home/fitforce/logs/api-error.log',
            out_file: '/home/fitforce/logs/api-out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
            max_memory_restart: '400M',
            restart_delay: 3000,
            max_restarts: 10,
        },
        {
            name: 'fitforce-web',
            script: 'node_modules/.bin/next',
            args: 'start',
            cwd: '/home/fitforce/app/client',
            instances: 1,
            exec_mode: 'fork',
            node_args: '--max-old-space-size=512',
            env_production: {
                NODE_ENV: 'production',
                PORT: 3000,
            },
            error_file: '/home/fitforce/logs/web-error.log',
            out_file: '/home/fitforce/logs/web-out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
            max_memory_restart: '400M',
            restart_delay: 3000,
            max_restarts: 10,
        },
    ],
};
```

### Create the Logs Directory

```bash
mkdir -p /home/fitforce/logs
```

### Start Both Apps

```bash
cd /home/fitforce/app
pm2 start ecosystem.config.cjs --env production

# Verify both are running (status should be "online")
pm2 status
```

Expected output:

```
┌─────┬──────────────────┬─────────┬──────┬───────────┬──────────┐
│ id  │ name             │ mode    │ pid  │ status    │ cpu  mem │
├─────┼──────────────────┼─────────┼──────┼───────────┼──────────┤
│ 0   │ fitforce-api     │ fork    │ 1234 │ online    │ 0%  80mb │
│ 1   │ fitforce-web     │ fork    │ 1235 │ online    │ 0%  120mb│
└─────┴──────────────────┴─────────┴──────┴───────────┴──────────┘
```

If either shows `errored`, check the logs immediately:

```bash
pm2 logs fitforce-api --lines 50
pm2 logs fitforce-web --lines 50
```

### Auto-start on Server Reboot

```bash
pm2 startup
# PM2 prints a command starting with "sudo env PATH=..."
# Copy that exact command and run it

# Then save the current process list
pm2 save
```

---

## 13. Configure Nginx Reverse Proxy

Nginx sits in front of both apps. It routes:
- `yourdomain.com/api/*` → Express on port 4000
- `yourdomain.com/*` → Next.js on port 3000

### Create the Site Config

```bash
sudo nano /etc/nginx/sites-available/fitforce
```

Paste the entire block below, replacing `yourdomain.com` with your actual domain:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com www.yourdomain.com;

    # Max upload size — match your multer limit (50 MB)
    client_max_body_size 55M;

    # Security headers (helmet handles app-level, nginx handles transport-level)
    add_header X-Real-IP $remote_addr;

    # ── API → Express (port 4000) ─────────────────────────────────
    location /api/ {
        proxy_pass         http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        'upgrade';
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 120s;
        proxy_connect_timeout 10s;
    }

    # ── Everything else → Next.js (port 3000) ────────────────────
    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        'upgrade';
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 120s;
    }

    # ── Next.js static assets (cache aggressively) ────────────────
    location /_next/static/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_cache_valid 200 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
}
```

### Enable the Site

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/fitforce /etc/nginx/sites-enabled/

# Remove the default nginx page
sudo rm -f /etc/nginx/sites-enabled/default

# Test config for syntax errors
sudo nginx -t
# Expected: "syntax is ok" and "test is successful"

# Apply
sudo systemctl reload nginx
```

At this point, `http://yourdomain.com` should show your app over plain HTTP. We'll add HTTPS in the next step.

---

## 14. SSL Certificate with Let's Encrypt

```bash
# Install certbot
sudo apt install -y certbot python3-certbot-nginx

# Get the certificate (replace with your actual domain and email)
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com \
    --email your@email.com \
    --agree-tos \
    --non-interactive \
    --redirect
```

Certbot will:
1. Verify domain ownership via HTTP
2. Issue a free SSL certificate
3. **Automatically update** your nginx config to redirect HTTP → HTTPS
4. Set up auto-renewal via a cron job

### Verify Auto-Renewal

```bash
sudo certbot renew --dry-run
# Should print: "Congratulations, all simulated renewals succeeded"
```

Your site is now live at `https://yourdomain.com`. Open it in a browser and confirm the padlock appears.

---

## 15. Cloudflare R2 Bucket Setup

Your `.env` already has the R2 credentials. Here's how to create the bucket if you haven't yet.

### Create the Bucket

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **R2 Object Storage**
2. Click **Create bucket**
3. Name it exactly: `fitforce-uploads` (must match `S3_BUCKET` in `.env`)
4. Choose region: **Automatic**
5. Click **Create bucket**

### Create API Credentials

1. In R2, click **Manage R2 API Tokens**
2. Click **Create API token**
3. Set **Permissions:** Object Read & Write
4. Set **Specify bucket(s):** `fitforce-uploads`
5. Click **Create API token**
6. Copy **Access Key ID** → paste into `S3_ACCESS_KEY` in `.env`
7. Copy **Secret Access Key** → paste into `S3_SECRET_KEY` in `.env`
8. Your **Account ID** is shown at the top of the R2 page → build your endpoint:
   ```
   S3_ENDPOINT=https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
   ```

### Enable Public Access (for exercise media)

Exercise videos and thumbnails stored in R2 need a public URL so the frontend can display them directly.

1. In the bucket settings → **Settings** tab
2. Under **Public access** → click **Allow access**
3. Copy the **Public bucket URL** (looks like `https://pub-abc123def456.r2.dev`)
4. Paste it into `S3_PUBLIC_URL` in `.env`

### Verify R2 is Working

After updating `.env`, restart the API:

```bash
pm2 restart fitforce-api
```

Then try uploading a proof image or exercise thumbnail through the app and confirm it appears correctly.

---

## 16. Sentry Project Setup

### Create a Sentry Project

1. Go to [sentry.io](https://sentry.io) → sign up (free tier is enough)
2. Click **Create Project**
3. Select platform: **Node.js**
4. Name it: `fitforce-api`
5. On the next screen, copy the **DSN** (looks like `https://abc123@o123.ingest.sentry.io/456789`)
6. Paste it into `SENTRY_DSN` in your server `.env`

### Restart and Test

```bash
pm2 restart fitforce-api
```

Sentry starts capturing errors automatically. To test it's working, check your Sentry dashboard after the next server error occurs. You can also trigger a test from Sentry's onboarding page.

---

## 17. Firewall Rules

Lock down the server to only allow necessary traffic:

```bash
# Allow SSH (do this first or you'll lock yourself out)
sudo ufw allow OpenSSH

# Allow web traffic
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable the firewall
sudo ufw enable
# Type "y" when prompted

# Verify rules
sudo ufw status
```

Expected output:

```
Status: active

To                         Action      From
--                         ------      ----
OpenSSH                    ALLOW       Anywhere
80/tcp                     ALLOW       Anywhere
443/tcp                    ALLOW       Anywhere
```

> **Ports 3000 and 4000 are intentionally NOT open.** Both apps are accessed exclusively through Nginx, not directly from the internet.

### Configure fail2ban (Brute Force Protection)

```bash
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Verify it's monitoring SSH
sudo fail2ban-client status sshd
```

---

## 18. Verify Everything is Live

Run through this checklist in your browser:

```
[ ] https://yourdomain.com loads the app (HTTPS, no errors)
[ ] https://yourdomain.com/api/health returns {"message":"All is good!"}
[ ] Register a new coach account
[ ] Log in with that account
[ ] Create a workspace
[ ] Create a client
[ ] Log in to the client portal at https://yourdomain.com/client
[ ] Upload a proof image on a transaction — confirm it appears (served from R2)
[ ] Upload an exercise video — confirm it plays (served from R2 public URL)
[ ] Check Sentry dashboard — no unexpected errors
[ ] Check PM2: pm2 status shows both apps "online"
```

### Check Live Logs

```bash
# Watch real-time logs from both apps
pm2 logs

# Or separately:
pm2 logs fitforce-api
pm2 logs fitforce-web
```

---

## 19. How to Redeploy After Changes

Every time you push code changes, follow these steps on the server:

```bash
cd /home/fitforce/app

# 1. Pull latest code
git pull origin main

# 2. Install any new server dependencies
cd server && npm ci --omit=dev && cd ..

# 3. Run any new migrations
cd server && npm run migrate && cd ..

# 4. Install any new client dependencies
cd client && npm ci && cd ..

# 5. Rebuild Next.js (only if client code changed)
cd client && npm run build && cd ..

# 6. Restart the API (zero-downtime for Express)
pm2 restart fitforce-api

# 7. Restart the web app (only if client code changed)
pm2 restart fitforce-web

# 8. Confirm both are online
pm2 status
```

### Quick Redeploy Script

Save this as `/home/fitforce/deploy.sh` for one-command deploys:

```bash
nano /home/fitforce/deploy.sh
```

```bash
#!/bin/bash
set -e

APP_DIR="/home/fitforce/app"

echo "==> Pulling latest code..."
cd $APP_DIR && git pull origin main

echo "==> Installing server dependencies..."
cd $APP_DIR/server && npm ci --omit=dev

echo "==> Running migrations..."
npm run migrate

echo "==> Installing client dependencies..."
cd $APP_DIR/client && npm ci

echo "==> Building Next.js..."
npm run build

echo "==> Restarting apps..."
pm2 restart fitforce-api
pm2 restart fitforce-web

echo "==> Done. Status:"
pm2 status
```

Make it executable:

```bash
chmod +x /home/fitforce/deploy.sh
```

Deploy in one command going forward:

```bash
~/deploy.sh
```

---

## 20. Useful Commands Reference

### PM2

```bash
pm2 status                        # View running apps
pm2 logs                          # Live logs from all apps
pm2 logs fitforce-api --lines 100 # Last 100 lines from API
pm2 logs fitforce-web --lines 100 # Last 100 lines from web
pm2 restart fitforce-api          # Restart API
pm2 restart fitforce-web          # Restart Next.js
pm2 restart all                   # Restart everything
pm2 stop all                      # Stop everything
pm2 delete all                    # Remove from PM2 (then re-add)
pm2 monit                         # Real-time CPU/memory monitor
```

### Nginx

```bash
sudo nginx -t                     # Test config for syntax errors
sudo systemctl reload nginx       # Apply config changes (no downtime)
sudo systemctl restart nginx      # Full restart
sudo systemctl status nginx       # Check if nginx is running
sudo tail -f /var/log/nginx/error.log    # Nginx error log
sudo tail -f /var/log/nginx/access.log  # Nginx access log
```

### PostgreSQL

```bash
sudo systemctl status postgresql         # Check if DB is running
sudo -u postgres psql                    # Open psql as superuser
psql -U fitforce_user -d fitforce_db -h localhost  # Connect as app user

# Inside psql:
\dt                                      # List tables
\d clients                               # Describe a table
SELECT COUNT(*) FROM clients;            # Count rows
\q                                       # Exit
```

### SSL Certificates

```bash
sudo certbot renew --dry-run             # Test renewal
sudo certbot certificates                # Show cert info and expiry dates
```

### Server Health

```bash
free -h                                  # RAM usage
df -h                                    # Disk usage
htop                                     # CPU + memory (interactive, q to quit)
uptime                                   # How long server has been running
```

### Git

```bash
cd /home/fitforce/app
git log --oneline -10                    # Last 10 commits
git status                               # Check for local changes
git pull origin main                     # Pull latest
```

---

## Troubleshooting

### App Not Accessible After Deploy

```bash
# 1. Check PM2 status
pm2 status

# 2. If an app is "errored", check its logs
pm2 logs fitforce-api --lines 50

# 3. Check nginx is running and config is valid
sudo nginx -t
sudo systemctl status nginx

# 4. Check firewall
sudo ufw status
```

### 502 Bad Gateway from Nginx

This means nginx can't reach one of your apps. Check:

```bash
# Is the API running on port 4000?
ss -tlnp | grep 4000

# Is Next.js running on port 3000?
ss -tlnp | grep 3000

# Restart if needed
pm2 restart all
```

### Database Connection Error on Startup

```bash
# Is PostgreSQL running?
sudo systemctl status postgresql

# Can you connect manually?
psql -U fitforce_user -d fitforce_db -h localhost

# Check the DATABASE_URL in .env
cat /home/fitforce/app/server/.env | grep DATABASE_URL
```

### Migration Errors

```bash
cd /home/fitforce/app/server
npm run migrate

# If a migration fails, check which ones already ran:
psql -U fitforce_user -d fitforce_db -h localhost \
    -c "SELECT * FROM pgmigrations ORDER BY run_on;"
```

### SSL Certificate Issues

```bash
# Check certbot logs
sudo journalctl -u certbot

# Force renewal if expired
sudo certbot renew --force-renewal
sudo systemctl reload nginx
```

### Uploads Not Working (R2)

```bash
# Restart the API after any .env change
pm2 restart fitforce-api

# Check logs for S3 errors
pm2 logs fitforce-api --lines 100 | grep -i "s3\|r2\|storage"
```

---

## Security Checklist (Before Going Public)

```
[ ] Root SSH login is disabled (PermitRootLogin no)
[ ] Password SSH login is disabled (PasswordAuthentication no)
[ ] Firewall is active (ufw status shows active)
[ ] fail2ban is running (sudo fail2ban-client status)
[ ] .env file has chmod 600
[ ] JWT_SECRET and ADMIN_JWT_SECRET are randomly generated (not guessable)
[ ] ADMIN_JWT_SECRET is NOT the demo jwt.io value
[ ] NODE_ENV=production in server .env
[ ] HTTPS is working and HTTP redirects to HTTPS
[ ] Sentry DSN is set and receiving events
[ ] R2 bucket credentials are scoped to fitforce-uploads only
[ ] Ports 3000 and 4000 are NOT exposed to internet (only Nginx is)
```
