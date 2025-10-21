#!/bin/sh
# Simple entrypoint to attempt time sync and then start the Node server.
set -e

echo "[entrypoint] Attempting to sync time (best effort)..."

# Try to use ntpd if available, otherwise try busybox ntpd, otherwise fallback to date from NTP pool
if command -v ntpd >/dev/null 2>&1; then
  echo "[entrypoint] running ntpd -q (will exit after setting time)"
  ntpd -q || true
elif command -v busybox >/dev/null 2>&1 && busybox --list | grep -q ntpd; then
  echo "[entrypoint] running busybox ntpd -n -q"
  busybox ntpd -n -q || true
else
  echo "[entrypoint] ntpd not available; attempting simple sntp sync"
  if command -v sntp >/dev/null 2>&1; then
    sntp -s time.google.com || true
  else
    echo "[entrypoint] no ntp tool available; proceeding without explicit sync"
  fi
fi

echo "[entrypoint] Starting server process"
exec "$@"
