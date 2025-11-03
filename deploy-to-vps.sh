#!/bin/bash
# Deployment script for VPS
# Run this on your VPS at: ~/fasting-tracker/

echo "🔄 Pulling latest changes from GitHub..."
git pull origin main

echo "🛑 Stopping containers..."
docker compose down

echo "🔨 Rebuilding containers..."
docker compose up -d --build

echo "⏳ Waiting for containers to start..."
sleep 5

echo "📊 Container status:"
docker compose ps

echo "📝 Recent logs:"
docker compose logs --tail=50 fasting_app

echo "✅ Deployment complete!"
echo "To view live logs: docker compose logs -f fasting_app"
