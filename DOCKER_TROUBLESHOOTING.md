# Docker Deployment Troubleshooting Guide
## Problem: Frontend Changes Not Appearing in Production

### Root Cause Identified
The original `Dockerfile.server` was **copying pre-built frontend files from the host**, not building them inside Docker. This meant:
- ❌ Frontend changes required manual rebuild on host before `docker compose build`
- ❌ No guarantee the correct frontend version was in the image
- ❌ Easy to forget to rebuild frontend before deploying

### Solution Applied
Updated `Dockerfile.server` to use **multi-stage build** that:
- ✅ Builds frontend inside Docker (Stage 1: client-builder)
- ✅ Builds server inside Docker (Stage 2: server-builder)
- ✅ Combines both in final image (Stage 3: runner)
- ✅ Guarantees correct frontend version every time

---

## Deployment Commands (Run these on your VPS)

### 1. Stop Current Container
```bash
cd /path/to/WEB-fasting-tracker
docker compose down
```

### 2. Force Complete Rebuild (No Cache)
```bash
# Build with --no-cache to ensure fresh build
docker compose build --no-cache

# Alternative: Remove old image first, then build
docker rmi fasting-tracker:latest
docker compose build
```

### 3. Start with Updated Image
```bash
# Start in detached mode
docker compose --env-file .env.deploy up -d

# Or rebuild and start in one command
docker compose --env-file .env.deploy up -d --build --force-recreate
```

### 4. Verify Deployment
```bash
# Check container is running
docker compose ps

# View logs
docker compose logs -f fasting_app
```

---

## Verification Steps

### Step 1: Verify Frontend Files in Container
```bash
# Exec into running container
docker compose exec fasting_app sh

# Inside container, check if frontend build exists
ls -la /usr/src/app/client/dist/

# Should see:
# - index.html
# - assets/ (folder with JS/CSS bundles)
# - vite.svg

# Check a specific file to verify it's the new version
cat /usr/src/app/client/dist/index.html

# Exit container
exit
```

### Step 2: Verify Server is Serving Static Files
```bash
# Check server logs for static file serving
docker compose logs fasting_app | grep "static"

# Test from inside VPS (should return HTML)
curl http://localhost:8080/

# Test from outside (should return HTML via Caddy)
curl https://fasting.davorinpiljic.com/
```

### Step 3: Verify API Calls Work
```bash
# Watch Caddy logs for API calls
docker logs caddy -f

# In another terminal, test API endpoint
curl -X GET https://fasting.davorinpiljic.com/api/health

# Expected: {"status":"ok","uptime":...}
```

### Step 4: Test in Browser DevTools
1. Open browser to `https://fasting.davorinpiljic.com`
2. Open DevTools (F12) → Network tab
3. Clear cache: DevTools → Network → Disable cache (checkbox)
4. Hard refresh: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
5. Click "Start Fast"
6. **Expected in Network tab:** `POST https://fasting.davorinpiljic.com/api/active-fast`

---

## Complete Redeployment Script

Save this as `redeploy.sh` on your VPS:

```bash
#!/bin/bash
set -e

echo "🚀 Starting full redeployment..."

# Navigate to project directory
cd /path/to/WEB-fasting-tracker

# Stop containers
echo "⏹️  Stopping containers..."
docker compose down

# Remove old image to force rebuild
echo "🗑️  Removing old image..."
docker rmi fasting-tracker:latest || true

# Build fresh image (no cache)
echo "🔨 Building new image..."
docker compose build --no-cache

# Start containers
echo "▶️  Starting containers..."
docker compose --env-file .env.deploy up -d

# Wait for container to be healthy
echo "⏳ Waiting for container to start..."
sleep 5

# Check status
echo "✅ Container status:"
docker compose ps

# Show recent logs
echo "📋 Recent logs:"
docker compose logs --tail=50 fasting_app

echo "🎉 Redeployment complete!"
echo "🔍 Verify at: https://fasting.davorinpiljic.com"
```

Make executable and run:
```bash
chmod +x redeploy.sh
./redeploy.sh
```

---

## Troubleshooting Common Issues

### Issue: "Cannot find module" errors in logs
**Cause:** Server dependencies not installed
**Fix:**
```bash
docker compose build --no-cache
```

### Issue: 404 errors for static files
**Cause:** Frontend not copied into image
**Fix:** Verify with:
```bash
docker compose exec fasting_app ls -la /usr/src/app/client/dist/
```
If empty, rebuild image.

### Issue: Old frontend code still showing
**Cause:** Browser cache
**Fix:**
1. Hard refresh: `Ctrl+Shift+R`
2. Clear browser cache
3. Open DevTools → Network → Disable cache
4. Verify in Network tab that new JS bundle is loaded

### Issue: API calls return 401 Unauthorized
**Cause:** JWT token expired or not set
**Fix:**
1. Logout and login again
2. Check localStorage in DevTools → Application → Local Storage
3. Should see `token` key with JWT value

### Issue: CORS errors in browser console
**Cause:** CORS configuration in server
**Fix:** Verify `server/.env` has:
```
NODE_ENV=production
```
And `server/server.js` CORS config allows `https://fasting.davorinpiljic.com`

---

## Health Check Commands

```bash
# Check container health
docker compose ps

# Check server is responding
curl http://localhost:8080/api/health

# Check via Caddy (external)
curl https://fasting.davorinpiljic.com/api/health

# Check MongoDB connection
docker compose logs fasting_app | grep -i mongo

# Check for errors
docker compose logs fasting_app | grep -i error
```

---

## Expected Results After Redeployment

✅ Container `fasting_app` is running
✅ `/usr/src/app/client/dist/` contains HTML and assets
✅ `curl http://localhost:8080/` returns HTML
✅ `curl https://fasting.davorinpiljic.com/` returns HTML via Caddy
✅ Browser DevTools shows: `POST /api/active-fast` when "Start Fast" clicked
✅ Caddy logs show: `POST /api/active-fast` requests
✅ Fast persists across devices after login

---

## Quick Verification Checklist

Run these commands in order:

```bash
# 1. Container running?
docker compose ps | grep fasting_app

# 2. Frontend files exist?
docker compose exec fasting_app ls /usr/src/app/client/dist/index.html

# 3. Server responding?
curl -s http://localhost:8080/api/health | jq

# 4. External access works?
curl -s https://fasting.davorinpiljic.com/api/health | jq

# 5. Check recent logs for errors
docker compose logs --tail=100 fasting_app | grep -i error
```

All commands should succeed with no errors.
