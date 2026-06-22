#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REFERENCE_DIR="$ROOT_DIR/docs/reference/connect-prototype"
API_DIR="$REFERENCE_DIR/local-trigger-server"
LOG_DIR="$ROOT_DIR/.logs/connect-local"

NEXT_PORT="${NEXT_PORT:-3000}"
CONNECT_API_PORT="${CONNECT_API_PORT:-8790}"
CONNECT_STATIC_PORT="${CONNECT_STATIC_PORT:-4174}"
WITH_STATIC="${WITH_STATIC:-1}"

for arg in "$@"; do
  case "$arg" in
    --no-static)
      WITH_STATIC=0
      ;;
    -h|--help)
      cat <<HELP
Restart CarePland Connect local development servers.

Default:
  - CarePland Next app on port $NEXT_PORT
  - Connect prototype API/local-trigger server on port $CONNECT_API_PORT
  - Connect static reference UI on port $CONNECT_STATIC_PORT

Usage:
  scripts/restart-connect-local.sh
  scripts/restart-connect-local.sh --no-static

Environment overrides:
  NEXT_PORT=3000 CONNECT_API_PORT=8790 CONNECT_STATIC_PORT=4174 WITH_STATIC=1
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
    echo "CarePland Next app is already listening on port $NEXT_PORT; leaving it in place."
    return
  fi
  echo "Starting CarePland Next app on http://localhost:$NEXT_PORT"
  (
    cd "$ROOT_DIR"
    nohup npm run dev -- --port "$NEXT_PORT" > "$LOG_DIR/next-app.log" 2>&1 &
    echo $! > "$LOG_DIR/next-app.pid"
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
    nohup env PORT="$CONNECT_API_PORT" npm start > "$LOG_DIR/connect-api.log" 2>&1 &
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
    nohup python3 -m http.server "$CONNECT_STATIC_PORT" > "$LOG_DIR/connect-static.log" 2>&1 &
    echo $! > "$LOG_DIR/connect-static.pid"
  )
}

stop_port "$NEXT_PORT" "CarePland Next app"
stop_port "$CONNECT_API_PORT" "Connect API"
if [[ "$WITH_STATIC" -eq 1 ]]; then
  stop_port "$CONNECT_STATIC_PORT" "Connect static reference UI"
fi

start_next_app
start_connect_api
start_static_reference

sleep 2

echo
echo "Restart complete."
echo "CarePland Connect:       http://localhost:$NEXT_PORT/connect"
echo "CarePland Receiver:      http://localhost:$NEXT_PORT/connect/receiver"
echo "Connect API:             http://localhost:$CONNECT_API_PORT"
if [[ "$WITH_STATIC" -eq 1 ]]; then
  echo "Static reference UI:     http://localhost:$CONNECT_STATIC_PORT/index.html"
  echo "Static web receiver:     http://localhost:$CONNECT_STATIC_PORT/web-receiver.html"
fi
echo "Logs:                    $LOG_DIR"
