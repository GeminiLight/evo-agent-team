# evo-agent-team — Project Wiki

> Real-time CRT/phosphor-themed dashboard for monitoring Claude Code agent teams.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture Overview](#2-architecture-overview)
3. [Directory Structure](#3-directory-structure)
4. [Server — Detailed Reference](#4-server--detailed-reference)
   - [Entry Point](#41-entry-point-indexts)
   - [Configuration](#42-configuration-configts)
   - [Type System](#43-type-system-typests)
   - [WebSocket Server](#44-websocket-server-websocketts)
   - [Change Tracker](#45-change-tracker-changetrackerts)
   - [Routes — Teams](#46-routes--teams-routesteamsts)
   - [Routes — Messages](#47-routes--messages-routesmessagets)
   - [Human Input Detector](#48-human-input-detector-humaninputdetectorts)
   - [Session Scanner](#49-session-scanner-sessionscanners)
   - [Session History](#410-session-history-sessionhistoryts)
   - [Todo Scanner](#411-todo-scanner-todoscannersts)
   - [Mock Data](#412-mock-data-mockdatats)
5. [Client — Detailed Reference](#5-client--detailed-reference)
   - [Entry Point & Root](#51-entry-point--root)
   - [Data Hooks](#52-data-hooks)
   - [Layout & Shell](#53-layout--shell-layouttsx)
   - [Views](#54-views)
   - [Slide-in Panels](#55-slide-in-panels)
   - [Utilities](#56-utilities)
6. [API Reference](#6-api-reference)
7. [Data Flow & Real-time Sync](#7-data-flow--real-time-sync)
8. [Design System](#8-design-system)
9. [File System Conventions](#9-file-system-conventions)
10. [Demo Mode](#10-demo-mode)
11. [Environment & Configuration](#11-environment--configuration)
12. [Build & Run](#12-build--run)

---

## 1. Project Overview

`evo-agent-team` is an npm package and monorepo providing a live dashboard for teams of Claude Code agents. It reads data written by the Claude Code runtime from the local filesystem (`~/.claude/teams/`, `~/.claude/tasks/`, `~/.claude/todos/`, `~/.claude/projects/`) and presents it in a terminal-aesthetic single-page app.

**Key capabilities:**

| Capability | How |
|---|---|
| Real-time updates | WebSocket (`ws`) push; automatic polling fallback |
| Team & task status | Reads JSON files from `~/.claude/tasks/{team}/` |
| Agent communication | Reads inbox JSON from `~/.claude/teams/{team}/inboxes/` |
| Timeline | In-memory diff of task status snapshots per `GET /api/teams/:id` call |
| Session history | Parses `.jsonl` files from `~/.claude/projects/` |
| Human-input detection | Scans session JSONL for unanswered blocking tool calls |
| Demo mode | Synthetic data auto-activates when no live teams are found |

---

## 2. Architecture Overview

```
Browser (React 18 / Vite)
       │
       ├─── WebSocket /ws  ←──────────────── fs.watch (teams + tasks dirs)
       │                                              │
       └─── HTTP /api/*  ────────────────────  Express server (Node.js ESM)
                                                       │
                                           reads ──────┼──── ~/.claude/teams/{id}/config.json
                                                       ├──── ~/.claude/teams/{id}/inboxes/*.json
                                                       ├──── ~/.claude/tasks/{id}/*.json
                                                       ├──── ~/.claude/todos/*.json
                                                       └──── ~/.claude/projects/**/*.jsonl
```

**Monorepo workspaces:**

| Workspace | Technology | Dev port |
|---|---|---|
| `server/` | Node.js 18+, Express 4, TypeScript ESM, `ws` | 3006 |
| `client/` | React 18, Vite, TypeScript, Tailwind CSS v4, `@xyflow/react` | 5173 |

In production, the server also serves the built client from `server/dist/public/`.

---

## 3. Directory Structure

```
agent-team/
├── .env                         # Local config (gitignored)
├── .env.example
├── package.json                 # Root workspace (concurrently dev script)
├── bin/
│   └── evo-agent-team.js        # npm package CLI entry
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts             # Express + WebSocket init
│       ├── config.ts            # .env loader → AppConfig
│       ├── types.ts             # All shared TypeScript interfaces
│       ├── websocket.ts         # WebSocketServer, fs.watch, broadcast
│       ├── changeTracker.ts     # In-memory task status diff & timeline
│       ├── humanInputDetector.ts# Session JSONL scanner for blocking calls
│       ├── sessionScanner.ts    # Token usage aggregator per agent
│       ├── sessionHistory.ts    # Lead session JSONL → SessionMessage[]
│       ├── todoScanner.ts       # ~/.claude/todos/ reader
│       ├── mockData.ts          # Demo team/task/message/timeline fixtures
│       └── routes/
│           ├── teams.ts         # GET/PATCH routes for teams, tasks, config
│           └── messages.ts      # GET routes for inboxes & inbox summary
└── client/
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── main.tsx             # React DOM render
        ├── App.tsx              # Root: state orchestration, view routing
        ├── types.ts             # Client-side mirror of server types
        ├── context/
        │   └── ThemeContext.tsx  # Theme CSS variable management
        ├── hooks/
        │   ├── useTeamData.ts          # Primary data hook (WS + polling)
        │   ├── usePendingHumanRequests.ts
        │   ├── useProjectTodos.ts
        │   ├── useInboxSummary.ts
        │   ├── useSessionStats.ts
        │   ├── useSessionHistory.ts
        │   └── useAgentTodos.ts
        ├── utils/
        │   ├── statusColors.ts   # Status → CSS color palette
        │   ├── exportUtils.ts    # PNG / JSON / CSV exporters
        │   └── agentColors.ts    # Agent name → deterministic color
        └── components/
            ├── Layout.tsx               # App shell (header, nav, export menu)
            ├── EmptyState.tsx           # No-team landing screen
            ├── ThemeSwitcher.tsx        # Theme picker widget
            ├── TaskDetailPanel.tsx      # Slide-in task detail (right drawer)
            ├── AgentProfilePanel.tsx    # Slide-in agent profile (right drawer)
            ├── SessionTodoPanel.tsx     # Session todo widget
            ├── dashboard/
            │   ├── DashboardView.tsx    # MATRIX view orchestrator
            │   ├── TeamOverview.tsx     # Stats bar
            │   ├── AgentCard.tsx        # Per-agent summary card
            │   ├── TaskList.tsx         # Filterable task table
            │   └── AgentHeatmap.tsx     # Activity heatmap
            ├── graph/
            │   ├── TopologyView.tsx     # ReactFlow DAG view
            │   ├── AgentNode.tsx        # Custom ReactFlow node (agent)
            │   ├── TaskNode.tsx         # Custom ReactFlow node (task)
            │   └── graphLayout.ts       # Node/edge layout algorithms
            ├── commlog/
            │   ├── CommLogView.tsx      # COMMS view with filters
            │   └── MessageBubble.tsx    # Individual message render
            ├── timeline/
            │   ├── TimelineView.tsx     # LOG view
            │   └── TimelineEvent.tsx    # Single timeline event row
            └── history/
                └── SessionHistoryView.tsx  # HIST view (lead session JSONL)
```

---

## 4. Server — Detailed Reference

### 4.1 Entry Point (`index.ts`)

**Purpose:** Bootstrap Express + WebSocket.

```
Express app
  ├── CORS (all origins)
  ├── JSON body parser
  ├── /api → teamsRouter
  ├── /api → messagesRouter
  ├── Static: server/dist/public  (production)
  └── * → index.html  (SPA fallback)

httpServer.listen(config.port)
initWebSocket(httpServer)        ← attaches /ws
```

**Functions:**
- No exported functions; side-effect module.

---

### 4.2 Configuration (`config.ts`)

**Purpose:** Load `.env` into a typed `AppConfig` object.

**Exported:**
- `config: AppConfig` — singleton used across all server modules.

**Helper functions (private):**
- `expandHome(p)` — replaces leading `~` with `os.homedir()`.
- `parseDemoMode(val)` — narrows env string to `'auto' | 'on' | 'off'`.

**Env vars consumed:**

| Var | Default | Description |
|---|---|---|
| `TEAMS_DIR` | `~/.claude-internal/teams` | Team config directory |
| `TASKS_DIR` | `~/.claude-internal/tasks` | Task JSON directory |
| `PORT` | `3006` | HTTP/WS listen port |
| `POLL_INTERVAL_MS` | `2000` | Client polling interval hint |
| `DEMO_MODE` | `auto` | `auto` / `on` / `off` |

---

### 4.3 Type System (`types.ts`)

Single source of truth for all TypeScript interfaces. The client `types.ts` mirrors this minus `AppConfig`.

**Core domain types:**

| Type | Description |
|---|---|
| `TeamMember` | Agent identity: name, agentId, agentType, model, color, cwd, subscriptions |
| `TeamConfig` | Team roster: members[], leadAgentId, leadSessionId |
| `Task` | Work item: id, subject, description, status, blocks[], blockedBy[], owner |
| `TeamSummary` | Lightweight list item: id, name, hasConfig, memberCount, taskCount |
| `TeamDetail` | Full team: config + tasks[] + stats{total,pending,inProgress,completed} |
| `AppConfig` | Server runtime config (server-only) |

**Feature-specific types:**

| Type | Feature |
|---|---|
| `WsMessage` / `WsMessageType` | WebSocket protocol messages |
| `AgentMessage` / `CommLogResponse` | Agent inbox messages |
| `TaskChangeEvent` / `TimelineResponse` | Task status change events |
| `TodoItem` / `SessionTodo` / `ProjectTodosResponse` | Session todo lists |
| `AgentSessionStats` / `SessionStatsResponse` | Token usage per agent |
| `SessionMessage` / `SessionEntry` / `SessionHistoryResponse` | Lead session JSONL |
| `InboxSummaryItem` / `InboxSummaryResponse` | Unread message counts |

**Status values for `Task.status`:** `'pending' | 'in_progress' | 'completed'`

---

### 4.4 WebSocket Server (`websocket.ts`)

**Purpose:** Manage WebSocket connections, keepalive, and filesystem-triggered broadcasts.

**Exported functions:**

| Function | Signature | Description |
|---|---|---|
| `initWebSocket` | `(httpServer: Server) => void` | Attach `WebSocketServer` at `/ws`, start ping/pong and `fs.watch` |
| `broadcastTeamsUpdate` | `() => void` | Send `{type:'teams_update'}` to all connected clients |
| `broadcastTeamDetailUpdate` | `(teamId: string) => void` | Send `{type:'team_detail_update', teamId}` to all connected clients |

**Internal functions:**

| Function | Description |
|---|---|
| `send(ws, msg)` | Send JSON to single `OPEN` client |
| `broadcast(msg)` | Iterate `clients` Set and send to each |
| `scheduleTeamsUpdate()` | Debounce (300ms) `broadcastTeamsUpdate` |
| `scheduleTeamDetailUpdate(teamId)` | Per-team debounce (300ms) map |
| `watchDir(dir)` | Wrap `fs.watch({recursive:true})` with error-safe fallback |

**Keepalive:** 30 s ping interval; clients that miss a pong within 10 s are terminated.

**File watching:** Both `config.teamsDir` and `config.tasksDir` are watched recursively. On any change, the team directory name is extracted from the path to determine which team's clients to notify.

---

### 4.5 Change Tracker (`changeTracker.ts`)

**Purpose:** Pure in-memory task status diffing to produce the Timeline feed, without any filesystem writes.

**State (module-level):**
- `taskSnapshots: Map<teamId, Map<taskId, Task>>` — last seen snapshot per team.
- `eventLog: Map<teamId, TaskChangeEvent[]>` — ordered list of change events, capped at 500.

**Exported functions:**

| Function | Signature | Description |
|---|---|---|
| `recordSnapshot` | `(teamId, tasks[]) => void` | Diff incoming tasks against stored snapshot; append `TaskChangeEvent` for new tasks (`oldStatus: null`) and status changes. |
| `getTimeline` | `(teamId) => TaskChangeEvent[]` | Return event log for team, oldest first. |

`recordSnapshot` is called inside `GET /api/teams/:id` so the timeline updates passively whenever the client fetches team detail (or WebSocket triggers a re-fetch).

**Event ID format:** `{teamId}-{taskId}-{Date.now()}-{init|change}`

---

### 4.6 Routes — Teams (`routes/teams.ts`)

All routes are mounted at `/api` by `index.ts`.

**Private helpers:**

| Helper | Description |
|---|---|
| `isHiddenFile(name)` | Returns true for dot-files and `.lock`/`.highwatermark` |
| `dirExists(path)` | `fs.stat` → boolean |
| `readJsonFile<T>(path)` | Parse JSON file, return `T \| null` on any error |
| `getSubdirs(path)` | List direct subdirectories |
| `hasNonHiddenFiles(path)` | Check if a directory has any non-hidden entries |

**Route table:**

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/teams` | List all teams (union of `teamsDir` + `tasksDir`). Injects demo team if `isDemoMode`. Returns `{teams, isDemoMode}`. |
| `GET` | `/api/teams/:id` | Full team detail: reads `config.json` + all task JSON files, sorts by numeric id, calls `recordSnapshot`, returns `TeamDetail`. |
| `PATCH` | `/api/teams/:id/members/:agentName/prompt` | Update a member's `prompt` field in `config.json`. Returns `{ok, name, prompt}`. |
| `GET` | `/api/teams/:id/human-input-status` | Detect agents awaiting user input via session JSONL scan. Returns `{teamId, waitingAgents, details}`. |
| `GET` | `/api/teams/:id/guide` | Read `TEAM_GUIDE.md` from teams dir. Returns `{teamId, content, filename}`. |
| `GET` | `/api/teams/:id/todos` | Read session todo lists via `getTodosForTeam`. Returns `{teamId, sessions}`. |
| `GET` | `/api/teams/:id/session-stats` | Aggregate token usage via `getSessionStatsForTeam`. Returns `{teamId, agents}`. |
| `GET` | `/api/teams/:id/session-history` | Parse lead session JSONL via `getSessionHistory`. Returns `{teamId, sessionId, messages}`. |
| `GET` | `/api/teams/:id/timeline` | Return cached timeline from `changeTracker`. Returns `TimelineResponse`. |
| `GET` | `/api/config` | Return current runtime config (read-only snapshot). |
| `POST` | `/api/config` | Mutate runtime config fields (`teamsDir`, `tasksDir`, `pollIntervalMs`, `demoMode`). |

**Task filtering:** Tasks with `metadata._internal === true` are excluded from all listings.

---

### 4.7 Routes — Messages (`routes/messages.ts`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/teams/:id/messages` | Read all `{teamId}/inboxes/*.json` files, parse entries, sort by timestamp. Returns `CommLogResponse`. |
| `GET` | `/api/teams/:id/inbox-summary` | Read inbox files, count total and unread (`read === false`). Returns `InboxSummaryResponse`. |

**Message parsing:** Each inbox entry may have `text` as either plain prose or a JSON string. The route attempts `JSON.parse(text)` to extract `parsedType` and `summary` fields, which drive message type badges in the UI.

---

### 4.8 Human Input Detector (`humanInputDetector.ts`)

**Purpose:** Scan Claude Code session JSONL files to find agents currently blocked waiting for user approval or a question answer.

**Algorithm:**
1. Compute project directories from `memberCwds` using `cwdToProjectDir`.
2. Filter `.jsonl` files modified within the last 30 minutes.
3. For each file: walk all content blocks; track the last `tool_use` whose name is in `BLOCKING_TOOLS`; track all `tool_use_id` values from `tool_result` blocks. If the last blocking call is unanswered → agent is waiting.
4. Identify the file's owning agent via `inferAgentName`.

**Blocking tools detected:** `AskUserQuestion`, `Bash`, `Edit`, `Write`, `NotebookEdit`.

**Exported functions:**

| Function | Signature | Description |
|---|---|---|
| `cwdToProjectDir(cwd)` | `string → string` | Replaces `/` with `-` to match Claude's project dir naming. |
| `inferAgentName(filePath, memberNames, projectDir, leadSessionId?)` | `→ Promise<string\|null>` | Two-pass: (1) scan for `TaskUpdate`/`TaskCreate` with `owner` in `memberNames`; (2) look up `parentToolUseID` in the lead session to find which `Agent` call spawned this sub-agent. |
| `detectHumanInputWaiters(memberNames, memberCwds, leadSessionId?)` | `→ Promise<HumanInputStatus>` | Main entry: returns `{waitingAgents: string[], details: WaitingAgent[]}`. |
| `getBlockingCall(filePath)` | `→ Promise<BlockingCall\|null>` | Returns the unanswered blocking tool name + detail snippet, or null. |

---

### 4.9 Session Scanner (`sessionScanner.ts`)

**Purpose:** Aggregate token usage and message counts per agent by scanning session JSONL files.

**State:** Module-level `sessionNameCache: Map<sessionId, agentName>` persists for the process lifetime (session→name mapping never changes).

**Exported functions:**

| Function | Description |
|---|---|
| `getSessionStatsForTeam(memberNames, memberCwds, leadSessionId?, leadName?)` | Enumerates all `.jsonl` in project dirs, resolves agent name via cache/`inferAgentName`, accumulates `inputTokens`, `outputTokens`, `cacheReadTokens`, `messageCount`, `sessionDurationMs`. Returns `AgentSessionStats[]`. |

**Internal:**
- `scanSessionUsage(filePath)` — reads JSONL line-by-line, sums `usage.*` fields from `assistant` records, tracks first/last timestamps for duration.

---

### 4.10 Session History (`sessionHistory.ts`)

**Purpose:** Parse the lead agent's session JSONL into a structured `SessionMessage[]` for the HIST view.

**Exported functions:**

| Function | Description |
|---|---|
| `getSessionHistory(memberCwds, leadSessionId)` | Finds the JSONL file at `~/.claude/projects/{cwdToProjectDir(cwd)}/{leadSessionId}.jsonl`. Streams it line-by-line with `readline`. Returns only `type === 'user' \| 'assistant'` records, structured via `parseContent`. |

**`parseContent(content)`** (private): Handles three content block types:
- `text` → `{kind:'text', text}`
- `tool_use` → `{kind:'tool_use', toolName, toolInput, toolUseId}`
- `tool_result` → `{kind:'tool_result', toolResultId, toolResultText, isError}`

---

### 4.11 Todo Scanner (`todoScanner.ts`)

**Purpose:** Read per-session todo lists from `~/.claude/todos/`.

**File naming convention:** `{sessionId}-agent-{sessionId}.json`

**Algorithm:**
1. Collect all session IDs from project dirs for each `memberCwd`.
2. Validate each `.jsonl` is a "real session" (0 bytes = in-process agent, or first record is not `file-history-snapshot`).
3. Match session IDs against filenames in `~/.claude/todos/`.
4. Return `SessionTodo[]` with `isLead` flag set when `sessionId === leadSessionId`.

**Exported functions:**

| Function | Description |
|---|---|
| `getTodosForTeam(memberCwds, leadSessionId?)` | Returns `{sessions: SessionTodo[]}`. |

---

### 4.12 Mock Data (`mockData.ts`)

**Purpose:** Provide realistic fixture data for demo mode. All functions are pure (no I/O).

**Exported functions:**

| Function | Returns |
|---|---|
| `getDemoTeamSummary()` | `TeamSummary` for "Demo Team" (4 members) |
| `getDemoTeamDetail()` | `TeamDetail` with 6 tasks in various states |
| `getDemoTimeline()` | `TimelineResponse` with 11 events spanning 90 minutes |
| `getDemoTodos()` | `ProjectTodosResponse` with 2 sessions |
| `getDemoInboxSummary()` | `InboxSummaryResponse` with per-agent unread counts |
| `getDemoSessionStats()` | `SessionStatsResponse` with token stats for 4 agents |
| `getDemoCommLog()` | `CommLogResponse` with 8 messages of mixed types |

Demo task dependency graph: `1 → {2,3} → {4,5} → 6`

---

## 5. Client — Detailed Reference

### 5.1 Entry Point & Root

**`main.tsx`** — Renders `<App />` into `#root` wrapped with `ThemeContext` and `ReactFlowProvider`.

**`App.tsx`** — Root component. Owns all top-level state:

| State / hook | Type | Description |
|---|---|---|
| `view` | `ViewType` | Active view: `'dashboard'|'graph'|'commlog'|'timeline'|'history'` |
| `useTeamData(pollInterval)` | hook | Teams list, selected team, detail, loading, WS status |
| `selectedTaskId` | `string\|null` | Opens `TaskDetailPanel` |
| `selectedAgentId` | `string\|null` | Opens `AgentProfilePanel` |
| `usePendingHumanRequests(teamId)` | hook | Agents awaiting human input (10 s poll) |
| `useProjectTodos(teamId)` | hook | Session todo lists (10 s poll) |
| `useSessionHistory(teamId)` | hook | Lead session messages (30 s poll) |
| `useInboxSummary(teamId)` | hook | Per-agent unread counts (10 s poll) |
| `useSessionStats(teamId)` | hook | Token usage per agent (30 s poll) |
| `commMessagesRef` / `timelineEventsRef` | `useRef` | Expose current filtered data to export handlers |

**Export handlers:**
- `handleExportPng()` — calls `exportGraphAsPng` on the graph container ref.
- `handleExportJson()` — calls `exportTeamAsJson` on `teamDetail`.
- `handleExportCsv()` — context-sensitive: tasks CSV (dashboard/graph), comms CSV (commlog), timeline CSV (timeline).

---

### 5.2 Data Hooks

#### `useTeamData(pollInterval)`

Primary data hook. Manages WebSocket connection with polling fallback.

**Returned state:**

| Field | Type | Description |
|---|---|---|
| `teams` | `TeamSummary[]` | Team list from `/api/teams` |
| `selectedTeamId` | `string\|null` | Currently selected team |
| `setSelectedTeamId` | `(id) => void` | Switch selected team |
| `teamDetail` | `TeamDetail\|null` | Detail for selected team |
| `loading` | `boolean` | Initial load in progress |
| `isDemoMode` | `boolean` | Server is serving demo data |
| `enableDemo` | `() => Promise<void>` | POST `/api/config` to enable demo mode |
| `wsConnected` | `boolean` | True when WebSocket is `OPEN` |

**Connection lifecycle:**
1. `startPolling()` starts immediately as fallback.
2. `connectWs()` opens `WebSocket('/ws')`.
3. On `ws.onopen`: `setWsConnected(true)`, `stopPolling()`.
4. On WS `teams_update` message: call `fetchTeams()`.
5. On WS `team_detail_update` message: call `fetchDetail(teamId)` if it matches selected.
6. On `ws.onclose` / `ws.onerror`: `startPolling()`, schedule reconnect in 5 s.

#### `usePendingHumanRequests(teamId)`

Polls `/api/teams/:id/human-input-status` every 10 s. Returns `{count, agentNames, details}`.

#### `useProjectTodos(teamId)`

Polls `/api/teams/:id/todos` every 10 s. Returns `SessionTodo[]`.

#### `useInboxSummary(teamId)`

Polls `/api/teams/:id/inbox-summary` every 10 s. Returns `Record<agentName, InboxSummaryItem>`.

#### `useSessionStats(teamId)`

Polls `/api/teams/:id/session-stats` every 30 s. Returns `Record<agentName, AgentSessionStats>`.

#### `useSessionHistory(teamId)`

Polls `/api/teams/:id/session-history` every 30 s. Returns `{messages, sessionId, loading}`.

---

### 5.3 Layout & Shell (`Layout.tsx`)

**`ViewType`** (exported): `'dashboard' | 'graph' | 'commlog' | 'timeline' | 'history'`

`Layout` renders the full-height app shell:

```
<header sticky>
  Logo + collapse toggle
  Team selector (select or label)
  Stat pills: TOTAL / DONE / RUN / WAIT
  [ separator ]
  StatusDot (LIVE / POLL)
  Clock (live 1s interval)
  DEMO badge (if isDemoMode)
  ⚠ N AWAITING INPUT pill (if pendingHumanCount > 0, navigates to COMMS)
  ViewBtn row: MATRIX | GRAPH | COMMS | LOG | HIST
  ThemeSwitcher
  ExportMenu dropdown
</header>
<main>
  {children}
</main>
```

**Sub-components (file-local):**

| Component | Props | Description |
|---|---|---|
| `StatusDot` | `live, label, color` | Animated dot + label indicator |
| `StatPill` | `label, value, color, pulse?` | Mini stat badge with optional pulse |
| `ViewBtn` | `active, onClick, icon, label, last?, badge?` | Nav tab button; `badge` adds amber dot |
| `ExportMenu` | `onExportPng?, onExportJson?, onExportCsv?, canExportPng?, view` | Dropdown with context-sensitive CSV label |
| `ExportItem` | `label, sublabel?, onClick, divided?` | Menu item row |

**Collapsible nav:** `navCollapsed` state hides team selector and stat pills; `main` padding shrinks for maximum canvas space.

---

### 5.4 Views

#### MATRIX — `DashboardView.tsx`

Orchestrates the dashboard layout:

```
TeamOverview       (stats bar)
AgentCard grid     (sortable: DEFAULT | WORKLOAD | DONE% | A→Z)
SessionTodoList    (inline todo list, if sessions exist)
AgentHeatmap       (if ≥2 agents)
TaskList           (filterable task table)
```

**Sort modes (`SortMode`):** `default | workload | completion | name`

`sortMembers(members, tasks, mode)` — pure function, uses per-member task stats (total, done, active).

**`SessionTodoList`** (file-local component): Renders todo items grouped by session. Each `TodoRow` uses icons: `CheckCircle2` (done), `Loader2` spinning (active), `Clock` (pending).

#### GRAPH — `TopologyView.tsx`

Interactive DAG rendered with `@xyflow/react` (ReactFlow v12).

**Layout modes** (switcher toolbar, centered): `hierarchical | force | circular`

Layout is computed by `buildGraphElements(team, layout)` in `graphLayout.ts` which returns `{nodes, edges}`.

**Custom node types:**
- `agentNode` → `AgentNode` component
- `taskNode` → `TaskNode` component

**Node click:** `taskNode` click calls `onTaskSelect(task.id)` to open `TaskDetailPanel`.

**MiniMap** colors: agent nodes = `--phosphor`; task nodes follow derived status color.

**Export PNG:** `containerRef` passed up to `App.tsx` for `html-to-image` capture.

**`AgentNode`** — Displays agent avatar, name, agentType, ACTIVE/IDLE dot, task count badge. Shows tooltip (400ms hover delay) with type, status, task breakdown, model.

**`TaskNode`** — Displays task id, subject, status badge, owner, dependency arrows (ReactFlow `Handle`).

#### COMMS — `CommLogView.tsx`

Real-time agent communication log.

**Internal hook `useCommLog(teamId)`:** Polls `/api/teams/:id/messages` every 4 s.

**Filter pipeline:**
1. Agent filter (sidebar): `ALL` or specific agent (sender OR recipient).
2. Type filter chips: `all | human | message | plan | task | shutdown | broadcast | idle` — matches `parsedType`.
3. Full-text search: matches `text`, `sender`, `recipient`.

**Threaded display:** `groupMessages(msgs)` groups consecutive same-sender→same-recipient messages (up to 8) into `MessageGroup`. `MessageThread` renders the group with a collapsible "N MORE" toggle.

**Auto-scroll:** `isFollowing` state; pauses when user scrolls 60px from bottom; floating "↓ N NEW MESSAGES" banner when paused.

**Human-input alert banner:** Shown if any `parsedType === 'human_input_request'` with `read === false`. Clicking filters to HUMAN type.

#### LOG — `TimelineView.tsx`

Chronological task status change feed.

**Internal hook `useTimeline(teamId)`:** Polls `/api/teams/:id/timeline` every 4 s.

Events displayed oldest-first (bottom = newest). Same auto-scroll behavior as COMMS.

Each event rendered as `TimelineEvent` showing: timestamp, task subject, owner, old→new status transition with status color coding.

#### HIST — `SessionHistoryView.tsx`

Lead agent session JSONL viewer.

**Filters:**
- Role: `all | user | assistant`
- Kind: toggle set of `text | tool_use | tool_result`
- Tool name: dropdown (only when `tool_use` kind active)
- Full-text search: matches text content, tool names, tool inputs, results

Messages grouped by date with separator. Each `MessageRow` shows role label, timestamp, left color accent, and `EntryBlock` per entry.

**`EntryBlock`** renders three kinds:
- `text` — prose with search highlight.
- `tool_use` — collapsible card with tool name badge + color + JSON input expandable.
- `tool_result` — colored block; error state uses crimson; long results truncated with "show more".

`highlight(text, query)` — splits text and wraps matching substring in `<mark>`.

---

### 5.5 Slide-in Panels

Both panels render as fixed right-side drawers with a semi-transparent backdrop. `Escape` key closes them.

#### `TaskDetailPanel.tsx`

Props: `task, allTasks, members, onClose`

Sections:
- Subject (h2)
- Status badge (uses `getTaskStatus` + `STATUS_COLORS`)
- Description
- Owner (avatar initial + name + agentType)
- Timing (CREATED / UPDATED with `timeAgo` + `fmtDatetime`)
- Dependencies: BLOCKED BY list + BLOCKS list, each with status dot
- Metadata (non-`_internal` entries as key:value rows)

Slide-in animation: `slide-in-right 0.25s ease-out` (defined in `globals.css`).

#### `AgentProfilePanel.tsx`

Props: `member, tasks, teamId, isLead?, sessionStats?, onClose, onPromptSaved?`

Sections:
- Avatar (initial, accent color from `member.color`)
- Identity: agentId, model, backendType, color swatch, planModeRequired, joinedAt, cwd
- **System Prompt editor**: collapsible, inline edit with PATCH `/api/teams/:id/members/:agentName/prompt`. States: view, edit, saving, saved, error.
- Performance: total/done/active task counts + completion progress bar
- Current Work: active task list (amber styling)
- Session Stats: token counts grid (msgs, input tokens, output tokens, cache read, session duration)
- Assigned Tasks: scrollable list with status icons and badges

Active agents get animated border glow and scan-line animation.

---

### 5.6 Utilities

#### `statusColors.ts`

```typescript
type StatusKey = 'completed' | 'in_progress' | 'pending' | 'blocked'

STATUS_COLORS: Record<StatusKey, { text, bg, border }>
```

`getTaskStatus(task, allTasksSimple)` — derives effective status:
- Returns `'blocked'` if `task.status === 'pending'` AND any unfinished `blockedBy` dependency exists.
- Otherwise returns the raw `task.status`.

#### `exportUtils.ts`

| Function | Description |
|---|---|
| `exportGraphAsPng(element)` | Uses `html-to-image` `toPng` to capture the ReactFlow container and download `agent-team-topology.png`. |
| `exportTeamAsJson(teamDetail)` | Downloads `{team}-export.json` with full `TeamDetail`. |
| `exportTasksCsv(teamDetail)` | Downloads CSV with columns: id, subject, status, owner, blockedBy, blocks, createdAt, updatedAt. |
| `exportCommLogCsv(teamId, messages)` | Downloads CSV with columns: id, timestamp, sender, recipient, parsedType, summary, text. |
| `exportTimelineCsv(teamId, events)` | Downloads CSV with columns: id, timestamp, taskId, taskSubject, oldStatus, newStatus, owner. |

#### `agentColors.ts`

`agentColor(name: string) → string` — deterministic hue rotation from agent name hash, returns `hsl(...)` string for consistent per-agent color in COMMS view.

---

## 6. API Reference

All routes prefixed `/api`.

### Teams

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/teams` | — | — | `{teams: TeamSummary[], isDemoMode: boolean}` |
| GET | `/teams/:id` | — | — | `TeamDetail` |
| PATCH | `/teams/:id/members/:agentName/prompt` | — | `{prompt: string}` | `{ok, name, prompt}` |
| GET | `/teams/:id/human-input-status` | — | — | `{teamId, waitingAgents: string[], details: WaitingAgent[]}` |
| GET | `/teams/:id/guide` | — | — | `{teamId, content: string\|null, filename}` |
| GET | `/teams/:id/todos` | — | — | `ProjectTodosResponse` |
| GET | `/teams/:id/session-stats` | — | — | `SessionStatsResponse` |
| GET | `/teams/:id/session-history` | — | — | `SessionHistoryResponse` |
| GET | `/teams/:id/timeline` | — | — | `TimelineResponse` |
| GET | `/teams/:id/messages` | — | — | `CommLogResponse` |
| GET | `/teams/:id/inbox-summary` | — | — | `InboxSummaryResponse` |

### Config

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/config` | — | Current `AppConfig` fields |
| POST | `/config` | `{teamsDir?, tasksDir?, pollIntervalMs?, demoMode?}` | Updated config fields |

### WebSocket

| Path | Protocol |
|---|---|
| `/ws` | `ws://` upgrade of HTTP connection |

**Messages server → client:**

| `type` | Additional fields | Trigger |
|---|---|---|
| `teams_update` | — | Any file change in teamsDir or tasksDir |
| `team_detail_update` | `teamId` | File change detected in specific team subdirectory |
| `ping` | — | Every 30 s keepalive |

---

## 7. Data Flow & Real-time Sync

```
Claude Code agent writes ~/.claude/tasks/{team}/{id}.json
           │
           ▼
fs.watch (server/websocket.ts)
  scheduleTeamDetailUpdate("{team}")  [debounce 300ms]
           │
           ▼
broadcastTeamDetailUpdate("{team}")
  → WebSocket: {type:'team_detail_update', teamId:"{team}"}
           │
           ▼
Client useTeamData.ws.onmessage
  if msg.teamId === selectedTeamId → fetchDetail(teamId)
           │
           ▼
GET /api/teams/{team}
  recordSnapshot(teamId, tasks)  ← updates timeline
  res.json(TeamDetail)
           │
           ▼
React state update → re-render all views
```

**Polling fallback path:** If WebSocket fails, `setInterval(fetchTeams, 2000)` and `setInterval(fetchDetail, 2000)` replace the push path. The header shows POLL indicator instead of LIVE.

**Secondary polls (not WS-driven):**
- Human input status: 10 s
- Inbox summary: 10 s
- Project todos: 10 s
- Session stats: 30 s
- Session history: 30 s
- COMMS messages: 4 s (own poll inside `CommLogView`)
- Timeline events: 4 s (own poll inside `TimelineView`)

---

## 8. Design System

All component styles use inline `style` objects referencing CSS custom properties defined in `globals.css`.

### Color Palette

| Variable | Hex | Usage |
|---|---|---|
| `--phosphor` | `#39ff6a` | Primary accent, completed status, ACTIVE agent glow |
| `--amber` | `#f5a623` | In-progress, warnings, human-input alerts |
| `--crimson` | `#ff3b5c` | Blocked status, errors |
| `--ice` | `#7eb8f7` | Informational, task assignments, ice accents |
| `--void` | `#040608` | Base background |

### Typography

- **Mono:** `JetBrains Mono` — all UI text
- **Display:** `Syne` — headings, logo, agent names

### Status → Color mapping (via `STATUS_COLORS`)

| Status | Text color | Background | Border |
|---|---|---|---|
| `completed` | `--phosphor` | phosphor-glow tint | phosphor-dim |
| `in_progress` | `--amber` | amber-glow tint | amber-dim |
| `pending` | `--text-muted` | surface-2 | border |
| `blocked` | `--crimson` | crimson tint | crimson-dim |

### Keyframe animations (defined in `globals.css`)

| Name | Usage |
|---|---|
| `slide-in-right` | TaskDetailPanel, AgentProfilePanel entrance |
| `fade-up` | Export menu, todo rows, task list items |
| `agent-glow` | Active agent avatar pulse |
| `status-pulse` | Live indicator dots, human-input alerts |
| `spin-slow` | Loading spinner, in-progress todo icon |
| `data-stream` | Active agent panel scan-line |

---

## 9. File System Conventions

The server reads (never writes, except for `PATCH /prompt`):

| Path | Format | Read by |
|---|---|---|
| `~/.claude/teams/{team}/config.json` | `TeamConfig` JSON | `/api/teams`, `/api/teams/:id` |
| `~/.claude/teams/{team}/TEAM_GUIDE.md` | Markdown | `/api/teams/:id/guide` |
| `~/.claude/teams/{team}/inboxes/{agent}.json` | `Array<{from,text,summary,timestamp,color,read}>` | `/api/teams/:id/messages` |
| `~/.claude/tasks/{team}/{taskId}.json` | `Task` JSON | `/api/teams/:id` |
| `~/.claude/todos/{sessionId}-agent-{sessionId}.json` | `TodoItem[]` JSON | `/api/teams/:id/todos` |
| `~/.claude/projects/{cwd-encoded}/{sessionId}.jsonl` | JSONL (Claude journal) | `/api/teams/:id/session-history`, human-input, session-stats |

`cwd-encoded` is the working directory with `/` replaced by `-` (e.g. `/home/user/project` → `-home-user-project`).

Tasks with `metadata._internal === true` are hidden from all API responses.

---

## 10. Demo Mode

**`DEMO_MODE=auto` (default):** Demo data is injected only when no real teams are found in `teamsDir`/`tasksDir`.

**`DEMO_MODE=on`:** Demo data always present alongside real teams.

**`DEMO_MODE=off`:** Demo data never shown.

**Demo team id:** `demo-team` — hardcoded sentinel used in all route handlers to short-circuit file I/O and return `mockData.*` functions.

**`enableDemo()`** (client): POSTs `{demoMode:'on'}` to `/api/config`, selects `demo-team`, refreshes teams list.

**`EmptyState`** component: Shown when no teams detected and demo mode is not active. Offers "Enable Demo" button.

---

## 11. Environment & Configuration

Create `.env` in the project root (see `.env.example`):

```env
TEAMS_DIR=~/.claude/teams
TASKS_DIR=~/.claude/tasks
PORT=3006
POLL_INTERVAL_MS=2000
DEMO_MODE=auto
```

Runtime config can also be mutated via `POST /api/config` (changes are in-memory only; not persisted to `.env`).

---

## 12. Build & Run

### Development

```bash
npm install          # Install all workspace deps
npm run dev          # concurrently: server (tsx watch) + client (vite)
```

- Client: http://localhost:5173
- Server API: http://localhost:3006

### Production build

```bash
npm run build        # vite build (client) + tsc (server)
npm start            # node server/dist/index.js  (serves built client)
```

The server serves the built client from `server/dist/public/` (populated by the client build step via `prepublishOnly`).

### npm package

```bash
npm install -g evo-agent-team
evo-agent-team       # launches server + opens browser
```

The bin entry is `bin/evo-agent-team.js`.
