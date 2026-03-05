#!/usr/bin/env bash
# start_service.sh — Build and start the Agent Team Visualizer in production mode

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
PID_FILE="$SCRIPT_DIR/.server.pid"
LOG_FILE="$SCRIPT_DIR/server.log"

cd "$ROOT_DIR"

# Check if already running
if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  if kill -0 "$PID" 2>/dev/null; then
    echo "Service is already running (PID $PID)."
    exit 0
  else
    rm -f "$PID_FILE"
  fi
fi

# Kill any stale process on the port
if lsof -ti :${PORT:-3006} >/dev/null 2>&1; then
  echo "Killing stale process on port ${PORT:-3006}..."
  kill $(lsof -ti :${PORT:-3006}) 2>/dev/null || true
  sleep 1
fi

echo "Building client and server..."
npm run build

echo "Starting server..."
nohup npm run start -w server > "$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"

echo "Server started (PID $(cat "$PID_FILE"))."
echo "Dashboard + API: http://localhost:${PORT:-3006}"
echo "Logs:            $LOG_FILE"
