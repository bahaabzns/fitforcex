# Dokku Deployment Guide for Seed App

This guide explains how to deploy the seed app to Dokku.

## Prerequisites

1. **Dokku server** with the following plugins installed:
   - `dokku-nginx` (for reverse proxy)
   - `dokku-domains` (for domain management)

2. **Dokku CLI** installed on your local machine:
   ```bash
   curl -sSL https://raw.githubusercontent.com/dokku/dokku/v0.34.5/bootstrap.sh | sudo bash
   ```

3. **SSH access** to your Dokku server

## Quick Deployment

### Option 1: Using the deployment script

```bash
cd /home/codet/projects/fitForce-v3/seed
./deploy-dokku.sh [app-name]
```

Replace `[app-name]` with your desired app name (default: `fitforce-seed`).

### Option 2: Manual deployment

1. **Create the Dokku app:**
   ```bash
   dokku apps:create fitforce-seed
   ```

2. **Set environment variables:**
   ```bash
   dokku config:set fitforce-seed NODE_ENV=production
   dokku config:set fitforce-seed PORT=3000
   dokku config:set fitforce-seed NEXT_PUBLIC_API_URL=https://api.nano.com
   dokku config:set fitforce-seed NEXTAUTH_URL=https://captinmaged.nano.com
   dokku config:set fitforce-seed NEXTAUTH_SECRET=$(openssl rand -base64 32)
   ```

3. **Add git remote:**
   ```bash
   git remote add dokku dokku@captinmaged.nano.com:fitforce-seed
   ```

4. **Deploy:**
   ```bash
   git push dokku main:master
   ```

5. **Configure domain:**
   ```bash
   dokku domains:set fitforce-seed captinmaged.nano.com
   ```

6. **Enable nginx:**
   ```bash
   dokku nginx:enable fitforce-seed
   dokku nginx:set fitforce-seed client-max-body-size 50m
   ```

## Docker Configuration

The app includes multiple Docker configurations:

- **`Dockerfile`** - Standard Docker build for development/testing
- **`Dockerfile.dokku`** - Optimized for Dokku deployment with standalone output
- **`docker-compose.yml`** - For local development with Docker Compose

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Node environment | `production` |
| `PORT` | Application port | `3000` |
| `NEXT_PUBLIC_API_URL` | Backend API URL | `https://api.nano.com` |
| `NEXTAUTH_URL` | NextAuth URL | `https://captinmaged.nano.com` |
| `NEXTAUTH_SECRET` | NextAuth secret | Generated randomly |

## Post-Deployment

1. **Check logs:**
   ```bash
   dokku logs fitforce-seed -t
   ```

2. **Check app status:**
   ```bash
   dokku ps:report fitforce-seed
   ```

3. **Access the app:**
   - URL: `https://captinmaged.nano.com`

## Troubleshooting

### Common Issues

1. **Build fails:**
   - Check if all dependencies are properly installed
   - Verify Node.js version compatibility (requires Node 20+)

2. **App won't start:**
   - Check environment variables
   - Verify port configuration
   - Check logs for errors

3. **Domain not working:**
   - Ensure DNS is pointing to your Dokku server
   - Check nginx configuration: `dokku nginx:report fitforce-seed`

### Useful Commands

```bash
# View app logs
dokku logs fitforce-seed -t

# Restart app
dokku ps:restart fitforce-seed

# Check app status
dokku ps:report fitforce-seed

# View environment variables
dokku config fitforce-seed

# Access app shell
dokku enter fitforce-seed

# Check nginx status
dokku nginx:report fitforce-seed
```

## Scaling

To scale the app:

```bash
dokku ps:scale fitforce-seed web=2
```

## SSL/HTTPS

If you have SSL certificates:

```bash
dokku certs:add fitforce-seed /path/to/cert.pem /path/to/key.pem
```

Or use Let's Encrypt:

```bash
dokku letsencrypt:enable fitforce-seed
```

## Backup

To backup the app configuration:

```bash
dokku config:export fitforce-seed > fitforce-seed.env
```

## Updates

To update the app:

```bash
git push dokku main:master
```

The app will automatically rebuild and restart.
