---
description: Check if the evo-agent-team dashboard server is running and report its status including port, monitored directory, and health.
allowed-tools: Bash
---

# evo-team:status — Dashboard Server Status

Check the evo-agent-team dashboard server status and report findings.

## Steps

1. Probe the server by running the command below to check if it's responding:

!`curl -s --connect-timeout 2 http://localhost:${EVO_TEAM_PORT:-3006}/api/teams 2>/dev/null && echo "__SERVER_UP__" || echo "__SERVER_DOWN__"`

2. If the output contains `__SERVER_UP__`:
   - Report that the server is **running**
   - Show the URL: `http://localhost:${EVO_TEAM_PORT:-3006}`
   - Parse the JSON response to report:
     - Number of teams detected
     - Whether demo mode is active (`isDemoMode` field)
   - Suggest: "Run `/evo-team:open` to open the dashboard in your browser."

3. If the output contains `__SERVER_DOWN__`:
   - Report that the server is **not running**
   - Provide instructions to start it:
     ```
     evo-agent-team --cwd <project-directory>
     ```
   - Mention optional flags: `--port <port>` to use a custom port
   - If the user has a project directory context, suggest using that path

## Output Format

Keep the output concise — a few lines max. Use a status indicator:
- Running: report URL + team count
- Not running: report how to start
