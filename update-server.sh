#!/bin/bash
# ============================================================
# Tour CRM — обновление на сервере (запускать НА сервере)
# Использование: bash update-server.sh
# ============================================================

set -e

APP_DIR="/var/www/tour-crm"
PM2_NAME="tour-crm"

echo "=== Tour CRM Update ==="
echo "Dir: $APP_DIR"
echo ""

cd "$APP_DIR"

echo "1. Pulling latest changes..."
git pull origin main

echo ""
echo "2. Applying DB migration (migrate_003)..."
# Edit DB credentials below if needed
PGPASSWORD="${DB_PASSWORD:-348004}" psql -h localhost -U tour_user -d tour_crm \
  -f database/migrate_003.sql 2>&1 | grep -v "^$" || true

echo ""
echo "3. Building frontend..."
cd frontend
npm install --silent
npm run build
cd ..

echo ""
echo "4. Installing backend dependencies..."
cd backend
npm install --silent
cd ..

echo ""
echo "5. Copying frontend dist to web root..."
# Nginx serves from /var/www/tour-crm/frontend/dist (already configured)

echo ""
echo "6. Restarting PM2..."
pm2 restart "$PM2_NAME" || pm2 start backend/dist/index.js --name "$PM2_NAME"
pm2 save

echo ""
echo "=== Done! ==="
pm2 status "$PM2_NAME"
echo ""
echo "Run check.js to verify:"
echo "  node check.js http://147.45.146.161 admin YOUR_PASSWORD"
