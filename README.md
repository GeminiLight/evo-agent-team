# 🖥️ evo-agent-team

[![npm version](https://img.shields.io/npm/v/evo-agent-team.svg)](https://www.npmjs.com/package/evo-agent-team)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)

> A real-time dashboard for monitoring and visualizing [Claude Code](https://claude.ai/claude-code) agent teams — rendered in a retro CRT/phosphor terminal aesthetic.

[Features](#-features) • [Demo](#-demo) • [Installation](#-installation) • [Documentation](#-documentation) • [Contributing](#-contributing)

---

## 📸 Demo

![Dashboard Preview](./docs/assets/demo.gif)

*Real-time agent team visualization with CRT terminal aesthetic*

---

## ✨ Features

| Feature | Description |
|---|---|
| 📊 **Matrix View** | Dashboard with team overview, agent roster cards, and filterable task registry |
| 🕸️ **Graph View** | Interactive DAG topology of agents and task dependencies powered by ReactFlow |
| 💬 **Comms View** | Agent communication log with per-agent filtering and message type badges |
| 📅 **Timeline View** | Chronological feed of all task status changes with transition history |
| 🔍 **Task Detail Panel** | Click any task to open a sliding panel with full description, owner, and dependency info |
| 📝 **Review Panel** | Feedback log, agent preferences management, and statistics with LLM-powered insights |
| 🧠 **Memory Management** | View and edit team MEMORY.md with AI-powered memory extraction |
| 🔄 **Knowledge Transfer** | Cross-team knowledge migration with LLM analysis and classification |
| 📋 **Context Summary** | Three-section context (Decisions/Progress/Context) with token budget |
| 🎯 **Exec Summary** | AI-generated team progress with caching |
| 📤 **Export** | Download the topology graph as PNG or the full team state as JSON |
| ⚡ **Real-time Sync** | WebSocket push updates with automatic polling fallback |
| 🎨 **12 Themes** | 7 dark + 5 light terminal-inspired themes |
| 🌍 **i18n** | Full English/Chinese bilingual support |
| 🎭 **Demo Mode** | Built-in mock team auto-activates when no live teams detected |

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- [Claude Code](https://claude.ai/claude-code) (optional — demo mode works standalone)

### Installation

```bash
# Install globally
npm install -g evo-agent-team

# Run the dashboard
evo-agent-team
```

Or use without installing:

```bash
npx evo-agent-team
```

Then open http://localhost:5173

---

## 📖 Documentation

### Usage

```bash
# Start with default settings
evo-agent-team

# With custom port (server)
PORT=4000 evo-agent-team

# Disable demo mode
DEMO_MODE=off evo-agent-team
```

### Configuration

Create `.env` file in your project root:

```env
# Data directories
TEAMS_DIR=~/.claude/teams
TASKS_DIR=~/.claude/tasks

# Server settings
PORT=3006
POLL_INTERVAL_MS=2000
DEMO_MODE=auto

# LLM configuration (for AI features)
OPENAI_API_KEY=sk-...
LLM_MODEL=gpt-4o-mini
```

| Variable | Default | Description |
|----------|---------|-------------|
| `TEAMS_DIR` | `~/.claude/teams` | Claude Code team configs |
| `TASKS_DIR` | `~/.claude/tasks` | Claude Code task files |
| `PORT` | `3006` | API server port |
| `DEMO_MODE` | `auto` | `auto`/`on`/`off` |
| `OPENAI_API_KEY` | - | Required for AI features |

### Data Sources

The dashboard reads from:

| Source | Path |
|--------|------|
| Team configs | `~/.claude/teams/{team}/config.json` |
| Task files | `~/.claude/tasks/{team}/{task-id}.json` |
| Agent inboxes | `~/.claude/teams/{team}/inboxes/{agent}.json` |
| Memory | `~/.claude-internal/projects/{cwd}/memory/MEMORY.md` |
| Feedback | `{team}/feedback.jsonl` |

---

## 🏗️ Architecture

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS v4 |
| State | React Hooks, WebSocket |
| Graph | @xyflow/react (ReactFlow) |
| i18n | react-i18next |
| Backend | Node.js, Express 4, TypeScript ESM |
| Real-time | WebSocket (`ws`), `fs.watch` |
| AI | OpenAI SDK |

### Project Structure

```
agent-team/
├── server/               # Express API (TypeScript ESM)
│   └── src/
│       ├── routes/       # API endpoints
│       ├── index.ts      # Server entry
│       └── config.ts     # Environment config
├── client/               # React 18 + Vite
│   └── src/
│       ├── components/   # UI components
│       ├── hooks/        # Custom hooks
│       ├── utils/        # Utilities
│       └── i18n.ts       # Translations
└── wiki/                 # Documentation
    ├── 01-project-roadmap.md
    ├── 02-system-architecture.md
    └── 90-changelog.md
```

---

## 🛠️ Development

```bash
# Clone repository
git clone <repo-url>
cd agent-team

# Install dependencies
npm install

# Start development
npm run dev

# Build for production
npm run build

# Start production server
npm run start -w server
```

### Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start client + server in dev mode |
| `npm run build` | Build client for production |
| `npm run start -w server` | Start production server |

---

## 🎨 Design System

CRT phosphor terminal aesthetic:

- **Phosphor** (`#39ff6a`) — primary accent
- **Amber** (`#f5a623`) — warnings/in-progress
- **Crimson** (`#ff3b5c`) — errors/blocked
- **Ice** (`#7eb8f7`) — informational
- **Void** (`#040608`) — background
- Fonts: JetBrains Mono + Syne

---

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 License

[MIT](LICENSE) © 2026

---

## 🔗 Links

- [npm](https://www.npmjs.com/package/evo-agent-team)
- [Issues](https://github.com/username/agent-team/issues)
- [Documentation](/wiki)
