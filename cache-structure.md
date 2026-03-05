# Claude Code CLI — Cache & State Structure

> A comprehensive technical reference for the `~/.claude/` directory tree.
> Covers every subdirectory, file schema, naming convention, and cross-reference relationship.

---

## Table of Contents

1. [Top-Level Overview](#1-top-level-overview)
2. [projects/ — Conversation History](#2-projects--conversation-history)
3. [teams/ — Team State & Inboxes](#3-teams--team-state--inboxes)
4. [tasks/ — Task Lists](#4-tasks--task-lists)
5. [todos/ — Agent TODO Lists](#5-todos--agent-todo-lists)
6. [agents/ — Role Definitions](#6-agents--role-definitions)
7. [debug/ — Human-Readable Transcripts](#7-debug--human-readable-transcripts)
8. [file-history/ — Edit Snapshots](#8-file-history--edit-snapshots)
9. [skills/ — Reusable Skills](#9-skills--reusable-skills)
10. [Other Directories](#10-other-directories)
11. [Root-Level Files](#11-root-level-files)
12. [Cross-Reference Map](#12-cross-reference-map)
13. [Key Algorithms](#13-key-algorithms)

---

## 1. Top-Level Overview

```
~/.claude/
├── agents/            Agent role definition markdown files
├── backups/           Timestamped .claude.json project config backups
├── cache/             API response cache (Changelog.md etc.)
├── debug/             Plain-text session transcripts (one per session UUID)
├── file-history/      Versioned file snapshots from edit operations
├── history.jsonl      Global user input history (one JSON line per prompt)
├── ide/               IDE integration lock files (one per PID)
├── paste-cache/       Pasted text stored by content hash
├── plans/             Saved execution plan files (.md, named by slug)
├── plugins/           Plugin marketplace registry
├── projects/          Per-project conversation history (main store)
├── session-env/       Per-session environment state (currently empty)
├── settings.json      Global permissions and feature flags
├── shell-snapshots/   Shell state snapshots (.sh files)
├── skills/            Installed skill packs
├── stats-cache.json   Aggregated usage statistics
├── tasks/             Task JSON files per team
├── teams/             Team config, TEAM_GUIDE.md, and inbox messages
├── telemetry/         Failed telemetry event payloads
└── todos/             Per-agent todo lists
```

---

## 2. projects/ — Conversation History

### Directory Naming: CWD Encoding

The `projects/` subdirectory for any project is named by encoding the working directory path:

```
rule: replace every "/" in the cwd with "-"
/data/home/alice/code/my-app  →  -data-home-alice-code-my-app
```

The leading `/` becomes a leading `-`, so all project directory names start with a hyphen.

**Example mapping:**

| CWD | Directory name |
|-----|----------------|
| `/data/home/geminitwang/code/agent-team` | `-data-home-geminitwang-code-agent-team` |
| `/data/home/geminitwang/code/research` | `-data-home-geminitwang-code-research` |
| `/data/home/geminitwang/.claude` | `-data-home-geminitwang--claude` |

### Contents of a Project Directory

```
~/.claude/projects/-data-home-geminitwang-code-agent-team/
├── {sessionId-A}.jsonl                  ← flat session log (flat sessions)
├── {sessionId-B}.jsonl                  ← another flat session
├── {sessionId-C}/                       ← session with subagents/tool-results
│   ├── subagents/
│   │   ├── agent-{shortHash}.jsonl      ← spawned subagent conversation
│   │   └── agent-{shortHash}.jsonl
│   └── tool-results/
│       ├── {randomSlug}.txt             ← large tool output stored externally
│       └── {randomSlug}.txt
├── {sessionId-C}.jsonl                  ← same UUID: the parent session log
└── memory/
    └── MEMORY.md                        ← auto-memory, persists across sessions
```

- A `.jsonl` file at the flat level = a top-level session (one per `sessionId`).
- A same-named subdirectory = the session spawned subagents or had large tool outputs.
- `subagents/{agent-shortHash}.jsonl` = the full conversation log of a spawned child agent.
- `tool-results/{slug}.txt` = large tool outputs referenced by the session log instead of inlined.
- `memory/MEMORY.md` = persistent auto-memory for the session's project.

### Session File Classification

Not every `.jsonl` in the project directory is a real conversation. Three distinct classes:

| Class | JSONL size | First record type | Meaning |
|-------|-----------|-------------------|---------|
| **Lead session** | Large (non-zero) | `user` or `assistant` | The team lead's full conversation |
| **In-process sub-agent** | **0 bytes** | — (empty file) | Spawned teammate; conversation stored in `{sessionId}/subagents/` instead |
| **Tool artifact** | Small (< 2 KB) | `file-history-snapshot` | Side-effect of a tool operation, not a real session |

To identify real sessions to scan for todos or token usage:
- 0-byte JSONL → **real in-process agent** (include it)
- Non-zero JSONL, first record type ≠ `file-history-snapshot` → **real session** (include it)
- Non-zero JSONL, first record type = `file-history-snapshot` → **artifact** (skip it)

### JSONL Record Schema

Each line in a `.jsonl` file is a standalone JSON object. Six record types:

#### `file-history-snapshot` — Checkpoint of tracked file edits
```json
{
  "type": "file-history-snapshot",
  "messageId": "9492c1c7-...",
  "snapshot": {
    "messageId": "...",
    "trackedFileBackups": {},
    "timestamp": "2026-03-04T08:18:37.115Z"
  },
  "isSnapshotUpdate": false
}
```
These appear at the top of artifact-only files and interspersed in real sessions.

#### `user` — Human prompt or tool result delivery

**Variant A — plain text prompt:**
```json
{
  "type": "user",
  "message": { "role": "user", "content": "please help me create a team..." },
  "parentUuid": null,
  "uuid": "7ce6e5c0-...",
  "timestamp": "2026-03-04T05:24:55.370Z",
  "sessionId": "ad2c55f0-...",
  "cwd": "/data/home/geminitwang/code/research",
  "version": "2.1.66",
  "gitBranch": "HEAD",
  "isSidechain": false,
  "userType": "external",
  "permissionMode": "default"
}
```

**Variant B — tool result (response to an assistant tool_use):**
```json
{
  "type": "user",
  "message": {
    "role": "user",
    "content": [
      {
        "type": "tool_result",
        "tool_use_id": "toolu_bdrk_01CDSA7...",
        "content": "File does not exist.",
        "is_error": true
      }
    ]
  },
  "parentUuid": "4d5cca14-...",
  "uuid": "b012de4f-...",
  "timestamp": "2026-03-04T05:24:59.197Z",
  "toolUseResult": "Error: File does not exist.",
  "sourceToolAssistantUUID": "4d5cca14-..."
}
```

`toolUseResult` duplicates the result as a plain string for quick access.
`sourceToolAssistantUUID` points to the `assistant` record that issued the tool_use.
`isMeta: true` marks local commands or system-injected messages.
`isSidechain: true` marks messages in a spawned agent's bootstrap context.

#### `assistant` — Model response (text and/or tool calls)

**Variant A — tool call only (`stop_reason: "tool_use"`):**
```json
{
  "type": "assistant",
  "message": {
    "id": "msg_1772601897726",
    "type": "message",
    "role": "assistant",
    "model": "claude-sonnet-4-6",
    "content": [
      {
        "type": "tool_use",
        "id": "toolu_bdrk_01CDSA7fmwQDRurb75BYjduZ",
        "name": "Read",
        "input": { "file_path": "/path/to/file" }
      }
    ],
    "stop_reason": "tool_use",
    "stop_sequence": null,
    "usage": {
      "input_tokens": 24624,
      "output_tokens": 86,
      "cache_read_input_tokens": 0,
      "cache_creation_input_tokens": 0,
      "server_tool_use": { "web_search_requests": 0, "web_fetch_requests": 0 },
      "service_tier": "standard",
      "cache_creation": {
        "ephemeral_1h_input_tokens": 0,
        "ephemeral_5m_input_tokens": 0
      },
      "speed": "standard"
    }
  },
  "parentUuid": "7ce6e5c0-...",
  "uuid": "4d5cca14-...",
  "timestamp": "2026-03-04T05:24:59.169Z",
  "cwd": "/data/home/geminitwang/code/research",
  "sessionId": "ad2c55f0-...",
  "version": "2.1.66",
  "slug": "piped-percolating-panda",
  "isSidechain": false,
  "userType": "external"
}
```

**Variant B — text only (`stop_reason: null`, streaming chunk):**
```json
{
  "type": "assistant",
  "message": {
    "id": "msg_1772601905060",
    "role": "assistant",
    "content": [
      { "type": "text", "text": "I'll create a comprehensive multi-agent team..." }
    ],
    "stop_reason": null,
    "usage": { "input_tokens": 0, "output_tokens": 0 }
  },
  "uuid": "9f994310-...",
  "timestamp": "2026-03-04T05:25:06.118Z"
}
```
Note: streaming chunks often have `input_tokens: 0, output_tokens: 0` — only the final chunk in a turn carries the real token counts.

**`message.content[]` block types:**

| Block type | Role | Key fields |
|-----------|------|-----------|
| `text` | Assistant prose | `text: string` |
| `tool_use` | Tool invocation | `id`, `name`, `input: object` |
| `tool_result` | Tool output (in `user` records) | `tool_use_id`, `content`, `is_error` |

**`message.usage` fields:**

| Field | Description |
|-------|-------------|
| `input_tokens` | Tokens in the prompt sent to the model |
| `output_tokens` | Tokens generated by the model |
| `cache_read_input_tokens` | Prompt tokens served from cache |
| `cache_creation_input_tokens` | Prompt tokens written to cache |
| `cache_creation.ephemeral_1h_input_tokens` | Tokens cached with 1-hour TTL |
| `cache_creation.ephemeral_5m_input_tokens` | Tokens cached with 5-minute TTL |
| `server_tool_use.web_search_requests` | Server-side web searches used |
| `speed` | `"standard"` \| `"fast"` |

**Blocking-tool detection:** An agent is blocked on human confirmation when the *last* `tool_use` in the conversation has no matching `tool_result`. Blocking tools include: `AskUserQuestion`, `Bash`, `Edit`, `Write`, `NotebookEdit`.

#### `system` — Hook summary or stop event
```json
{
  "type": "system",
  "subtype": "stop_hook_summary",
  "hookCount": 1,
  "hookInfos": [{ "command": "callback" }],
  "hookErrors": [],
  "preventedContinuation": false,
  "stopReason": "",
  "hasOutput": false,
  "level": "suggestion",
  "parentUuid": "...",
  "uuid": "...",
  "timestamp": "2026-03-05T05:22:21.695Z",
  "toolUseID": "0689c1ed-..."
}
```
Emitted after hook execution. `subtype` values include `stop_hook_summary`, `local_command`.

#### `progress` — Hook progress notification
```json
{
  "type": "progress",
  "data": {
    "type": "hook_progress",
    "hookEvent": "PostToolUse",
    "hookName": "PostToolUse:Read",
    "command": "callback"
  },
  "parentUuid": "...",
  "parentToolUseID": "toolu_bdrk_01Gwn...",
  "toolUseID": "toolu_bdrk_01Gwn...",
  "teamName": "ml-paper-team",
  "uuid": "...",
  "timestamp": "2026-03-04T05:25:19.565Z"
}
```
Fired during hook execution. Can be safely ignored when parsing conversation history.

#### `queue-operation` — Message queue event
```json
{
  "type": "queue-operation",
  "operation": "dequeue",
  "timestamp": "2026-03-04T11:27:50.782Z",
  "sessionId": "ad2c55f0-..."
}
```
Tracks inbox message delivery. `operation` is `"enqueue"` or `"dequeue"`.

### Common Fields on All Records

| Field | Description |
|-------|-------------|
| `uuid` | Unique ID for this record (v4 UUID) |
| `parentUuid` | Links records into conversation tree; `null` for the root message |
| `timestamp` | ISO 8601 datetime |
| `sessionId` | UUID of the session this record belongs to |
| `cwd` | Working directory at the time of the record |
| `version` | CLI version string (e.g., `"2.1.66"`) |
| `gitBranch` | Git branch name at the time (e.g., `"HEAD"`, `"main"`) |
| `slug` | Human-readable session name slug (e.g., `"piped-percolating-panda"`) |
| `isSidechain` | `true` for records in a spawned/sidechain context |
| `isMeta` | `true` for local commands and system-injected messages |
| `userType` | `"external"` for normal sessions |
| `teamName` | Present on `progress` records when session is part of a team |

### Subagent JSONL Schema

Files under `{sessionId}/subagents/agent-{shortHash}.jsonl` follow the same record format but with additional fields:

```json
{
  "parentUuid": null,
  "isSidechain": true,
  "userType": "external",
  "cwd": "/data/home/geminitwang/code/research",
  "sessionId": "ad2c55f0-...",
  "agentId": "ad72ca8af91937900",
  "slug": "piped-percolating-panda",
  "type": "user",
  "message": {
    "role": "user",
    "content": "<teammate-message teammate_id=\"team-lead\" summary=\"...\">You are joining the ml-paper-team...</teammate-message>"
  }
}
```

Key differences from the parent session:
- `isSidechain: true` on all records
- `agentId` field present (short hex hash, not a UUID)
- `sessionId` refers to the **parent** session, not a unique ID for the subagent
- First `user` message contains `<teammate-message>` XML with the agent's bootstrap prompt
- Filename uses a short hash (e.g., `agent-ad72ca8af91937900.jsonl`), not a UUID

### tool-results/ Directory

Large tool outputs that would bloat the JSONL are stored externally:

```
{sessionId}/tool-results/
├── toolu_bdrk_01C8zDZeUjqcKpSMLA4zLz5x.txt   ← named by tool_use_id
└── toolu_bdrk_013SyK6ke6RA8w6maVqYofKh.txt
```

- Filename = `tool_use_id` of the corresponding `tool_use` block
- Content = raw tool output (JSON, text, etc.)
- Referenced implicitly; the JSONL `tool_result` block may contain only a truncated version

---

## 3. teams/ — Team State & Inboxes

### Directory Structure

```
~/.claude/teams/
└── {teamName}/
    ├── config.json          ← Team and member configuration
    ├── TEAM_GUIDE.md        ← Optional: Team instructions/context (may not exist)
    └── inboxes/
        ├── {agentName}.json ← Message inbox for each agent
        └── ...
```

### config.json Schema

```json
{
  "name": "ml-paper-team",
  "description": "...",
  "createdAt": 1772601907265,
  "leadAgentId": "team-lead@ml-paper-team",
  "leadSessionId": "ad2c55f0-9016-49a7-84cf-965af0ee510a",
  "members": [
    {
      "agentId": "team-lead@ml-paper-team",
      "name": "team-lead",
      "agentType": "paper-director",
      "model": "claude-opus-4-6",
      "joinedAt": 1772601907265,
      "tmuxPaneId": "",
      "cwd": "/data/home/geminitwang/code/research",
      "subscriptions": []
    },
    {
      "agentId": "literature-analyst@ml-paper-team",
      "name": "literature-analyst",
      "agentType": "general-purpose",
      "model": "claude-opus-4-6",
      "prompt": "You are joining the ml-paper-team as the Literature Analyst...",
      "color": "blue",
      "planModeRequired": false,
      "joinedAt": 1772602339739,
      "tmuxPaneId": "in-process",
      "cwd": "/data/home/geminitwang/code/research",
      "subscriptions": [],
      "backendType": "in-process"
    }
  ]
}
```

**Key fields:**

| Field | Description |
|-------|-------------|
| `leadSessionId` | Session UUID of the team lead — **primary cross-reference key** |
| `leadAgentId` | `{name}@{teamName}` format |
| `members[].agentId` | `{name}@{teamName}` |
| `members[].name` | Short name used everywhere (inbox files, task ownership) |
| `members[].cwd` | Working directory; used to compute `cwdToProjectDir()` |
| `members[].tmuxPaneId` | `""` for lead; `"in-process"` for in-process spawned agents |
| `members[].backendType` | `"in-process"` for spawned agents; absent for lead |
| `members[].prompt` | Full bootstrap prompt (absent from lead) |
| `members[].color` | Display color for UI |
| `members[].planModeRequired` | Boolean; if true, agent must use plan mode |

### Inbox File Schema

Path: `~/.claude/teams/{teamName}/inboxes/{agentName}.json`

Content: JSON array of message objects.

```json
[
  {
    "from": "literature-analyst",
    "text": "Role definition and team guide read. Ready to survey related work.",
    "summary": "Literature Analyst ready for tasks",
    "timestamp": "2026-03-04T05:32:26.455Z",
    "color": "blue",
    "read": true
  },
  {
    "from": "methods-writer",
    "text": "{\"type\":\"idle_notification\",\"from\":\"methods-writer\",\"timestamp\":\"...\",\"idleReason\":\"available\"}",
    "timestamp": "...",
    "color": "green",
    "read": true
  }
]
```

| Field | Description |
|-------|-------------|
| `from` | Sender agent name |
| `text` | Message body — plain text, OR JSON-encoded notification (check for `{` prefix) |
| `summary` | Optional short label |
| `timestamp` | ISO 8601 |
| `color` | Sender's display color |
| `read` | `true` once the recipient has processed it |

Special message types encoded in `text` as JSON:
- `idle_notification` — `{ type, from, timestamp, idleReason: "available"|"waiting" }`
- `shutdown_request` — `{ type, requestId, from, ... }`
- `plan_approval_request` — `{ type, requestId, planContent, ... }`

---

## 4. tasks/ — Task Lists

### Directory Structure

```
~/.claude/tasks/
├── {teamName}/
│   ├── 1.json
│   ├── 2.json
│   ├── ...
│   ├── N.json
│   ├── .highwatermark    ← 1-byte file; stores the highest assigned task ID
│   └── .lock             ← 0-byte advisory lock
└── {sessionId}/          ← Orphaned/temporary task contexts (rare)
    ├── .highwatermark
    └── .lock
```

Tasks are numbered starting from 1. Each file is an independent task object.

### Task File Schema (`N.json`)

```json
{
  "id": "3",
  "subject": "Implement WebSocket real-time sync",
  "description": "Full description of the task and acceptance criteria...",
  "activeForm": "Implementing WebSocket sync",
  "status": "completed",
  "owner": "backend-dev",
  "blockedBy": [],
  "blocks": ["5"],
  "createdAt": 1772612000000,
  "updatedAt": 1772615000000
}
```

| Field | Description |
|-------|-------------|
| `id` | Numeric string matching the filename |
| `subject` | Imperative title |
| `description` | Full task description with context |
| `activeForm` | Present-continuous label shown while in-progress |
| `status` | `"pending"` \| `"in_progress"` \| `"completed"` \| `"deleted"` |
| `owner` | Agent name string (matches `config.json` member names) |
| `blockedBy` | Array of task ID strings that must complete first |
| `blocks` | Array of task ID strings that this task unblocks |

---

## 5. todos/ — Agent TODO Lists

### File Naming Convention

```
~/.claude/todos/{sessionId}-agent-{sessionId}.json
```

**Both halves of the filename are the same UUID** (the agent's session ID). The `-agent-` literal separates them.

```
ad2c55f0-9016-49a7-84cf-965af0ee510a-agent-ad2c55f0-9016-49a7-84cf-965af0ee510a.json
└─────────────── sessionId ───────────────┘       └─────────────── sessionId ───────────────┘
```

To extract the session ID from a todo filename:
```
split on "-agent-" → take the first half
```

### Relationship to projects/ sessions

Todos are **project-scoped** (by cwd), not agent-scoped. Any session running in the same project directory can write a todo file. The session ID is the only key.

To find todos for a team:
1. Use `leadSessionId` from `config.json` as a direct anchor (always include it)
2. Scan `projects/{cwdToProjectDir(memberCwd)}/` for additional real sessions (0-byte JSONL or non-snapshot first record)
3. For each session ID found, check `todos/{sessionId}-agent-{sessionId}.json`

In-process sub-agents (0-byte JSONL) **do** write todo files — their todos are the primary signal of their current work, since their JSONL is empty.

### Todo File Schema

Content: JSON array of todo items.

```json
[
  {
    "content": "Implement WebSocket server endpoint",
    "status": "completed",
    "activeForm": "Implementing WebSocket endpoint"
  },
  {
    "content": "Add real-time client hook",
    "status": "in_progress",
    "activeForm": "Adding useTeamData WebSocket hook"
  },
  {
    "content": "Write integration tests",
    "status": "pending"
  }
]
```

| Field | Description |
|-------|-------------|
| `content` | The todo item text |
| `status` | `"pending"` \| `"in_progress"` \| `"completed"` |
| `activeForm` | Optional present-continuous label (shown while in-progress) |

Most todo files contain `[]` (empty array) — the file is created on session start regardless of whether the agent uses `TodoWrite`.

---

## 6. agents/ — Role Definitions

```
~/.claude/agents/
├── citation-verifier.md
├── experiments-analyst.md
├── latex-engineer.md
├── literature-analyst.md
├── methods-writer.md
├── research-director.md
└── writing-editor.md
```

Each file is a Markdown document defining the role, capabilities, and behavioral guidelines for an agent type. These are injected as context when an agent of that type is spawned. They correspond to `agentType` values in `config.json` members.

---

## 7. debug/ — Human-Readable Transcripts

```
~/.claude/debug/
├── {sessionId-A}.txt      ← plain-text rendering of session A
├── {sessionId-B}.txt
├── ...
└── latest -> {mostRecent}.txt   ← symlink to most recent file
```

Files range from ~100 bytes (empty sessions) to 124 MB (long sessions). These are plain-text, human-readable renderings of the full conversation including tool calls and results. Useful for debugging without parsing JSONL.

---

## 8. file-history/ — Edit Snapshots

```
~/.claude/file-history/
└── {sessionId}/
    ├── {contentHash}@v1    ← first version of a file (no extension)
    ├── {contentHash}@v2    ← second version
    └── ...
```

Stores versioned backups of files edited during a session. Enables undo/redo. Files are named by content hash + version number with no extension. Referenced from `file-history-snapshot` records in the session `.jsonl`.

---

## 9. skills/ — Reusable Skills

```
~/.claude/skills/
├── find-skills/
├── frontend-design/
├── ml-paper-writing/
├── remotion-best-practices/
├── research-paper-writer/
├── scientific-paper-figure-generator/
├── skill-creator/
└── vercel-react-best-practices/
```

Each subdirectory is an installed skill pack. Skills are invoked with `/skill-name` in the CLI or via the `Skill` tool. New skills are installed from the plugin marketplace or created with `skill-creator`.

---

## 10. Other Directories

### backups/
Timestamped backups of `.claude.json` (project-level config file):
```
~/.claude.json.backup.{epochMs}
```
Multiple backups may exist per day.

### ide/
One lock file per running IDE integration process:
```
~/.claude/ide/{pid}.lock
```
Content:
```json
{
  "pid": 2431095,
  "workspaceFolders": ["/data/home/geminitwang/.claude/teams"],
  "ideName": "Visual Studio Code",
  "transport": "ws",
  "runningInWindows": false,
  "authToken": "..."
}
```

### plugins/
Plugin marketplace registry:
```
~/.claude/plugins/
├── known_marketplaces.json    ← installed marketplace URLs
├── blocklist.json             ← blocked plugin identifiers
└── marketplaces/              ← marketplace data cache
```

### paste-cache/
Pasted text stored by content hash for reuse:
```
~/.claude/paste-cache/{contentHash}.txt
```

### plans/
Saved execution plan files, named by human-readable slug:
```
~/.claude/plans/snazzy-knitting-bachman.md
```

### shell-snapshots/
Shell state snapshots for context restoration:
```
~/.claude/shell-snapshots/snapshot-bash-{epochMs}-{random}.sh
```

### telemetry/
Failed telemetry event payloads buffered for retry:
```
~/.claude/telemetry/1p_failed_events.{uuid1}.{uuid2}.json
```

---

## 11. Root-Level Files

### settings.json
Global user permissions and feature flags:
```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  },
  "permissions": {
    "allow": ["Bash(mkdir:*)", "Write(*)", "Bash(git:*)", ...],
    "deny": []
  }
}
```

Permission rules use the format `ToolName(prefix:*)` to grant specific commands.

### history.jsonl
Global input history — one JSON line per user prompt submission:
```json
{ "display": "npm run dev", "pastedContents": {}, "timestamp": 1772555838056, "project": "/data/home/...", "sessionId": "27f23f0d-..." }
```

### stats-cache.json
Aggregated usage statistics:
```json
{
  "version": 1,
  "lastComputedDate": "2026-03-03",
  "dailyActivity": [{ "date": "...", "messageCount": 996, "sessionCount": 7, "toolCallCount": 353 }],
  "dailyModelTokens": [{ "date": "...", "tokensByModel": { "claude-sonnet-4-6": 24532786 } }],
  "modelUsage": { "claude-sonnet-4-6": { "inputTokens": 24373098, "outputTokens": 159688 } },
  "totalSessions": 7,
  "totalMessages": 996,
  "longestSession": { "sessionId": "...", "duration": 52498698, "messageCount": 654 }
}
```

---

## 12. Cross-Reference Map

This diagram shows how the key files reference each other:

```
teams/{teamName}/config.json
│
├── leadSessionId ──────────────────────────────────────────────────────┐
│                                                                        │
├── members[].cwd  ──→  cwdToProjectDir()  ──→  projects/{dir}/         │
│                                               ├── {leadSessionId}.jsonl  ◄─┘
│                                               ├── {subAgent1}.jsonl   (0 bytes = in-process)
│                                               ├── {artifact}.jsonl    (file-history-snapshot only, skip)
│                                               ├── {leadSessionId}/
│                                               │   ├── subagents/agent-{hash}.jsonl
│                                               │   └── tool-results/{toolUseId}.txt
│                                               └── memory/MEMORY.md
│
├── members[].name ──→  tasks/{teamName}/{N}.json (owner field)
│                   ──→  teams/{teamName}/inboxes/{name}.json
│
└── leadAgentId  ──→  "{name}@{teamName}" → extract name with split('@')[0]

projects/{dir}/{leadSessionId}.jsonl
│
├── assistant.message.content[].tool_use (name="Agent")
│   └── id ──→  subagents/agent-{hash}.jsonl parentToolUseID
│                                                 └── confirms teammate name mapping
│
└── assistant.message.usage ──→  token counts (input, output, cache_read, cache_creation)

todos/{sessionId}-agent-{sessionId}.json
│
└── sessionId ──→  any real session in projects/{dir}/
                   (lead, in-process sub-agent, or standalone session in same cwd)
```

### Summary of Key Cross-References

| Source | Field | Points To |
|--------|-------|-----------|
| `teams/{team}/config.json` | `leadSessionId` | `projects/{cwdEncoded}/{leadSessionId}.jsonl` |
| `teams/{team}/config.json` | `members[].cwd` | `projects/{cwdToProjectDir(cwd)}/` (all sessions) |
| `teams/{team}/config.json` | `leadAgentId` | extract name: `.split('@')[0]` |
| `teams/{team}/config.json` | `members[].name` | `tasks/{team}/{N}.json` → `owner` field |
| `teams/{team}/config.json` | `members[].name` | `teams/{team}/inboxes/{name}.json` |
| `projects/{dir}/{id}.jsonl` | `tool_use.id` | `tool_result.tool_use_id` (same file) |
| `projects/{dir}/{id}.jsonl` | `Agent` tool_use `id` | `{sessionId}/subagents/agent-{hash}.jsonl` → `parentToolUseID` |
| `projects/{dir}/{id}/subagents/*.jsonl` | `parentToolUseID` | parent session `Agent` tool_use → agent name |
| `projects/{dir}/{id}/tool-results/{toolId}.txt` | filename | `tool_use.id` in session JSONL |
| `todos/{sessionId}-agent-*.json` | filename prefix | `projects/{dir}/{sessionId}.jsonl` |
| `tasks/{team}/{N}.json` | `blockedBy`, `blocks` | other `tasks/{team}/{M}.json` |

---

## 13. Key Algorithms

### cwdToProjectDir(cwd: string): string
Convert a working directory path to its `projects/` subdirectory name:
```typescript
function cwdToProjectDir(cwd: string): string {
  return cwd.replace(/\//g, '-');
  // "/data/home/alice/myapp" → "-data-home-alice-myapp"
}
```

### Find a session's project directory
```typescript
const projectDir = path.join(os.homedir(), '.claude', 'projects', cwdToProjectDir(memberCwd));
// Read .jsonl files from this directory to find sessions
```

### Parse a todo filename to extract sessionId
```typescript
function parseTodoFilename(fname: string): string | null {
  const m = fname.match(/^([0-9a-f-]{36})-agent-[0-9a-f-]{36}\.json$/);
  return m ? m[1] : null;  // returns the sessionId
}
```

### Detect a blocked agent (awaiting human confirmation)
Scan the `.jsonl` from the end. The agent is blocked if the **last** `tool_use` entry has no matching `tool_result`:

```typescript
const BLOCKING_TOOLS = new Set(['AskUserQuestion', 'Bash', 'Edit', 'Write', 'NotebookEdit']);

async function getBlockingCall(sessionFile: string): Promise<BlockingCall | null> {
  const lines = (await fs.readFile(sessionFile, 'utf-8')).trim().split('\n');
  let lastToolUse: { id: string; name: string; input: any } | null = null;
  const answeredIds = new Set<string>();

  for (const line of lines) {
    const record = JSON.parse(line);
    for (const item of record?.message?.content ?? []) {
      if (item.type === 'tool_use' && BLOCKING_TOOLS.has(item.name)) {
        lastToolUse = item;
      }
      if (item.type === 'tool_result') {
        answeredIds.add(item.tool_use_id);
      }
    }
  }

  if (lastToolUse && !answeredIds.has(lastToolUse.id)) {
    return { toolName: lastToolUse.name, detail: JSON.stringify(lastToolUse.input) };
  }
  return null;
}
```

### Infer agent name from session ID (two-pass)

**Pass 1 — TaskUpdate/TaskCreate owner field:**
```typescript
// Scan the session JSONL for TaskUpdate or TaskCreate tool_use
// that contains an "owner" field matching a known member name
for (const line of jsonlLines) {
  const record = JSON.parse(line);
  for (const item of record?.message?.content ?? []) {
    if (item.type === 'tool_use' && ['TaskUpdate', 'TaskCreate'].includes(item.name)) {
      const owner = item.input?.owner;
      if (owner && memberNames.includes(owner)) return owner;
    }
  }
}
```

**Pass 2 — parentToolUseID cross-reference:**
```typescript
// Each spawned session's first few records contain a parentToolUseID
// that matches the tool_use.id of the Agent() call in the lead session
const parentToolUseId = extractParentToolUseId(sessionFirstLines);

// Scan the lead session for an Agent tool_use with this id
for (const line of leadSessionLines) {
  const record = JSON.parse(line);
  for (const item of record?.message?.content ?? []) {
    if (item.type === 'tool_use' && item.name === 'Agent' && item.id === parentToolUseId) {
      return item.input?.name;  // the agent name
    }
  }
}
```

---

## Appendix: Quick Reference Cheat Sheet

```
Given a team name:
  config         → ~/.claude/teams/{team}/config.json
  guide          → ~/.claude/teams/{team}/TEAM_GUIDE.md
  inboxes        → ~/.claude/teams/{team}/inboxes/{agentName}.json
  tasks          → ~/.claude/tasks/{team}/{N}.json

Given leadSessionId + memberCwd (from config.json):
  lead JSONL     → ~/.claude/projects/{cwdToProjectDir(cwd)}/{leadSessionId}.jsonl
  lead todos     → ~/.claude/todos/{leadSessionId}-agent-{leadSessionId}.json
  session history → read lead JSONL, filter type=user|assistant

Given a member cwd (from config.json members[]):
  project dir    → ~/.claude/projects/{cwdToProjectDir(cwd)}/
  real sessions  → *.jsonl files where: size=0 OR first record type ≠ file-history-snapshot
  all todos      → todos/{sessionId}-agent-{sessionId}.json for each real session

Given a session directory (for sessions with subagents):
  subagents      → {sessionId}/subagents/agent-{shortHash}.jsonl
  large outputs  → {sessionId}/tool-results/{toolUseId}.txt
  debug view     → ~/.claude/debug/{sessionId}.txt
  file edits     → ~/.claude/file-history/{sessionId}/
  auto-memory    → projects/{cwdEncoded}/memory/MEMORY.md

CWD encoding:
  replace all "/" with "-"
  "/foo/bar/baz" → "-foo-bar-baz"

Session classification:
  0-byte JSONL                          → in-process sub-agent (real, has todos)
  non-zero, first record = user|asst    → real interactive session
  non-zero, first record = file-history → tool artifact (skip)
```
