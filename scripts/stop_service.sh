#!/usr/bin/env bash
# stop_service.sh — Stop the Agent Team Visualizer server

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$SCRIPT_DIR/.server.pid"

if [ ! -f "$PID_FILE" ]; then
  echo "No PID file found. Service may not be running."
  exit 0
fi

PID=$(cat "$PID_FILE")

if kill -0 "$PID" 2>/dev/null; then
  echo "Stopping server (PID $PID)..."
  kill "$PID"
  rm -f "$PID_FILE"
  echo "Server stopped."
else
  echo "Process $PID not found. Cleaning up stale PID file."
  rm -f "$PID_FILE"
fi
