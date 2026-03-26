#!/usr/bin/env bash
# evo-agent-team: Check if dashboard server is running.
# Called by plugin hook on Notification events.
# Exits silently (exit 0) in all cases — never blocks the user.

PORT="${EVO_TEAM_PORT:-3006}"
URL="http://localhost:${PORT}/api/teams"

# Quick probe — 2s timeout, silent on failure
if curl -s --connect-timeout 2 "$URL" >/dev/null 2>&1; then
  # Server is running, nothing to report
  exit 0
fi

# Server not running — print a subtle reminder (only on notification hooks)
echo "[evo-agent-team] Dashboard server is not running on port ${PORT}."
echo "  Start it with: evo-agent-team --cwd $(pwd)"
exit 0
