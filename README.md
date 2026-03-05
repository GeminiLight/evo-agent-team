# 🖥️ evo-agent-team

A real-time dashboard for monitoring and visualizing [Claude Code](https://claude.ai/claude-code) agent teams — rendered in a retro CRT/phosphor terminal aesthetic.

---

## ✨ Features

| Feature | Description |
|---|---|
| 📊 **Matrix View** | Dashboard with team overview, agent roster cards, and filterable task registry |
| 🕸️ **Graph View** | Interactive DAG topology of agents and task dependencies powered by ReactFlow |
| 💬 **Comms View** | Agent communication log with per-agent filtering and message type badges |
| 📅 **Timeline View** | Chronological feed of all task status changes with transition history |
| 🔍 **Task Detail Panel** | Click any task to open a sliding panel with full description, owner, and dependency info |
| 📤 **Export** | Download the topology graph as PNG or the full team state as JSON |
| ⚡ **Real-time Sync** | WebSocket push updates with automatic polling fallback (LIVE / POLL indicator) |
| 🎭 **Demo Mode** | Built-in mock team auto-activates when no live agent teams are detected |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- A running [Claude Code](https://claude.ai/claude-code) agent team (optional — demo mode works without one)

### Install & Run

```bash
# Install all dependencies
npm install

# Start both server and client in development mode
npm run dev
```

The dashboard will be available at **http://localhost:5173**.

The API server runs at **http://localhost:3006**.

### Build for Production

```bash
npm run build
npm run start -w server
```

---

## ⚙️ Configuration

Edit `.env` in the project root:

```env
TEAMS_DIR=~/.claude/teams       # Where Claude Code stores team configs
TASKS_DIR=~/.claude/tasks       # Where Claude Code stores task files
PORT=3006                        # API server port
POLL_INTERVAL_MS=2000            # Polling interval (fallback when WebSocket unavailable)
DEMO_MODE=auto                   # auto | on | off
```

`DEMO_MODE=auto` shows mock data only when no real teams are detected. Set to `on` to always show demo data.

---

## 🗂️ Project Structure

```
agent-team/
├── server/                  # Express API backend (TypeScript ESM)
│   └── src/
│       ├── index.ts         # Server entry point
│       ├── config.ts        # .env config loader
│       ├── types.ts         # Shared TypeScript interfaces
│       ├── websocket.ts     # WebSocket server + fs.watch broadcaster
│       ├── changeTracker.ts # In-memory task status change diffing
│       ├── mockData.ts      # Demo team/task/message/timeline data
│       └── routes/
│           ├── teams.ts     # GET /api/teams, /api/teams/:id, /api/teams/:id/timeline
│           └── messages.ts  # GET /api/teams/:id/messages
└── client/                  # React 18 + Vite frontend (TypeScript)
    └── src/
        ├── App.tsx          # Root component + view routing
        ├── types.ts         # Shared TypeScript interfaces
        ├── hooks/
        │   └── useTeamData.ts        # WebSocket + polling data hook
        ├── utils/
        │   ├── statusColors.ts       # Status color palette + derived status logic
        │   └── exportUtils.ts        # PNG and JSON export helpers
        └── components/
            ├── Layout.tsx            # App shell: header, nav, team selector
            ├── TaskDetailPanel.tsx   # Sliding task detail panel
            ├── dashboard/            # Matrix view components
            ├── graph/                # ReactFlow topology view components
            ├── commlog/              # Agent communication log components
            └── timeline/             # Task timeline components
```

---

## 🎨 Design System

The UI uses a **CRT phosphor terminal** aesthetic throughout:

- 🟢 **Phosphor** (`#39ff6a`) — primary accent, completed status
- 🟠 **Amber** (`#f5a623`) — in-progress status, warnings
- 🔴 **Crimson** (`#ff3b5c`) — blocked status, errors
- 🔵 **Ice** (`#7eb8f7`) — informational, task assignments
- ⬛ **Void** (`#040608`) — base background
- Fonts: **JetBrains Mono** (monospace) + **Syne** (display)
- CRT scanlines and vignette applied globally via CSS

---

## 🤝 How It Works

The visualizer reads live data written by the Claude Code agent runtime:

- **Team configs** — `~/.claude/teams/{team-name}/config.json`
- **Task files** — `~/.claude/tasks/{team-name}/{task-id}.json`
- **Agent inboxes** — `~/.claude/teams/{team-name}/inboxes/{agent-name}.json`

The server watches these directories via `fs.watch` and pushes updates to the client over WebSocket. When WebSocket is unavailable, the client falls back to polling every 2 seconds.

---

## 📦 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS v4 |
| Graph | @xyflow/react (ReactFlow) v12 |
| Backend | Node.js, Express 4, TypeScript ESM |
| Real-time | WebSocket (`ws`), `fs.watch` |
| Icons | lucide-react |
| Export | html-to-image |
