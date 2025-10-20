#!/bin/bash
# Quick Redeployment Script for Fasting Tracker
# Run this on your Hetzner VPS to deploy updated code

set -e  # Exit on any error

echo "🚀 Fasting Tracker - Full Redeployment"
echo "========================================"

# Change to project directory (update this path!)
PROJECT_DIR="/path/to/WEB-fasting-tracker"
cd "$PROJECT_DIR" || exit 1

echo "📁 Working directory: $(pwd)"
echo ""

# Step 1: Stop running containers
echo "⏹️  Step 1/5: Stopping containers..."
docker compose down
echo "✅ Containers stopped"
echo ""

# Step 2: Remove old image to force complete rebuild
echo "🗑️  Step 2/5: Removing old image..."
docker rmi fasting-tracker:latest 2>/dev/null || echo "   (No old image to remove)"
echo "✅ Old image removed"
echo ""

# Step 3: Build new image with no cache
echo "🔨 Step 3/5: Building fresh image (this may take 2-3 minutes)..."
docker compose build --no-cache
echo "✅ Image built successfully"
echo ""

# Step 4: Start containers with environment file
echo "▶️  Step 4/5: Starting containers..."
if [ -f ".env.deploy" ]; then
    docker compose --env-file .env.deploy up -d
else
    echo "⚠️  Warning: .env.deploy not found, using system environment"
    docker compose up -d
fi
echo "✅ Containers started"
echo ""

# Step 5: Verify deployment
echo "🔍 Step 5/5: Verifying deployment..."
sleep 3

# Check container status
echo "   Container status:"
docker compose ps

echo ""
echo "   Recent logs (last 20 lines):"
docker compose logs --tail=20 fasting_app

echo ""
echo "============================================"
echo "🎉 Redeployment Complete!"
echo "============================================"
echo ""
echo "✅ Next steps:"
echo "   1. Open: https://fasting.davorinpiljic.com"
echo "   2. Hard refresh browser: Ctrl+Shift+R"
echo "   3. Open DevTools (F12) → Network tab"
echo "   4. Login and click 'Start Fast'"
echo "   5. Verify: POST /api/active-fast appears in Network tab"
echo ""
echo "📋 Useful commands:"
echo "   View logs:       docker compose logs -f fasting_app"
echo "   Check status:    docker compose ps"
echo "   Stop:            docker compose down"
echo "   Restart:         docker compose restart"
echo ""
