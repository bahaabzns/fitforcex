#!/bin/bash

# Dokku deployment script for seed app
# Usage: ./deploy-dokku.sh [app-name]

APP_NAME=${1:-fitforce-seed}
DOKKU_HOST=${DOKKU_HOST:-captinmaged.nano.com}

echo "🚀 Deploying seed app to Dokku..."
echo "App name: $APP_NAME"
echo "Host: $DOKKU_HOST"

# Check if dokku command exists
if ! command -v dokku &> /dev/null; then
    echo "❌ Dokku CLI not found. Please install it first."
    echo "Run: curl -sSL https://raw.githubusercontent.com/dokku/dokku/v0.34.5/bootstrap.sh | sudo bash"
    exit 1
fi

# Create app if it doesn't exist
echo "📱 Creating/checking Dokku app..."
dokku apps:create $APP_NAME 2>/dev/null || echo "App already exists"

# Set environment variables
echo "🔧 Setting environment variables..."
dokku config:set $APP_NAME NODE_ENV=production
dokku config:set $APP_NAME PORT=3000
dokku config:set $APP_NAME NEXT_PUBLIC_API_URL=https://api.fitforce.io
dokku config:set $APP_NAME NEXT_PUBLIC_FRONTEND_DOMAIN=fitforce.io
dokku config:set $APP_NAME NEXT_PUBLIC_MAIN_DOMAIN=https://fitforce.io
dokku config:set $APP_NAME NEXT_PUBLIC_MANAGEMENT_SUBDOMAIN=admin
dokku config:set $APP_NAME NEXT_PUBLIC_DEFAULT_THEME=light
dokku config:set $APP_NAME NEXT_PUBLIC_DEFAULT_LANG=en
dokku config:set $APP_NAME NEXTAUTH_URL=https://fitforce.io
dokku config:set $APP_NAME NEXTAUTH_SECRET=$(openssl rand -base64 32)

# Add git remote if it doesn't exist
echo "🔗 Adding git remote..."
git remote remove dokku 2>/dev/null || true
git remote add dokku dokku@$DOKKU_HOST:$APP_NAME

# Deploy
echo "🚀 Deploying to Dokku..."
git push dokku main:master

# Set domain
echo "🌐 Setting domain..."
dokku domains:set $APP_NAME fitforce.io

# Enable nginx
echo "🔧 Enabling nginx..."
dokku nginx:enable $APP_NAME

# Set nginx configuration
echo "⚙️ Configuring nginx..."
dokku nginx:set $APP_NAME client-max-body-size 50m

echo "✅ Deployment complete!"
echo "🌐 App URL: https://fitforce.io"
echo "📊 Check logs: dokku logs $APP_NAME -t"
