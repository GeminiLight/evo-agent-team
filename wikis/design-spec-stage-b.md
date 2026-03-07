# evo-agent-team · Stage B 设计规格

> **版本：** v1.0 · 2026-03-07
> **阶段目标：** 从"能看"升级到"看得懂"。让用户在 2 分钟内掌握团队全局状况，系统主动识别问题而非等用户发现。
> **架构约束：** 纯只读。仅读取 `~/.claude/` 文件，不做任何写操作。
> **AI 依赖：** B1 用 🟡 基础 AI（可降级），其余全部 🟢 无 AI。

---

## 目录

- [B1 — 执行摘要](#b1--执行摘要)
- [B2 — 智能告警与瓶颈检测](#b2--智能告警与瓶颈检测)
- [B3 — 跨 Agent 会话浏览](#b3--跨-agent-会话浏览)
- [B4 — 成本分析面板](#b4--成本分析面板)
- [实现顺序建议](#实现顺序建议)
- [受影响的文件索引](#受影响的文件索引)

---

## B1 — 执行摘要

> `🟡 基础 AI` · P0 · 对应场景：晨会检查

### 用户场景

团队跑了一晚上，早上打开 Dashboard，想在 2 分钟内知道：做了什么、卡在哪里、关键决策是什么。

### 核心交互

MATRIX 视图 TeamOverview 卡片下方新增折叠式"EXEC SUMMARY"子卡片。默认展开（含数据时），支持手动折叠并记住折叠状态（localStorage）。顶部展示生成时间 + 手动刷新按钮。

```
┌─────────────────────────────────────────────────────────┐
│  SYS // OVERVIEW                         [GUIDE] [▼]    │
│  ████████████░░░░░░  8/12 tasks  |  IN 142K OUT 38K     │
│  ─────────────────────────────────────────────────────  │
│  EXEC SUMMARY  generated 3m ago  [↻ REFRESH]  [▲ fold]  │
│                                                         │
│  ✓ COMPLETED (4)                                        │
│    · architect 完成了数据库 schema 设计，已提交 PR #42   │
│    · backend 实现了 /api/users CRUD，含单元测试          │
│                                                         │
│  ⚠ BLOCKED (2)                                          │
│    · frontend 等待 backend 提供 OpenAPI spec（卡 23m）  │
│    · tester 的 e2e 测试因环境配置失败，需要人工确认       │
│                                                         │
│  ◆ DECISIONS                                            │
│    · 选择 PostgreSQL 而非 MongoDB（架构师建议）          │
│    · 推迟 Redis 集成到 v2（避免增加当前复杂度）          │
│                                                         │
│  TOKEN  IN 142K  OUT 38K  CACHE 67K  ~$0.84 est.        │
└─────────────────────────────────────────────────────────┘
```

**两种摘要模式：**

| 模式 | 触发条件 | 内容 |
|------|----------|------|
| AI 摘要 | LLM 可用 + 有 leadSessionId | 结构化自然语言，含决策和风险分析 |
| 规则摘要（降级）| LLM 不可用 / 无 leadSessionId | 纯统计：完成率、活跃 Agent、最近 5 条事件 |

### 后端设计

#### 新增文件：`server/src/summaryEngine.ts`

```typescript
export interface TeamSummary {
  teamId: string;
  summary: SummaryContent;
  generatedAt: string;          // ISO timestamp
  isAIGenerated: boolean;
  isStale: boolean;             // 数据变更后标记，下次请求触发重建
}

export interface SummaryContent {
  completed: SummaryItem[];     // 已完成任务摘要
  blocked: BlockedItem[];       // 当前阻塞点
  decisions: string[];          // 关键决策
  tokenOverview: TokenOverview;
}

interface SummaryItem { taskId: string; subject: string; detail?: string; }
interface BlockedItem { agentOrTask: string; reason: string; duration?: string; }
interface TokenOverview { inputTokens: number; outputTokens: number; cacheReadTokens: number; estimatedUsdCents?: number; }
```

**缓存策略：**
- 模块级 `Map<teamId, TeamSummary>` 缓存，服务端进程内存中
- 每次 `/api/teams/:id` 响应时，若任务状态发生变化则将该团队摘要标记为 `isStale: true`
- `GET /api/teams/:id/summary` 请求时：若 `isStale` 或无缓存，重新生成

**规则摘要生成（无 AI 降级）：**
从已有的 `TeamDetail`（tasks、stats）和 `AgentSessionStats` 中构建：
- `completed`：取所有 `status === 'completed'` 的任务，从任务 subject 中提取
- `blocked`：取所有 `status === 'pending'` 且 `blockedBy` 非空、被 `in_progress` 任务阻塞的任务；以及超过 5 分钟无更新的 `in_progress` 任务
- `decisions`：空（规则摘要不产出）
- `tokenOverview`：直接从 `AgentSessionStats` 聚合

**AI 摘要生成：**
从 `leadSessionId.jsonl` 中提取最近 200 条 `assistant` text 记录和所有 `TaskUpdate` 工具调用，拼成 prompt，调用 `ANTHROPIC_API_KEY`（读自 `.env` / 环境变量）。

Prompt 框架：
```
You are summarizing an AI agent team's work session for a developer review.
Given the session transcript excerpt and task status, produce a JSON summary with:
- completed: list of completed tasks with 1-sentence detail
- blocked: current blockers with root cause
- decisions: architectural or significant choices made
- risks: anything that might require human attention
Keep each item under 20 words. Respond ONLY with valid JSON.

--- TASK STATUS ---
{tasksJson}

--- RECENT TRANSCRIPT (last 200 assistant turns) ---
{transcriptExcerpt}
```

#### 新增 API 端点

```
GET /api/teams/:id/summary
Response 200:
{
  "teamId": "my-team",
  "summary": { "completed": [...], "blocked": [...], "decisions": [...], "tokenOverview": {...} },
  "generatedAt": "2026-03-07T08:32:10Z",
  "isAIGenerated": true,
  "isStale": false
}

POST /api/teams/:id/summary/refresh
Response 200: same shape, isStale: false (forces regeneration)
```

#### 修改：`server/src/routes/teams.ts`
- 注册上述两条路由
- 在现有 `GET /api/teams/:id` 返回后，调用 `markSummaryStale(teamId)` 若任务列表有变化

### 前端设计

#### 新增文件：`client/src/hooks/useSummary.ts`

轮询 `GET /api/teams/:id/summary`，间隔 30 秒（摘要不需要实时更新）。暴露 `{ data, loading, refresh }` — `refresh` 调用 POST 端点。

#### 修改：`client/src/components/dashboard/TeamOverview.tsx`

在现有 SESSION 统计行下方插入 `<ExecSummary summary={data} loading={loading} onRefresh={refresh} />` 子组件（同文件内定义）。

**ExecSummary 视觉规格：**
- 顶部分隔线 + "EXEC SUMMARY" 标签（同 SESSION 行风格：8px mono uppercase muted）
- 右侧：`generated Xm ago` + `↻ REFRESH` 按钮 + `▲/▼ fold` 按钮
- 折叠状态存 `localStorage('exec-summary-collapsed-{teamId}')`
- 三个区块：COMPLETED（`var(--phosphor)`）、BLOCKED（`var(--amber)`）、DECISIONS（`var(--ice)`）
- 每条 item 展示为小行，icon + 文字，最多 3 条；超出时 "... N more" 可展开
- AI 摘要时右上角展示 "AI" 小徽章；规则摘要时展示 "RULE-BASED"
- 加载中：CRT 风格 "GENERATING..." 动画文字
- 无数据时：不渲染整个区块（不展示空状态）

### 验收标准

- [ ] 摘要卡片在 MATRIX 视图 TeamOverview 内展示，支持折叠，折叠状态持久化
- [ ] LLM 可用时在 10 秒内生成 AI 摘要（含 API 调用）
- [ ] LLM 不可用时自动降级为规则摘要（无错误抛出）
- [ ] 手动刷新按钮有效，刷新中按钮显示加载状态
- [ ] 无 `ANTHROPIC_API_KEY` 时静默降级，不在 UI 展示任何错误
- [ ] Demo 模式下展示合成摘要数据

---

## B2 — 智能告警与瓶颈检测

> `🟢 无 AI` · P0 · 对应场景：紧急干预

### 用户场景

团队有 5 个 Agent 并行工作，其中一个已经卡住 10 分钟了，用户完全没注意到。

### 核心交互

MATRIX 视图 TeamOverview 卡片**上方**插入可关闭的告警横幅区域。告警按严重度排序，可逐条关闭（`sessionStorage` 记住已关闭的告警 ID，刷新后恢复）。

```
┌─────────────────────────────────────────────────────────┐
│ ██ CRITICAL  frontend 已卡住 23 分钟，无工具调用   [→] [×]│
│ ▲  WARNING   tester 等待人工输入超过 10 分钟       [→] [×]│
│ ◆  INFO      tasks #4, #7 在关键路径上，阻塞 5 个下游[×] │
└─────────────────────────────────────────────────────────┘
```

点击 `[→]` 按钮：
- Agent 卡住 → 跳转到 COMMS 视图并过滤该 Agent
- 人工输入等待 → 跳转到 COMMS 视图并过滤 `⚠ HUMAN` 类型
- 关键路径任务 → 跳转到 GRAPH 视图
- Token 异常 → 打开对应 AgentProfilePanel

GRAPH 视图：被告警的 Agent 节点加红色脉冲边框动画。

### 告警规则引擎

#### 新增文件：`server/src/alertEngine.ts`

```typescript
export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertKind = 'agent_stuck' | 'human_input_escalated' | 'critical_path_blocked' | 'token_anomaly';

export interface Alert {
  id: string;               // 稳定 ID：`{kind}-{agentOrTaskId}` 用于去重
  kind: AlertKind;
  severity: AlertSeverity;
  title: string;            // 短标题，< 60 chars
  detail: string;           // 操作建议，< 120 chars
  agentName?: string;       // 关联 Agent（用于 GRAPH 高亮）
  taskId?: string;
  triggeredAt: string;      // ISO timestamp
  durationMs?: number;      // 持续时长（用于"卡了多久"显示）
}

export function computeAlerts(
  team: TeamDetail,
  sessionStats: AgentSessionStats[],
  humanWaiters: string[],
  humanDetails: BlockingDetail[],
  thresholds: AlertThresholds,
): Alert[]
```

**四条告警规则（详细逻辑）：**

**规则 1：Agent 卡住检测** (`agent_stuck`)
- 数据来源：`TeamDetail.config.members` 中每个 Agent 的最后活跃时间
- 算法：扫描 `AgentSessionStats.sessionDurationMs` + 最后一条消息时间戳。若某 Agent 有 `in_progress` 任务，但最后消息时间戳距今 > `thresholds.stuckMinutes`（默认 10 分钟）→ 触发
- 注意：最后消息时间从 `sessionScanner.ts` 新增 `lastMessageAt` 字段获取（需修改）
- Severity：`> 2 * threshold` → critical，否则 warning

**规则 2：人工输入等待升级** (`human_input_escalated`)
- 数据来源：已有的 `humanDetails`（`BlockingDetail`），其中含 `waitingSince`（需确认字段）
- 算法：`humanWaiters` 中等待时间 > `thresholds.humanWaitMinutes`（默认 5 分钟）→ 触发
- 与现有"AWAITING INPUT"横幅并存，提供更精准的时间信息
- Severity：`> 15m` → critical，否则 warning

**规则 3：关键路径阻塞** (`critical_path_blocked`)
- 数据来源：`TeamDetail.tasks`，其中含 `blockedBy` 字段
- 算法：构建任务依赖 DAG，找出"被 ≥ 3 个待完成任务直接或间接依赖"的 `pending/in_progress` 任务 → 关键路径
- 若关键路径任务本身处于 `blocked`（`blockedBy` 非空）或无 Agent 认领 → 触发
- Severity：始终 info

**规则 4：Token 消耗异常** (`token_anomaly`)
- 数据来源：`AgentSessionStats[]`
- 算法：计算所有 Agent 的输出 token 均值，若某 Agent 输出 token > 均值 × `thresholds.tokenAnomalyMultiplier`（默认 3×）且绝对值 > 10K → 触发
- Severity：warning

**阈值可配置（通过 `/api/config`）：**
```typescript
export interface AlertThresholds {
  stuckMinutes: number;           // default: 10
  humanWaitMinutes: number;       // default: 5
  tokenAnomalyMultiplier: number; // default: 3
  enabled: AlertKind[];           // default: all
}
```

#### 新增 API 端点

```
GET /api/teams/:id/alerts
Response 200: { alerts: Alert[] }
```

告警在服务端按需计算（不缓存，每次请求重算），因为数据量小，计算开销可忽略。

#### 修改：`server/src/routes/teams.ts`
- 注册 `GET /api/teams/:id/alerts`
- 扩展 `GET /api/config` 和 `PATCH /api/config` 支持 `alertThresholds` 字段

#### 修改：`server/src/sessionScanner.ts`
- `AgentSessionStats` 增加 `lastMessageAt: string | null` 字段，记录最后一条 assistant 消息的 timestamp

#### 修改：`server/src/types.ts`
- `AgentSessionStats` 增加 `lastMessageAt?: string | null`

### 前端设计

#### 新增文件：`client/src/hooks/useAlerts.ts`

轮询 `GET /api/teams/:id/alerts`，间隔 15 秒。暴露 `{ alerts, loading }`。

#### 修改：`client/src/components/dashboard/DashboardView.tsx`

在返回 JSX 的最顶层（TeamOverview 之前）插入 `<AlertBanner>` 组件。

#### 新增文件：`client/src/components/dashboard/AlertBanner.tsx`

**视觉规格：**
```
┌─────────────────────────────────────────────────────┐
│ ██ CRITICAL  {title}  {duration}  [→ INSPECT] [×]   │
│ ▲  WARNING   {title}             [→ INSPECT] [×]    │
│ ◆  INFO      {title}                          [×]   │
└─────────────────────────────────────────────────────┘
```
- 告警背景色：critical = `rgba(255,59,92,0.08)` + `var(--crimson)` 左边框；warning = `var(--amber-glow)` + amber 左边框；info = `var(--surface-1)` + `var(--border-bright)` 左边框
- Critical 告警有 `status-pulse` 动画
- 已关闭告警存 `sessionStorage('dismissed-alerts')` as JSON Set of alert IDs
- 全部告警被关闭后，横幅区域消失（不占位）
- 最多同时展示 5 条告警；超出的告警折叠为 "+ N more alerts" 按钮

#### 修改：`client/src/components/graph/AgentNode.tsx`

增加 `hasAlert?: boolean` 和 `alertSeverity?: AlertSeverity` prop。

当 `hasAlert = true` 时，AgentNode 外围渲染额外的边框 div：
- warning：amber 脉冲边框（`box-shadow: 0 0 0 2px var(--amber), animation: status-pulse`）
- critical：crimson 脉冲边框

#### 修改：`client/src/components/graph/TopologyView.tsx`

接受 `alerts: Alert[]` prop，将 alert 信息下传给对应 `AgentNode`。

#### 修改：`client/src/App.tsx`

`useAlerts` hook 在顶层调用（与 `useTeamData` 同级），将 `alerts` 传到 `DashboardView` 和 `TopologyView`。

### 验收标准

- [ ] 支持四条告警规则，每条规则独立可开关
- [ ] 告警横幅在 MATRIX 视图 TeamOverview 上方展示，不遮挡内容
- [ ] 逐条关闭功能有效，关闭状态在同一 session 内持久化
- [ ] `[→ INSPECT]` 跳转到对应视图并自动应用相关过滤器
- [ ] GRAPH 视图中被告警的节点有对应颜色的脉冲边框
- [ ] 告警阈值可通过 `PATCH /api/config` 修改
- [ ] Demo 模式下展示合成告警数据（各类型各一条）

---

## B3 — 跨 Agent 会话浏览

> `🟢 无 AI` · P1 · 对应场景：实时监控

### 用户场景

当前 HIST 视图只能看 Lead 的会话。用户想看某个 Teammate 具体在做什么 — 它调用了什么工具、生成了什么代码。

### 核心交互

HIST 视图顶部新增 Agent 选择器（横向 tab 条，与 COMMS 视图的 agent sidebar 风格一致）。

```
┌──────────────────────────────────────────────────────────┐
│ AGENT  [● lead-session]  [○ architect]  [○ backend]  [○ tester]  │
│        12 msgs            87 msgs        134 msgs        41 msgs  │
├──────────────────────────────────────────────────────────┤
│ SESSION // ad2c55f0  |  87 msgs  · 45 shown   NEW→OLD ▼  │
│ ROLE  KIND  TOOL ▼  ─────────────────────  [search...]   │
│  ...                                                     │
└──────────────────────────────────────────────────────────┘
```

选择某个 Agent 后，现有的所有过滤器（ROLE / KIND / TOOL / search / 排序）继续有效。

### 后端设计

#### 关键数据来源：子 Agent 会话文件

参考 `wikis/cache-data-structure-claude-code.md`：

```
~/.claude/projects/{cwdEncoded}/{leadSessionId}/subagents/agent-{shortHash}.jsonl
```

子 Agent 文件的 agent name 通过"两步命名算法"获取（已在 `humanInputDetector.ts` 中实现的 `inferAgentName`）。

#### 修改：`server/src/sessionHistory.ts`

当前 `getSessionHistory(teamId, cwd, leadSessionId)` 只读取 lead 的 JSONL。扩展为：

```typescript
// 新增函数：扫描某个 CWD + leadSession 下可用的所有 Agent 会话
export async function listAvailableAgentSessions(
  cwd: string,
  leadSessionId: string,
  memberNames: string[],
): Promise<AgentSessionInfo[]>

export interface AgentSessionInfo {
  agentName: string;       // 'lead' | 实际 agent name
  sessionId: string;       // 对应 JSONL 文件的 session UUID
  filePath: string;        // 绝对路径
  messageCount: number;    // 快速统计行数（用于展示）
  isLead: boolean;
}

// 修改现有函数签名：增加可选 agentName 参数
export async function getSessionHistory(
  teamId: string,
  cwd: string,
  leadSessionId: string,
  agentName?: string,      // 若不传，默认 lead session
): Promise<SessionMessage[]>
```

**子 Agent JSONL 路径解析：**
```
leadSessionId 所对应的子目录：
  ~/.claude/projects/{cwdEncoded}/{leadSessionId}/subagents/agent-{hash}.jsonl
```

对每个 `agent-{hash}.jsonl`，调用 `inferAgentName(filePath, memberNames, projectDir, leadSessionId)` 获取 agent name，与请求的 `agentName` 参数匹配。

#### 新增 API 端点

```
GET /api/teams/:id/session-agents
Response 200:
{
  "agents": [
    { "agentName": "lead", "sessionId": "ad2c55f0-...", "messageCount": 12, "isLead": true },
    { "agentName": "architect", "sessionId": "b3d1...", "messageCount": 87, "isLead": false },
    { "agentName": "backend", "sessionId": "c4e2...", "messageCount": 134, "isLead": false }
  ]
}

GET /api/teams/:id/session-history?agentName={name}
（扩展现有端点，agentName 参数可选，默认 lead）
```

#### 修改：`server/src/routes/teams.ts`
- 注册 `GET /api/teams/:id/session-agents`
- 修改 `GET /api/teams/:id/session-history` 支持 `agentName` query 参数

### 前端设计

#### 修改：`client/src/hooks/useTeamData.ts` 或 新增 `client/src/hooks/useSessionAgents.ts`

```typescript
// GET /api/teams/:id/session-agents
// 轮询间隔：30 秒（agent 列表不会高频变化）
export function useSessionAgents(teamId: string): {
  agents: AgentSessionInfo[];
  loading: boolean;
}
```

#### 修改：`client/src/components/history/SessionHistoryView.tsx`

**新增 Agent 选择器（在现有 filter bar 上方）：**
```
┌──────────────────────────────────────────────────────────┐
│ AGENT  [● LEAD  12]  [○ architect  87]  [○ backend  134] │
└──────────────────────────────────────────────────────────┘
```

- 样式：横向 flex 行，`overflow-x: auto`，每个 Agent 一个 chip
- Chip 样式与 COMMS sidebar agent 按钮一致（颜色点 + name + 消息数 + active 高亮）
- Lead agent chip 始终排在第一位，用 "LEAD" 标签而非 agent name
- 选中 Agent 时，SessionHistoryView 调用新的 `agentName` 参数重新请求数据
- 切换 Agent 时保留当前过滤条件（roleFilter、kindFilters、search、order 等）

**修改：SessionHistoryView 的数据请求**
- 当前直接接收 `messages` prop（由父组件 App.tsx 提供）
- 改为：SessionHistoryView 内部持有 `selectedAgent` 状态，当 agent 变化时自己重新请求（调用已有的 session history hook，传入 agentName）

#### 修改：`client/src/types.ts`
新增：
```typescript
export interface AgentSessionInfo {
  agentName: string;
  sessionId: string;
  messageCount: number;
  isLead: boolean;
}
```

### 验收标准

- [ ] HIST 视图顶部展示 Agent tab 选择器，含每个 Agent 的消息数
- [ ] 可查看 Lead 和所有 Teammate 的会话内容
- [ ] 切换 Agent 时保留当前过滤条件（role/kind/tool/search/order）
- [ ] Lead session 始终排在第一位，标注 "LEAD" 标签
- [ ] 无子 Agent 数据时，选择器仅展示 Lead（不展示空列表）
- [ ] 切换 Agent 时有加载状态提示

---

## B4 — 成本分析面板

> `🟢 无 AI` · P2 · 对应场景：成本管控

### 用户场景

团队跑完一轮任务，用户想知道这次花了多少 Token、哪个 Agent 最"贵"、哪些工具调用消耗最多。

### 核心交互

新增 COST 视图（顶部导航新增第六个 tab）。

```
┌─────────────────────────────────────────────────────────┐
│  COST ANALYSIS // my-team                              │
│                                                         │
│  TOTAL  IN 284K  OUT 76K  CACHE 134K  ~$1.68 est.       │
│  ────────────────────────────────────────────────────── │
│                                                         │
│  BY AGENT (token consumption)                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │ backend    ████████████████░░░░░░  142K  50%    │   │
│  │ architect  ████████░░░░░░░░░░░░░░   87K  31%    │   │
│  │ tester     ████░░░░░░░░░░░░░░░░░░   41K  14%    │   │
│  │ lead       █░░░░░░░░░░░░░░░░░░░░░   14K   5%    │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  BY TOOL (call count · top 8)                           │
│  Read ███ 142  Edit ██ 87  Bash ██ 71  Write █ 34 ...  │
│                                                         │
│  TOKEN TREND (cumulative, by agent)                     │
│  ┌─────────────────────────────────────────────────┐   │
│  │  cumulative tokens ↑                            │   │
│  │  ╭────────────────╮  backend                   │   │
│  │   ╰──────────╮      architect                  │   │
│  │               ╰────  tester                    │   │
│  │  ─────────────────────────────────────────→ t  │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│                              [↓ EXPORT CSV]             │
└─────────────────────────────────────────────────────────┘
```

### 后端设计

#### 修改：`server/src/sessionScanner.ts`

扩展已有的 `scanSessionUsage` 和 `getSessionStatsForTeam`，增加：

1. **工具调用统计：** 扫描 `assistant` record 中的 `tool_use` content blocks，统计每种工具的调用次数和关联 token 消耗（取包含该 tool_use 的消息的 usage）
2. **时间序列数据：** 每隔 `N` 条 assistant 消息（或按时间分桶），记录累积 token 数，供趋势图使用

```typescript
// 扩展 AgentSessionStats：
export interface AgentSessionStats {
  // ... 现有字段 ...
  lastMessageAt?: string | null;          // 新增（B2 需要）
  toolCallCounts?: Record<string, number>;// 新增：工具调用次数
  tokenTimeSeries?: TokenDataPoint[];     // 新增：时间序列
}

export interface TokenDataPoint {
  timestamp: string;
  cumulativeInput: number;
  cumulativeOutput: number;
}
```

#### 新增 API 端点

```
GET /api/teams/:id/cost
Response 200:
{
  "teamId": "my-team",
  "totals": { "inputTokens": 284000, "outputTokens": 76000, "cacheReadTokens": 134000 },
  "byAgent": [
    { "agentName": "backend", "inputTokens": 142000, "outputTokens": 38000, "cacheReadTokens": 67000, "percentage": 50 }
  ],
  "byTool": [
    { "toolName": "Read", "callCount": 142, "tokensCost": 28400 }
  ],
  "timeSeries": [
    { "agentName": "backend", "dataPoints": [{ "timestamp": "...", "cumulativeInput": 1200, "cumulativeOutput": 300 }] }
  ]
}
```

数据直接从 `getSessionStatsForTeam` 的扩展版本获取，无需新增数据库。

### 前端设计

#### 新增文件：`client/src/components/cost/CostView.tsx`

**布局：** 单列，4 个区块（总览卡、Agent 柱状图、工具调用横向条形图、Token 趋势折线图）。

**总览卡（CostSummaryCard）：**
- 大数字：total input / output / cache tokens（格式化为 K/M）
- 估算费用（USD cents）：使用 Haiku 价格作为默认参考（IN: $0.80/1M, OUT: $4/1M）
- 小字注明"估算仅供参考，实际价格因模型而异"

**Agent Token 消耗柱状图（CostByAgentChart）：**
- 纯 CSS 横向进度条（不引入 chart 库）
- 每行：agent color dot + name + 进度条（宽度 = 该 agent token 占总量百分比）+ K token 数字 + 百分比
- 进度条颜色跟随 `agentColor(agentName)` 工具函数

**工具调用图（CostByToolChart）：**
- 每种工具一行：工具名（固定宽度） + 小进度条 + 调用次数
- 只展示 top 8 工具，"Others" 合并

**Token 趋势折线图（TokenTrendChart）：**
- 纯 SVG 折线图（不依赖 recharts 或 d3）
- 每个 Agent 一条折线，颜色跟随 agentColor
- 横轴：时间（相对，从 "0" 开始）；纵轴：累积 output token 数
- 悬停展示 tooltip（绝对定位 div）
- 折线图最小高度 140px，响应式宽度

**导出 CSV 按钮：**
导出内容：teamId, agentName, inputTokens, outputTokens, cacheReadTokens, messageCount, toolCallSummary

#### 修改：`client/src/components/Layout.tsx`

顶部导航新增 COST tab：
```tsx
<ViewBtn active={view === 'cost'} onClick={() => onViewChange('cost')} icon={<DollarSign size={12} />} label="COST" />
```

增加 `lucide-react` 的 `DollarSign` 图标引用。

#### 修改：`client/src/App.tsx`

- 路由新增 `'cost'` case，渲染 `<CostView teamId={selectedTeamId} />`
- `ViewType` union 增加 `'cost'`

#### 修改：`client/src/types.ts`

新增：
```typescript
export interface CostData {
  teamId: string;
  totals: TokenTotals;
  byAgent: AgentCostSummary[];
  byTool: ToolCostSummary[];
  timeSeries: AgentTimeSeries[];
}

export interface AgentCostSummary extends AgentSessionStats {
  percentage: number;
}

export interface ToolCostSummary {
  toolName: string;
  callCount: number;
  tokensCost: number;
}

export interface AgentTimeSeries {
  agentName: string;
  dataPoints: TokenDataPoint[];
}

export interface TokenDataPoint {
  timestamp: string;
  cumulativeInput: number;
  cumulativeOutput: number;
}
```

### 验收标准

- [ ] COST 视图可从顶部导航访问（新增 tab）
- [ ] 展示团队总 Token 消耗和估算 USD 费用
- [ ] Agent 柱状图展示各 Agent 的消耗占比
- [ ] 工具调用图展示 top 8 工具的调用次数
- [ ] Token 趋势折线图可视化累积消耗
- [ ] 导出 CSV 功能有效（包含各 Agent 明细）
- [ ] 数据与 TeamOverview 中的 SESSION 统计一致
- [ ] Demo 模式下展示合成的成本数据

---

## 实现顺序建议

```
Week 1   B2 告警引擎 (后端 alertEngine.ts) + 告警横幅 (前端)
         → 改动最独立，依赖现有数据，效果最直观

Week 2   B3 跨 Agent 会话浏览
         → 扩展 sessionHistory.ts + HIST 视图 Agent 选择器
         → 需要理解 subagents/ 目录结构，适合集中一周做

Week 3   B1 执行摘要（规则降级版本先上）
         → 先做无 AI 的规则摘要，验证 UI 交互
         → AI 摘要版本作为可选增强，需要 ANTHROPIC_API_KEY

Week 4   B4 成本分析面板
         → 扩展 sessionScanner.ts + 新增 COST 视图
         → 依赖 B2 中 sessionScanner 的 lastMessageAt 扩展
```

**依赖关系：**
- B2 独立，可最先做
- B3 独立，可与 B2 并行
- B1 的 AI 版本依赖后端新增 `summaryEngine.ts`，规则版本可独立
- B4 依赖 B2 中对 `sessionScanner.ts` 的扩展（`toolCallCounts`、`tokenTimeSeries`）

---

## 受影响的文件索引

### 服务端（新增）

| 文件 | 功能 |
|------|------|
| `server/src/alertEngine.ts` | 四条告警规则的计算逻辑 |
| `server/src/summaryEngine.ts` | 执行摘要的生成（规则 + AI 两种模式） |

### 服务端（修改）

| 文件 | 改动摘要 |
|------|---------|
| `server/src/sessionHistory.ts` | 新增 `listAvailableAgentSessions()`；扩展 `getSessionHistory()` 支持 `agentName` 参数 |
| `server/src/sessionScanner.ts` | `AgentSessionStats` 增加 `lastMessageAt`、`toolCallCounts`、`tokenTimeSeries` |
| `server/src/routes/teams.ts` | 注册新路由：`/summary`、`/summary/refresh`、`/alerts`、`/session-agents`、`/cost` |
| `server/src/types.ts` | 扩展 `AgentSessionStats`；新增 `Alert`、`TeamSummary`、`AgentSessionInfo`、`CostData` 等 |

### 客户端（新增）

| 文件 | 功能 |
|------|------|
| `client/src/hooks/useSummary.ts` | 轮询 `/summary` 端点，暴露 `refresh()` |
| `client/src/hooks/useAlerts.ts` | 轮询 `/alerts` 端点 |
| `client/src/hooks/useSessionAgents.ts` | 轮询 `/session-agents` 端点 |
| `client/src/components/dashboard/AlertBanner.tsx` | 告警横幅区域，支持逐条关闭 |
| `client/src/components/cost/CostView.tsx` | 完整的成本分析视图 |

### 客户端（修改）

| 文件 | 改动摘要 |
|------|---------|
| `client/src/components/dashboard/TeamOverview.tsx` | 插入 `ExecSummary` 子组件 |
| `client/src/components/dashboard/DashboardView.tsx` | 在 TeamOverview 上方插入 `AlertBanner` |
| `client/src/components/history/SessionHistoryView.tsx` | 新增 Agent 选择器 tab 条；内部管理 `selectedAgent` 状态 |
| `client/src/components/graph/AgentNode.tsx` | 新增 `hasAlert` / `alertSeverity` prop，渲染脉冲边框 |
| `client/src/components/graph/TopologyView.tsx` | 接受并下传 `alerts` prop |
| `client/src/components/Layout.tsx` | 新增 COST tab；ExportMenu 支持 COST 视图的 CSV 导出 |
| `client/src/App.tsx` | 新增 `'cost'` 路由；顶层调用 `useAlerts` |
| `client/src/types.ts` | 新增类型声明 |

---

## 设计约束与说明

### 视觉一致性

所有新 UI 组件遵循现有 CRT/磷光屏风格：
- 字体：`var(--font-mono)`，标签全大写，`letter-spacing: 0.08-0.15em`
- 颜色：使用现有 CSS 变量（`--phosphor`、`--amber`、`--ice`、`--crimson` 等）
- 图表不引入 recharts/d3 等额外依赖，使用纯 CSS 条形图 + 纯 SVG 折线图
- 新 tab 图标从已引入的 `lucide-react` 中选取

### Token 费用估算

B4 展示估算费用，基于 Claude Haiku 价格（$0.80/1M input, $4.00/1M output），在 UI 上明确标注"估算 · Haiku 价格参考"，不做实际精确计费。

### Demo 模式

所有四个功能均需在 `server/src/mockData.ts` 中新增对应的合成数据：
- `getDemoAlerts()`：各类型各一条告警
- `getDemoSummary()`：含已完成任务、阻塞点、关键决策的合成摘要
- `getDemoSessionAgents()`：3 个 Agent 的 session 列表
- `getDemoCostData()`：含时间序列的合成成本数据

### 错误处理原则

- AI 功能（B1 LLM 摘要）：出错时静默降级为规则摘要，不向前端传递错误
- 子 Agent JSONL 解析失败：跳过该 Agent，不中断整体响应
- 缺少 `leadSessionId` 时：B1 只展示规则摘要；B3 不展示 Agent 选择器（仅 HIST 原有功能）

---

*本文档基于 `wikis/project-roadmap.md`（产品路线图）、`wikis/product-proposal.md`（产品方案）、`wikis/cache-data-structure-claude-code.md`（数据架构）、`wikis/implementation.md`（技术实现）及当前代码库现状（Stage A 已完成）编写。*
