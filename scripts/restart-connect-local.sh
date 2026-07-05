#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REFERENCE_DIR="$ROOT_DIR/docs/reference/connect-prototype"
API_DIR="$REFERENCE_DIR/local-trigger-server"
LOG_DIR="$ROOT_DIR/.logs/connect-local"

NEXT_PORT="${NEXT_PORT:-3000}"
CONNECT_RECEIVER_DEV_PORT="${CONNECT_RECEIVER_DEV_PORT:-3002}"
CONNECT_HTTPS_PORT="${CONNECT_HTTPS_PORT:-3001}"
CONNECT_API_PORT="${CONNECT_API_PORT:-8790}"
CONNECT_STATIC_PORT="${CONNECT_STATIC_PORT:-4174}"
WITH_RECEIVER_DEV="${WITH_RECEIVER_DEV:-0}"
WITH_HTTPS="${WITH_HTTPS:-1}"
WITH_CONNECT_API="${WITH_CONNECT_API:-1}"
WITH_STATIC="${WITH_STATIC:-1}"
NEXT_APP_MODE="${NEXT_APP_MODE:-dev}"
LAN_HOST="${CONNECT_LAN_HOST:-}"
SETUP_NETWORK_MODE="${SETUP_NETWORK_MODE:-0}"
PUBLIC_INSTALL_URL="${CONNECT_RECEIVER_PUBLIC_INSTALL_URL:-}"
STOP_ONLY=0

for arg in "$@"; do
  case "$arg" in
    --stop)
      STOP_ONLY=1
      WITH_RECEIVER_DEV=1
      WITH_HTTPS=1
      WITH_CONNECT_API=1
      WITH_STATIC=1
      ;;
    --production-next)
      NEXT_APP_MODE=production
      ;;
    --setup-network|--hotspot-install)
      NEXT_APP_MODE=production
      WITH_HTTPS=0
      WITH_CONNECT_API=0
      WITH_STATIC=0
      SETUP_NETWORK_MODE=1
      ;;
    --public-install-url=*|--ngrok-url=*)
      NEXT_APP_MODE=production
      WITH_HTTPS=0
      WITH_CONNECT_API=0
      WITH_STATIC=0
      SETUP_NETWORK_MODE=1
      PUBLIC_INSTALL_URL="${arg#*=}"
      PUBLIC_INSTALL_URL="${PUBLIC_INSTALL_URL%/}"
      ;;
    --dev-next)
      NEXT_APP_MODE=dev
      ;;
    --no-https)
      WITH_HTTPS=0
      ;;
    --no-receiver-dev)
      WITH_RECEIVER_DEV=0
      ;;
    --no-api)
      WITH_CONNECT_API=0
      ;;
    --no-static)
      WITH_STATIC=0
      ;;
    -h|--help)
      cat <<HELP
Restart CarePland Connect local development servers.

Default:
  - CarePland Next app on port $NEXT_PORT
  - CarePland Receiver setup/APK routes on the CarePland Next app
  - CarePland HTTPS bridge on port $CONNECT_HTTPS_PORT
  - Connect prototype API/local-trigger server on port $CONNECT_API_PORT
  - Connect static reference UI on port $CONNECT_STATIC_PORT

Usage:
  scripts/restart-connect-local.sh
  scripts/restart-connect-local.sh --stop
  scripts/restart-connect-local.sh --production-next
  scripts/restart-connect-local.sh --setup-network
  scripts/restart-connect-local.sh --ngrok-url=https://example.ngrok-free.app
  scripts/restart-connect-local.sh --dev-next
  scripts/restart-connect-local.sh --no-https
  scripts/restart-connect-local.sh --no-receiver-dev
  scripts/restart-connect-local.sh --no-api
  scripts/restart-connect-local.sh --no-static

Environment overrides:
  NEXT_APP_MODE=dev|production NEXT_PORT=3000 CONNECT_RECEIVER_DEV_PORT=3002 CONNECT_HTTPS_PORT=3001 CONNECT_API_PORT=8790 CONNECT_STATIC_PORT=4174 WITH_RECEIVER_DEV=0 WITH_HTTPS=1 WITH_CONNECT_API=1 WITH_STATIC=1 SETUP_NETWORK_MODE=0 CONNECT_LAN_HOST=192.168.1.10 CONNECT_RECEIVER_PUBLIC_INSTALL_URL=https://example.ngrok-free.app

Setup network mode:
  --setup-network is for iPhone hotspot, travel-router, or mini-router installs.
  It starts only the production Receiver setup/APK server on the LAN and prints
  the URL the Android Receiver device should open. Use this only on a network
  you control, then stop the server when install/provisioning is complete.
  Use --ngrok-url or CONNECT_RECEIVER_PUBLIC_INSTALL_URL when the Android
  device should download through a public tunnel instead of a LAN URL.

Stop mode:
  --stop stops the known CarePland local Connect/setup servers without starting
  them again.
HELP
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 2
      ;;
  esac
done

mkdir -p "$LOG_DIR"

detect_lan_host() {
  if [[ -n "$LAN_HOST" ]]; then
    echo "$LAN_HOST"
    return
  fi

  local detected
  detected="$(ipconfig getifaddr en0 2>/dev/null || true)"
  if [[ -z "$detected" ]]; then
    detected="$(ipconfig getifaddr en1 2>/dev/null || true)"
  fi
  if [[ -z "$detected" ]]; then
    detected="$(ifconfig 2>/dev/null | awk '/inet / && $2 !~ /^127\./ { print $2; exit }' || true)"
  fi

  echo "$detected"
}

LAN_HOST="$(detect_lan_host)"
MAIN_RECEIVER_BASE_URL="${CONNECT_RECEIVER_SETUP_BASE_URL:-}"
MAIN_RECEIVER_APK_URL="${CONNECT_RECEIVER_APK_URL:-}"
RECEIVER_DEV_BASE_URL=""
RECEIVER_DEV_APK_URL=""
if [[ -n "$PUBLIC_INSTALL_URL" ]]; then
  PUBLIC_INSTALL_URL="${PUBLIC_INSTALL_URL%/}"
  MAIN_RECEIVER_BASE_URL="${MAIN_RECEIVER_BASE_URL:-$PUBLIC_INSTALL_URL}"
  MAIN_RECEIVER_APK_URL="${MAIN_RECEIVER_APK_URL:-$PUBLIC_INSTALL_URL/api/connect/receiver-shell/apk/debug}"
fi
if [[ -n "$LAN_HOST" ]]; then
  MAIN_RECEIVER_BASE_URL="${MAIN_RECEIVER_BASE_URL:-http://$LAN_HOST:$NEXT_PORT}"
  MAIN_RECEIVER_APK_URL="${MAIN_RECEIVER_APK_URL:-http://$LAN_HOST:$NEXT_PORT/api/connect/receiver-shell/apk/debug}"
  RECEIVER_DEV_BASE_URL="${CONNECT_RECEIVER_SETUP_BASE_URL:-http://$LAN_HOST:$CONNECT_RECEIVER_DEV_PORT}"
  RECEIVER_DEV_APK_URL="${CONNECT_RECEIVER_APK_URL:-http://$LAN_HOST:$CONNECT_RECEIVER_DEV_PORT/api/connect/receiver-shell/apk/debug}"
fi
DEBUG_APK_ENABLED="${CONNECT_RECEIVER_DEBUG_APK_ENABLED:-0}"
if [[ "$MAIN_RECEIVER_APK_URL" == *"/api/connect/receiver-shell/apk/debug"* ]]; then
  DEBUG_APK_ENABLED=1
fi

stop_port() {
  local port="$1"
  local label="$2"
  local pids
  pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -z "$pids" ]]; then
    echo "No $label listener on port $port."
    return
  fi

  echo "Stopping $label on port $port: $pids"
  kill $pids 2>/dev/null || true
  sleep 1

  local stubborn
  stubborn="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$stubborn" ]]; then
    echo "Force stopping $label on port $port: $stubborn"
    kill -9 $stubborn 2>/dev/null || true
  fi
}

port_is_busy() {
  local port="$1"
  lsof -tiTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
}

start_next_app() {
  if port_is_busy "$NEXT_PORT"; then
    echo "CarePland Next app is still listening on port $NEXT_PORT; restarting it before launch."
    stop_port "$NEXT_PORT" "CarePland Next app"
  fi
  if port_is_busy "$NEXT_PORT"; then
    echo "Unable to free port $NEXT_PORT for the CarePland Next app." >&2
    return 1
  fi
  echo "Starting CarePland Next app on http://localhost:$NEXT_PORT ($NEXT_APP_MODE)"
  (
    cd "$ROOT_DIR"
    if [[ "$NEXT_APP_MODE" == "production" ]]; then
      nohup env \
        CONNECT_LAN_HOST="$LAN_HOST" \
        CONNECT_RECEIVER_SETUP_BASE_URL="$MAIN_RECEIVER_BASE_URL" \
        CONNECT_RECEIVER_APK_URL="$MAIN_RECEIVER_APK_URL" \
        CONNECT_RECEIVER_DEBUG_APK_ENABLED="$DEBUG_APK_ENABLED" \
        npm start -- --hostname 0.0.0.0 --port "$NEXT_PORT" < /dev/null > "$LOG_DIR/next-app.log" 2>&1 &
    else
      nohup env \
        CONNECT_LAN_HOST="$LAN_HOST" \
        CONNECT_RECEIVER_SETUP_BASE_URL="$MAIN_RECEIVER_BASE_URL" \
        CONNECT_RECEIVER_APK_URL="$MAIN_RECEIVER_APK_URL" \
        CONNECT_RECEIVER_DEBUG_APK_ENABLED="$DEBUG_APK_ENABLED" \
        npm run dev -- --hostname 0.0.0.0 --port "$NEXT_PORT" < /dev/null > "$LOG_DIR/next-app.log" 2>&1 &
    fi
    echo $! > "$LOG_DIR/next-app.pid"
  )
}

start_receiver_dev_app() {
  if [[ "$WITH_RECEIVER_DEV" -ne 1 ]]; then
    return
  fi
  if [[ "$CONNECT_RECEIVER_DEV_PORT" == "$NEXT_PORT" ]]; then
    echo "Receiver/APK dev port matches NEXT_PORT; using the main Next app only."
    return
  fi
  if port_is_busy "$CONNECT_RECEIVER_DEV_PORT"; then
    echo "CarePland Receiver/APK dev app is already listening on port $CONNECT_RECEIVER_DEV_PORT; leaving it in place."
    return
  fi

  echo "Starting optional CarePland Receiver/APK dev app on http://localhost:$CONNECT_RECEIVER_DEV_PORT"
  (
    cd "$ROOT_DIR"
    nohup env \
      CONNECT_LAN_HOST="$LAN_HOST" \
      CONNECT_RECEIVER_SETUP_BASE_URL="$RECEIVER_DEV_BASE_URL" \
      CONNECT_RECEIVER_APK_URL="$RECEIVER_DEV_APK_URL" \
      CONNECT_RECEIVER_DEBUG_APK_ENABLED=1 \
      npm run dev -- --hostname 0.0.0.0 --port "$CONNECT_RECEIVER_DEV_PORT" < /dev/null > "$LOG_DIR/receiver-dev-app.log" 2>&1 &
    echo $! > "$LOG_DIR/receiver-dev-app.pid"
  )
}

start_https_bridge() {
  if [[ "$WITH_HTTPS" -ne 1 ]]; then
    return
  fi
  if port_is_busy "$CONNECT_HTTPS_PORT"; then
    echo "CarePland HTTPS bridge is already listening on port $CONNECT_HTTPS_PORT; leaving it in place."
    return
  fi

  echo "Starting CarePland HTTPS bridge on https://localhost:$CONNECT_HTTPS_PORT"
  (
    cd "$ROOT_DIR"
    nohup env \
      CONNECT_HTTPS_PORT="$CONNECT_HTTPS_PORT" \
      CONNECT_HTTPS_TARGET_PORT="$NEXT_PORT" \
      npm run dev:connect-https < /dev/null > "$LOG_DIR/connect-https.log" 2>&1 &
    echo $! > "$LOG_DIR/connect-https.pid"
  )
}

start_connect_api() {
  if port_is_busy "$CONNECT_API_PORT"; then
    echo "Connect API is already listening on port $CONNECT_API_PORT; leaving it in place."
    return
  fi
  if [[ ! -d "$API_DIR" ]]; then
    echo "Connect API directory not found: $API_DIR" >&2
    return 1
  fi

  echo "Starting Connect API on http://localhost:$CONNECT_API_PORT"
  (
    cd "$API_DIR"
    nohup env PORT="$CONNECT_API_PORT" npm start < /dev/null > "$LOG_DIR/connect-api.log" 2>&1 &
    echo $! > "$LOG_DIR/connect-api.pid"
  )
}

start_static_reference() {
  if [[ "$WITH_STATIC" -ne 1 ]]; then
    return
  fi
  if port_is_busy "$CONNECT_STATIC_PORT"; then
    echo "Connect static reference UI is already listening on port $CONNECT_STATIC_PORT; leaving it in place."
    return
  fi
  if [[ ! -d "$REFERENCE_DIR" ]]; then
    echo "Connect static reference directory not found: $REFERENCE_DIR" >&2
    return 1
  fi

  echo "Starting Connect static reference UI on http://localhost:$CONNECT_STATIC_PORT"
  (
    cd "$REFERENCE_DIR"
    nohup python3 -m http.server "$CONNECT_STATIC_PORT" < /dev/null > "$LOG_DIR/connect-static.log" 2>&1 &
    echo $! > "$LOG_DIR/connect-static.pid"
  )
}

stop_port "$NEXT_PORT" "CarePland Next app"
if [[ "$WITH_RECEIVER_DEV" -eq 1 && "$CONNECT_RECEIVER_DEV_PORT" != "$NEXT_PORT" ]]; then
  stop_port "$CONNECT_RECEIVER_DEV_PORT" "CarePland Receiver/APK dev app"
fi
if [[ "$WITH_HTTPS" -eq 1 ]]; then
  stop_port "$CONNECT_HTTPS_PORT" "CarePland HTTPS bridge"
fi
if [[ "$WITH_CONNECT_API" -eq 1 ]]; then
  stop_port "$CONNECT_API_PORT" "Connect API"
fi
if [[ "$WITH_STATIC" -eq 1 ]]; then
  stop_port "$CONNECT_STATIC_PORT" "Connect static reference UI"
fi

if [[ "$STOP_ONLY" -eq 1 ]]; then
  echo
  echo "CarePland local Connect/setup servers stopped."
  exit 0
fi

start_next_app
start_receiver_dev_app
start_https_bridge
if [[ "$WITH_CONNECT_API" -eq 1 ]]; then
  start_connect_api
fi
start_static_reference

sleep 2

echo
echo "Restart complete."
echo "CarePland Next mode:     $NEXT_APP_MODE"
if [[ "$NEXT_APP_MODE" == "production" ]]; then
  echo "Production mode serves the last built app. Use --dev-next to see local code changes immediately."
fi
if [[ "$SETUP_NETWORK_MODE" -eq 1 ]]; then
  echo
  echo "CarePland Setup Network mode"
  if [[ -n "$PUBLIC_INSTALL_URL" ]]; then
    echo "1. Keep this Mac awake and keep the public tunnel running."
    echo "2. Open this on the Receiver device: $PUBLIC_INSTALL_URL/r"
    echo "3. Install/provision the APK, then stop these local servers and the tunnel when done."
    echo "Public APK download:    $PUBLIC_INSTALL_URL/api/connect/receiver-shell/apk/debug"
  else
    echo "1. Put this Mac and the Receiver device on the same private hotspot/router."
    if [[ -n "$LAN_HOST" ]]; then
      echo "2. Open this on the Receiver device: http://$LAN_HOST:$NEXT_PORT/r"
    else
      echo "2. Open the LAN Receiver setup URL on the Receiver device. Set CONNECT_LAN_HOST if no LAN URL printed."
    fi
    echo "3. Install/provision the APK, then stop these local servers when done."
    echo "Use an iPhone hotspot or dedicated travel router; avoid hotel/public WiFi."
  fi
  echo "Debug APK route:        enabled"
  echo "Stop command: scripts/restart-connect-local.sh --stop"
  echo
fi
echo "CarePland Connect:       http://localhost:$NEXT_PORT/connect"
echo "CarePland Receiver:      http://localhost:$NEXT_PORT/connect/receiver"
echo "Receiver setup page:     http://localhost:$NEXT_PORT/connect/receiver/setup?code=12345"
if [[ -n "$PUBLIC_INSTALL_URL" ]]; then
  echo "Public short setup:      $PUBLIC_INSTALL_URL/r"
  echo "Public Receiver setup:   $PUBLIC_INSTALL_URL/connect/receiver/setup?code=12345"
  echo "Public APK download:     $PUBLIC_INSTALL_URL/api/connect/receiver-shell/apk/debug"
fi
if [[ -n "$LAN_HOST" ]]; then
  echo "LAN short setup:         http://$LAN_HOST:$NEXT_PORT/r"
  echo "LAN Receiver setup:      http://$LAN_HOST:$NEXT_PORT/connect/receiver/setup?code=12345"
  echo "LAN APK download:        http://$LAN_HOST:$NEXT_PORT/api/connect/receiver-shell/apk/debug"
fi
if [[ "$WITH_RECEIVER_DEV" -eq 1 && "$CONNECT_RECEIVER_DEV_PORT" != "$NEXT_PORT" ]]; then
  echo "Optional Receiver app:   http://localhost:$CONNECT_RECEIVER_DEV_PORT/connect/receiver"
  echo "Optional setup page:     http://localhost:$CONNECT_RECEIVER_DEV_PORT/connect/receiver/setup?code=12345"
  if [[ -n "$LAN_HOST" ]]; then
    echo "LAN Receiver setup:      http://$LAN_HOST:$CONNECT_RECEIVER_DEV_PORT/connect/receiver/setup?code=12345"
    echo "LAN APK download:        http://$LAN_HOST:$CONNECT_RECEIVER_DEV_PORT/api/connect/receiver-shell/apk/debug"
  fi
fi
if [[ "$WITH_HTTPS" -eq 1 ]]; then
  echo "Connect HTTPS bridge:    https://localhost:$CONNECT_HTTPS_PORT/connect"
  echo "HTTPS Receiver:          https://localhost:$CONNECT_HTTPS_PORT/connect/receiver"
fi
if [[ "$WITH_CONNECT_API" -eq 1 ]]; then
  echo "Connect API:             http://localhost:$CONNECT_API_PORT"
else
  echo "Connect API:             not started"
fi
if [[ "$WITH_STATIC" -eq 1 ]]; then
  echo "Static reference UI:     http://localhost:$CONNECT_STATIC_PORT/index.html"
  echo "Static web receiver:     http://localhost:$CONNECT_STATIC_PORT/web-receiver.html"
elif [[ "$SETUP_NETWORK_MODE" -eq 1 ]]; then
  echo "Static reference UI:     not started"
fi
echo "Logs:                    $LOG_DIR"
