---
description: Open the evo-agent-team dashboard in your default web browser. Detects the OS and uses the appropriate open command.
allowed-tools: Bash
---

# evo-team:open — Open Dashboard in Browser

Open the evo-agent-team dashboard in the user's default browser.

## Steps

1. First check if the server is running:

!`curl -s --connect-timeout 2 http://localhost:${EVO_TEAM_PORT:-3006}/api/teams >/dev/null 2>&1 && echo "__SERVER_UP__" || echo "__SERVER_DOWN__"`

2. If the output contains `__SERVER_DOWN__`:
   - Tell the user: "The dashboard server is not running. Start it first with `evo-agent-team --cwd <project-directory>`."
   - Do NOT attempt to open the browser.
   - Stop here.

3. If the output contains `__SERVER_UP__`, open the browser using the appropriate OS command:

!`URL="http://localhost:${EVO_TEAM_PORT:-3006}"; case "$(uname -s)" in Darwin*) open "$URL" 2>/dev/null && echo "Opened $URL in browser" || echo "FALLBACK: $URL";; Linux*) xdg-open "$URL" 2>/dev/null && echo "Opened $URL in browser" || echo "FALLBACK: $URL";; MINGW*|MSYS*|CYGWIN*) start "$URL" 2>/dev/null && echo "Opened $URL in browser" || echo "FALLBACK: $URL";; *) echo "FALLBACK: $URL";; esac`

4. If the output contains `FALLBACK:`:
   - Report: "Could not auto-open the browser. Please visit the URL manually."
   - Print the URL clearly.

5. If the output contains `Opened`:
   - Report: "Dashboard opened in your browser."

## Output Format

Keep it to one line of confirmation or one line of fallback URL.
