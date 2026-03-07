# Stage A 收尾 Backlog — 功能设计规格

> **版本：** v1.0 · 2026-03-06
> **范围：** Stage A Backlog 的 8 个未完成功能
> **前置文档：** `wikis/project-roadmap.md`（功能列表）、`wikis/implementation.md`（技术架构）

---

## 目录

1. [A-F1 Lead 智能体徽章](#a-f1-lead-智能体徽章)
2. [A-F2 团队描述展示](#a-f2-团队描述展示)
3. [A-F3 任务时间戳列](#a-f3-任务时间戳列)
4. [A-F4 未读收件箱徽章](#a-f4-未读收件箱徽章)
5. [A-F5 Token 消耗卡片](#a-f5-token-消耗卡片)
6. [A-F7 GRAPH 节点点击](#a-f7-graph-节点点击)
7. [A-F10 空状态优化](#a-f10-空状态优化)
8. [A-F11 TEAM_GUIDE 展示](#a-f11-team_guide-展示)

---

## A-F1：Lead 智能体徽章

`🟢 无 AI` · P0

### 功能概述

在 AgentCard 和 GRAPH AgentNode 中明确区分 Lead Agent 和 Teammate。Lead 是团队的中枢协调者，用户需要一眼识别它。

**解决的问题：** 当前 Lead 和 Teammate 在视觉上没有足够区分度，用户在 GRAPH 视图中无法快速定位 Lead。

### 数据来源

- `TeamConfig.leadAgentId` — 已存在于 `/api/teams/:id` 返回的 `config` 中
- `App.tsx` 已计算 `leadName`，通过 `isLead` prop 传递到 `AgentCard` 和 `AgentNode`

**无需新 API。** 数据链路已完整。

### 当前实现

**AgentCard** (`client/src/components/dashboard/AgentCard.tsx:99-113`)：
- 已有 `isLead` prop
- 已渲染 LEAD 徽章（amber 色，左上角绝对定位）
- **已完成** — 无需改动

**AgentNode** (`client/src/components/graph/AgentNode.tsx:154-160`)：
- 已有 `isLead` prop（通过 `AgentNodeData`）
- 已渲染 LEAD 徽章（amber 色，名字右侧 inline）
- **已完成** — 无需改动

### 交互设计

```
AgentCard:                          AgentNode (GRAPH):
┌─────────────────────┐             ┌──────────────────────────┐
│ LEAD                │             │  [A]  agent-name  LEAD   │
│  [A]  agent-name    │             │       general-purpose    │
│       gen-purpose   │             │  ● ACTIVE         3T     │
│                     │             └──────────────────────────┘
│  ▸ Running tests    │
│  ████████░░ 4/5     │
└─────────────────────┘
```

### 待改进项

| 改进点 | 说明 | 优先级 |
|--------|------|--------|
| GRAPH 视图 Lead 节点视觉强化 | 给 Lead 节点增加与 Teammate 不同的边框样式（如双线边框或 amber 色 glow） | P1 |
| MiniMap 中 Lead 颜色区分 | MiniMap 的 `nodeColor` 回调对 Lead 使用 `--amber` 而非默认 `--phosphor` | P2 |

### 影响范围

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `client/src/components/graph/AgentNode.tsx` | 修改 | 增加 Lead 节点视觉差异（边框/glow） |
| `client/src/components/graph/TopologyView.tsx` | 修改 | MiniMap nodeColor 回调区分 Lead |

### 验收标准

- [x] AgentCard 中 Lead 有 LEAD 徽章（已完成）
- [x] AgentNode 中 Lead 有 LEAD 标签（已完成）
- [ ] GRAPH 视图中 Lead 节点有视觉强化（双线边框或 amber glow）
- [ ] MiniMap 中 Lead 节点使用不同颜色

---

## A-F2：团队描述展示

`🟢 无 AI` · P0

### 功能概述

在 Dashboard 中展示团队的 `description` 字段，让用户知道这个团队在做什么。

**解决的问题：** 当前 Dashboard 没有展示团队的任务描述。用户需要回到终端查看 config 才知道团队的目标是什么。

### 数据来源

- `TeamConfig.description` — 可选 string 字段
- 已通过 `GET /api/teams/:id` 返回，在 `teamDetail.config.description` 中可用
- **无需新 API。**

### 交互设计

在 `TeamOverview` 组件的统计条下方，增加一行描述文字：

```
┌─────────────────────────────────────────────────────────────┐
│  TOTAL  6   │  DONE  2   │  RUN  3   │  WAIT  1            │
│─────────────────────────────────────────────────────────────│
│  Implement authentication system with OAuth2 and JWT tokens │
└─────────────────────────────────────────────────────────────┘
```

**状态处理：**
- `description` 存在 → 渲染描述文字（单行，截断 + tooltip 显示完整内容）
- `description` 为空或 undefined → 不渲染，不占空间

### 视觉规格

- 字体：`var(--font-mono)`，`11px`
- 颜色：`var(--text-secondary)`
- 行高：`1.5`
- 截断：单行，`text-overflow: ellipsis`，hover 时 `title` 展示完整文本
- 左侧前缀：`MISSION` 标签（`8px`，`var(--text-muted)`，`letter-spacing: 0.15em`）

### 影响范围

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `client/src/components/dashboard/TeamOverview.tsx` | 修改 | 增加 description 行 |

**Props 变化：** `TeamOverview` 的 `team` prop（`TeamDetail`）已包含 `config.description`，无需新增 prop。

### 验收标准

- [ ] `TeamOverview` 在统计条下方展示 `description`
- [ ] `description` 为空时不渲染任何内容
- [ ] 长文本单行截断，hover 展示完整文本
- [ ] Demo 模式的 demo team 有示例 description

---

## A-F3：任务时间戳列

`🟢 无 AI` · P1

### 功能概述

在任务表格中展示创建和更新时间，帮助用户判断任务的新鲜度和停滞时间。

**解决的问题：** 用户看到一个 `in_progress` 的任务，不知道它是 5 分钟前开始的还是 2 小时前开始的。

### 数据来源

- `Task.createdAt` 和 `Task.updatedAt` — 可选 ISO 8601 字符串
- 已通过 `GET /api/teams/:id` 返回的 tasks 数组中包含
- **无需新 API。**

### 当前实现

`TaskList.tsx` 已经展示了两类时间信息：
1. **`timeInStatus`**（行 218-226）— `in_progress` 或 `pending` 任务显示 `updatedAt` 的相对时间
2. **`createdAt`**（行 229-233）— 所有有 `createdAt` 的任务显示 `+{timeAgo}`

**已部分完成。** 但当前实现存在以下问题：

### 待改进项

| 改进点 | 说明 | 优先级 |
|--------|------|--------|
| 展开区域增加绝对时间 | 当前仅显示相对时间（`5m`、`2h`），展开详情时应显示完整时间戳 | P1 |
| 时间格式统一 | `createdAt` 用 `+` 前缀，`updatedAt` 无前缀，视觉上不一致 | P2 |
| Tooltip 展示完整时间 | 相对时间 hover 时 title 展示 ISO 完整时间 | P1 |

### 交互设计

任务行（收起状态）：
```
✓  #3  Implement login flow  architect  +15m  2m  DONE
                                         ↑     ↑
                                    created  in-status
```

任务行（展开状态）增加时间详情：
```
   Description text here...

   CREATED  2026-03-06 10:15:32    UPDATED  2026-03-06 10:30:45
   BLOCKED BY: #1, #2
```

### 视觉规格

- 收起状态时间：保持当前 `8px`，`var(--text-muted)`，`var(--font-mono)`
- 展开状态绝对时间：`9px`，`var(--text-secondary)`
- 时间标签：`8px`，`var(--text-muted)`，`letter-spacing: 0.1em`

### 影响范围

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `client/src/components/dashboard/TaskList.tsx` | 修改 | 展开区域增加绝对时间行 |

### 验收标准

- [x] 任务行显示相对创建时间（已完成）
- [x] `in_progress`/`pending` 任务显示状态持续时间（已完成）
- [ ] 展开详情中显示完整时间戳（CREATED / UPDATED）
- [ ] 相对时间 hover 有 tooltip 展示完整 ISO 时间
- [ ] `createdAt` 和 `updatedAt` 任一为空时，对应部分不显示

---

## A-F4：未读收件箱徽章

`🟢 无 AI` · P1

### 功能概述

在 AgentCard 的头像上展示未读消息数量的红色徽章。

**解决的问题：** 用户不知道哪个 Agent 有未处理的消息积压。

### 数据来源

- `useInboxSummary(teamId)` hook — 已存在，每 10 秒轮询 `/api/teams/:id/inbox-summary`
- 返回 `Record<agentName, InboxSummaryItem>`，其中 `InboxSummaryItem.unread` 为未读数
- `DashboardView` 已将 `unreadCount` 传递给每个 `AgentCard`

**无需新 API。** 数据链路已完整。

### 当前实现

**已完成。** `AgentCard.tsx:149-163` 已实现未读徽章：
- 位置：头像右上角绝对定位
- 样式：`var(--crimson)` 背景，白色文字，`8px`
- 超过 9 显示 `9+`
- 有 `box-shadow: 0 0 6px var(--crimson-glow)` 发光效果

### 待改进项

| 改进点 | 说明 | 优先级 |
|--------|------|--------|
| GRAPH AgentNode 也显示未读徽章 | 当前仅 AgentCard 有，GRAPH 节点没有 | P2 |

### 影响范围

如实现 GRAPH 节点徽章：

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `client/src/components/graph/AgentNode.tsx` | 修改 | AgentNodeData 增加 `unreadCount`，渲染徽章 |
| `client/src/components/graph/graphLayout.ts` | 修改 | `buildGraphElements` 需要接收 `inboxSummary` 数据 |
| `client/src/components/graph/TopologyView.tsx` | 修改 | 传递 `inboxSummary` prop |
| `client/src/App.tsx` | 修改 | 将 `inboxSummary` 传递给 `TopologyView` |

### 验收标准

- [x] AgentCard 头像上有未读数徽章（已完成）
- [x] 徽章 > 9 显示 `9+`（已完成）
- [x] 未读数为 0 时徽章不显示（已完成）
- [ ] （可选）GRAPH AgentNode 也展示未读徽章

---

## A-F5：Token 消耗卡片

`🟢 无 AI` · P1

### 功能概述

在 AgentCard 上展示每个 Agent 的 Token 消耗摘要。

**解决的问题：** 用户不知道哪个 Agent 消耗了最多 Token，无法提前发现异常消耗。

### 数据来源

- `useSessionStats(teamId)` hook — 已存在，每 30 秒轮询 `/api/teams/:id/session-stats`
- 返回 `Record<agentName, AgentSessionStats>`，包含 `inputTokens`、`outputTokens`、`cacheReadTokens`
- `DashboardView` 已将 `stats.inputTokens` 和 `stats.outputTokens` 传递给每个 `AgentCard`

**无需新 API。** 数据链路已完整。

### 当前实现

**已完成。** `AgentCard.tsx:240-256` 已实现 Token 行：
- 条件渲染：仅当 `inputTokens` 或 `outputTokens` 存在时显示
- 格式化：`fmtTokens()` 函数处理 K/M 缩写
- 样式：顶部分割线，`TOK` 标签，`↑` 输入（ice 色）/`↓` 输出（phosphor 色）
- Hover title 显示完整数值

### 待改进项

| 改进点 | 说明 | 优先级 |
|--------|------|--------|
| 增加 cacheRead 展示 | 当前只展示 input/output，缓存命中也是重要指标 | P2 |
| 异常消耗高亮 | 当某 Agent 的 Token 显著高于团队均值时，用 amber/crimson 提示 | P2（关联 Stage B 的 B2 智能告警） |

### 影响范围

如实现缓存展示：

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `client/src/components/dashboard/AgentCard.tsx` | 修改 | 增加 `cacheReadTokens` prop 和展示 |
| `client/src/components/dashboard/DashboardView.tsx` | 修改 | 传递 `cacheReadTokens` |

### 验收标准

- [x] AgentCard 底部展示 Token 输入/输出（已完成）
- [x] Token 数值使用 K/M 缩写格式化（已完成）
- [x] 无数据时不展示该行（已完成）
- [ ] （可选）增加 cacheRead 展示
- [ ] （可选）异常消耗视觉提示

---

## A-F7：GRAPH 节点点击

`🟢 无 AI` · P2

### 功能概述

点击 GRAPH 视图中的 Agent 节点，打开右侧 AgentProfilePanel 详情面板。

**解决的问题：** 当前 GRAPH 视图中点击 Task 节点会打开 TaskDetailPanel，但点击 Agent 节点只触发 hover tooltip，没有详情入口。

### 数据来源

- 点击事件携带 `node.id`（格式为 `agent-{agentId}`）
- `AgentProfilePanel` 需要 `member`、`tasks`、`teamId`、`isLead`、`sessionStats`
- 这些数据在 `App.tsx` 中已可用

**无需新 API。**

### 当前实现

`TopologyView.tsx:161-166` 已实现 `onNodeClick` 处理：

```typescript
onNodeClick={(_event, node) => {
  if (node.type === 'taskNode') {
    onTaskSelect(node.data.task.id);
  } else if (node.type === 'agentNode') {
    onAgentSelect?.(member.agentId);
  }
}}
```

`App.tsx:137` 已传递 `onAgentSelect={setSelectedAgentId}`。

`App.tsx` 中 `selectedAgentId` 状态变化会渲染 `AgentProfilePanel`。

**已完成。** Agent 节点点击已连接到 AgentProfilePanel。

### 待改进项

| 改进点 | 说明 | 优先级 |
|--------|------|--------|
| 点击视觉反馈 | Agent 节点目前没有 `cursor: pointer` 样式暗示可点击 | P2 |
| 选中状态 | 点击后该节点应有高亮边框，表示"正在查看这个 Agent" | P2 |

### 交互设计

```
点击 Agent 节点:
  ┌──────────────────────┐          ┌──────────────────┐
  │  [A]  architect LEAD │  ──────► │ AgentProfilePanel │
  │       gen-purpose    │  click   │  Avatar           │
  │  ● ACTIVE      3T   │          │  Identity         │
  └──────────────────────┘          │  Prompt Editor    │
       ↑ 选中高亮边框                │  Performance      │
                                    │  Session Stats    │
                                    │  Tasks            │
                                    └──────────────────┘
```

### 影响范围

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `client/src/components/graph/AgentNode.tsx` | 修改 | 增加 `cursor: pointer`，选中状态高亮 |
| `client/src/components/graph/TopologyView.tsx` | 修改 | 传递 `selectedAgentId` 以标记选中节点 |

### 验收标准

- [x] 点击 Agent 节点打开 AgentProfilePanel（已完成）
- [ ] Agent 节点有 `cursor: pointer` 样式
- [ ] 选中的 Agent 节点有视觉高亮（amber 边框）

---

## A-F10：空状态优化

`🟢 无 AI` · P3

### 功能概述

当各视图无数据时展示友好的空状态提示，而非空白或令人困惑的布局。

**解决的问题：** 团队刚创建但还没有任务/消息时，各视图显示空白，用户不确定是系统故障还是正常。

### 当前实现

- **EmptyState（无团队）**：`EmptyState.tsx` 已有完整的"无团队"空状态（终端风格 boot sequence + 引导步骤 + Demo 按钮）— **已完成**
- **TaskList（无任务）**：`TaskList.tsx:122-131` 已有 `— NO TASKS —` 空状态 — **已完成，但可优化**
- **其他视图**：需要逐个检查

### 需要优化的空状态

| 视图 | 触发条件 | 当前行为 | 改进 |
|------|---------|---------|------|
| MATRIX · AgentCard 区域 | `members.length === 0` | 不渲染（空白） | 显示"等待 Agent 加入"提示 |
| MATRIX · TaskList | 筛选结果为空 | 显示 `— NO TASKS —` | 区分"无任务"和"筛选无结果"，提供清除筛选按钮 |
| GRAPH | `members.length === 0` 且 `tasks.length === 0` | ReactFlow 渲染空画布 | 显示居中提示 |
| COMMS | 无消息 | 空白 | 显示"暂无通信记录"提示 |
| LOG | 无事件 | 空白 | 显示"暂无状态变更"提示 |
| HIST | 无会话数据 | 空白或 loading | 显示"暂无会话历史"提示 |

### 交互设计

统一空状态组件风格（复用 `EmptyState.tsx` 的视觉语言）：

```
┌─────────────────────────────────┐
│                                 │
│         ◎ [图标/符号]           │
│                                 │
│    [主提示文字 — 中等字号]       │
│    [副提示文字 — 小字号灰色]    │
│                                 │
└─────────────────────────────────┘
```

各场景具体文案：

| 场景 | 主提示 | 副提示 |
|------|--------|--------|
| 无 Agent | `NO AGENTS ONLINE` | `Agents will appear when the team starts working` |
| 无任务 | `NO TASKS REGISTERED` | `Tasks appear when agents create them via TaskCreate` |
| 筛选无结果 | `NO MATCHING TASKS` | `Try a different filter` + [CLEAR FILTER] 按钮 |
| 无通信 | `NO MESSAGES YET` | `Agent communications will appear here in real-time` |
| 无事件 | `NO EVENTS RECORDED` | `Task status changes will appear here as they happen` |
| 无会话 | `NO SESSION DATA` | `Session history requires an active or completed team session` |

### 视觉规格

- 容器：居中对齐，`padding: 40px`
- 图标/符号：使用 `lucide-react` 图标，`24px`，`var(--text-muted)` 色，`opacity: 0.5`
- 主提示：`11px`，`var(--text-secondary)`，`letter-spacing: 0.12em`
- 副提示：`10px`，`var(--text-muted)`，`letter-spacing: 0.04em`
- 按钮（如 CLEAR FILTER）：沿用 TaskList 筛选标签的样式

### 影响范围

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `client/src/components/dashboard/DashboardView.tsx` | 修改 | Agent 区域空状态 |
| `client/src/components/dashboard/TaskList.tsx` | 修改 | 区分无任务 vs 筛选无结果 |
| `client/src/components/graph/TopologyView.tsx` | 修改 | 空画布提示 |
| `client/src/components/commlog/CommLogView.tsx` | 修改 | 无消息提示 |
| `client/src/components/timeline/TimelineView.tsx` | 修改 | 无事件提示 |
| `client/src/components/history/SessionHistoryView.tsx` | 修改 | 无会话提示 |

### 验收标准

- [ ] 每个视图在无数据时展示有意义的空状态提示
- [ ] 空状态提示视觉风格统一（字号、颜色、间距）
- [ ] TaskList 区分"无任务"和"筛选无结果"两种空状态
- [ ] 筛选无结果时提供"清除筛选"操作

---

## A-F11：TEAM_GUIDE 展示

`🟢 无 AI` · P3

### 功能概述

在 Dashboard 中展示团队的 `TEAM_GUIDE.md` 文件内容，渲染为格式化的 Markdown。

**解决的问题：** `TEAM_GUIDE.md` 是团队的核心行为规范，但用户必须在终端中 `cat` 查看。

### 数据来源

- `GET /api/teams/:id/guide` — 已存在
- 返回 `{ teamId, content: string | null, filename: string }`
- `content` 为 Markdown 原始文本，`null` 表示文件不存在

**无需新 API。需要新增 client hook。**

### 交互设计

**方案：可折叠面板，放置在 MATRIX 视图中 TeamOverview 下方**

```
┌─────────────────────────────────────────────────────────────┐
│  TOTAL  6   │  DONE  2   │  RUN  3   │  WAIT  1            │
│  MISSION  Implement authentication system                    │
├─────────────────────────────────────────────────────────────┤
│  ▸ TEAM GUIDE                          TEAM_GUIDE.md   [▾]  │
├─────────────────────────────────────────────────────────────┤
│                                                              │  ← 展开时
│  ## Coding Standards                                         │
│                                                              │
│  - Use TypeScript strict mode                                │
│  - Error handling: use Result<T,E> instead of try-catch      │
│  - Test coverage > 80%                                       │
│                                                              │
│  ## Architecture Decisions                                   │
│  ...                                                         │
└─────────────────────────────────────────────────────────────┘
```

**状态处理：**

| 状态 | 展示 |
|------|------|
| `content !== null`，收起 | 标题行 + 文件名 + 折叠箭头 |
| `content !== null`，展开 | 标题行 + Markdown 渲染内容 |
| `content === null` | 不渲染整个区块（不占空间） |
| 加载中 | 标题行 + skeleton loading |

### 视觉规格

- 容器：与 TaskList 一致的 `var(--surface-0)` 卡片风格
- 标题栏：`var(--surface-1)` 背景，`9px`，`letter-spacing: 0.15em`，`var(--text-muted)`
- Markdown 内容区：
  - 字体：`var(--font-mono)`，`11px`，行高 `1.7`
  - 标题（`##`）：`12px`，`var(--text-primary)`，`font-weight: 600`
  - 正文：`var(--text-secondary)`
  - 代码块：`var(--surface-2)` 背景，`1px solid var(--border)` 边框
  - 列表项：`var(--text-secondary)`，列表符号用 `var(--text-muted)` 色
  - 最大高度：`400px`，超出滚动

### 技术实现

**Markdown 渲染：** 需要引入轻量 Markdown 渲染库。推荐方案：

| 方案 | 包大小 | 说明 |
|------|--------|------|
| `react-markdown` + `remark-gfm` | ~50KB gzip | 功能完整，支持 GFM 表格 |
| 手写简易 parser | 0 | 仅支持 `#`/`-`/`` ` ``/`**`，对 TEAM_GUIDE 够用 |
| `marked` + `dangerouslySetInnerHTML` | ~12KB gzip | 轻量但需要 sanitize |

**建议：** 使用 `react-markdown`。TEAM_GUIDE 可能包含表格和代码块，简易 parser 不够用。且后续 Stage D 的 TEAM_GUIDE 自动演化功能也需要 Markdown 渲染。

### 影响范围

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `client/src/hooks/useTeamGuide.ts` | **新增** | 轮询 `/api/teams/:id/guide`，返回 `{ content, loading }` |
| `client/src/components/dashboard/TeamGuidePanel.tsx` | **新增** | 可折叠 Markdown 渲染面板 |
| `client/src/components/dashboard/DashboardView.tsx` | 修改 | 在 TeamOverview 下方插入 `TeamGuidePanel` |
| `client/src/App.tsx` | 修改 | 调用 `useTeamGuide` hook，传递给 DashboardView |
| `client/package.json` | 修改 | 添加 `react-markdown` + `remark-gfm` 依赖 |

### 验收标准

- [ ] MATRIX 视图中展示可折叠的 TEAM GUIDE 面板
- [ ] Markdown 正确渲染标题、列表、代码块、加粗
- [ ] `TEAM_GUIDE.md` 不存在时，面板不显示
- [ ] 面板默认收起，点击展开
- [ ] 内容超过 400px 高度时内部滚动

---

## 功能依赖关系

```
A-F2 (团队描述)  ──── 独立
A-F1 (Lead 徽章) ──── 独立（核心已完成，仅 GRAPH 增强）
A-F3 (时间戳)    ──── 独立（核心已完成，仅展开区增强）
A-F4 (未读徽章)  ──── 独立（核心已完成，仅 GRAPH 扩展）
A-F5 (Token)     ──── 独立（核心已完成，仅可选增强）
A-F7 (节点点击)  ──── 独立（核心已完成，仅视觉增强）
A-F10 (空状态)   ──── 独立（逐视图改进）
A-F11 (指南展示) ──── 独立（需新增 hook + 组件 + 依赖）
```

**无功能间依赖。** 所有功能可并行开发。

## 实现优先级建议

| 优先级 | 功能 | 工作量 | 说明 |
|--------|------|--------|------|
| **第一批** | A-F2 | 小 | 最简单，一个组件内改动 |
| **第一批** | A-F1 增强 | 小 | GRAPH 节点视觉强化 |
| **第一批** | A-F3 增强 | 小 | 展开区增加绝对时间 |
| **第二批** | A-F10 | 中 | 涉及 6 个视图文件 |
| **第二批** | A-F7 增强 | 小 | cursor + 选中高亮 |
| **第三批** | A-F11 | 中 | 新增 hook、组件、npm 依赖 |
| **可选** | A-F4 GRAPH 扩展 | 中 | 需要修改 graphLayout 数据流 |
| **可选** | A-F5 增强 | 小 | 增加 cacheRead 字段 |

---

## 完成度总结

| 功能 | 核心功能 | 增强项 | 总体 |
|------|---------|--------|------|
| A-F1 Lead 徽章 | ✅ 已完成 | 🔲 GRAPH 视觉强化 | ~80% |
| A-F2 团队描述 | 🔲 未开始 | — | 0% |
| A-F3 时间戳列 | ✅ 已完成 | 🔲 展开区绝对时间 | ~70% |
| A-F4 未读徽章 | ✅ 已完成 | 🔲 GRAPH 节点扩展 | ~90% |
| A-F5 Token 卡片 | ✅ 已完成 | 🔲 cacheRead / 异常高亮 | ~85% |
| A-F7 节点点击 | ✅ 已完成 | 🔲 cursor / 选中高亮 | ~85% |
| A-F10 空状态 | ⚠️ 部分完成 | 🔲 6 个视图空状态 | ~30% |
| A-F11 GUIDE 展示 | 🔲 未开始 | — | 0% |

**结论：** 8 个功能中有 5 个核心功能已完成，剩余工作集中在 A-F2（团队描述）、A-F10（空状态优化）、A-F11（TEAM_GUIDE 展示）以及各功能的视觉增强项。

---

## UI/UX Review — 设计提升建议

> **审查日期：** 2026-03-06
> **审查视角：** 基于实际代码实现（非 spec 描述）的 UI/UX 提升建议
> **审查上下文：** CRT/phosphor-themed 暗色仪表板，7 套主题变体（phosphor/amber/neon/paper/crimson/slate/synth）

### 0. 完成度修正

代码审查发现 spec 中的完成度评估偏保守，实际实现更完整：

| 功能 | Spec 评估 | 实际代码状态 | 修正 |
|------|----------|-------------|------|
| A-F2 团队描述 | 0% | **已完成** — `TeamOverview.tsx:96-104` 已渲染 `description`，带 `maxWidth: 480px` 限制 | → ~90% |
| A-F11 GUIDE 展示 | 0% | **已完成** — `TeamOverview.tsx:163-419` 已有完整 slide-in 面板 + 手写 Markdown 渲染器（支持 headings/bold/code/tables/lists/blockquotes） | → ~85% |

A-F2 和 A-F11 已经不是"未开始"，而是需要**体验打磨**。

---

### 1. A-F1 Lead 徽章 — GRAPH 视觉层级不足

**问题：** AgentCard 中 Lead 有清晰的 amber 徽章 + 位置区分。但 GRAPH 视图中 Lead 只是名字旁边一个 7px 的小标签，在多节点图中几乎不可见。

**当前（AgentNode.tsx:154-160）：**
```
[A]  team-lead  LEAD     ← 7px 标签，和名字同行，视觉层级 = 普通文字
     general-purpose
● ACTIVE         3T
```

**建议 — 结构性区分（而非仅标签区分）：**

```
┌──────────────────────────────────────┐
│  ┊                              ┊    │  ← amber 虚线外框（仅 Lead 有）
│  ┊  ★  team-lead                ┊    │  ← 使用 ★ 替代方块头像
│  ┊     LEAD · general-purpose   ┊    │  ← LEAD 成为 agentType 的前缀
│  ┊  ● ACTIVE             3T    ┊    │
│  ┊                              ┊    │
└──────────────────────────────────────┘
```

具体改动：
- **双层边框**：Lead 节点 `border: 2px solid var(--amber)` + `outline: 1px dashed rgba(amber, 0.3)` with `outline-offset: 3px`
- **头像形状区分**：Lead 用圆形头像（`border-radius: 50%`），Teammate 保持方形（`border-radius: 3px`）。用形状而非颜色区分——形状感知比颜色更快
- **持续性微光**：Lead 节点始终有低强度 amber glow（`box-shadow: 0 0 12px rgba(amber, 0.15)`），不受 active/idle 状态影响

**为什么不只用颜色：** 产品有 7 套主题，amber 在 paper 主题中是 `#b45309`（对比度低），在 monochrome 中是 `#a0a0a0`（无色彩区分）。形状 + 结构性差异跨主题稳定。

---

### 2. A-F2 团队描述 — 位置和语义改进

**当前实现（TeamOverview.tsx:96-104）：**
```tsx
{team.config?.description && (
  <div style={{ fontSize: '11px', color: 'var(--text-muted)', ... }}>
    {team.config.description}
  </div>
)}
```

**问题：**
- 描述用了 `--text-muted`——和 label 同色，语义层级太低。团队描述是**用户设定的核心目标**，比 "SYS // OVERVIEW" 标签更重要
- 没有 `MISSION` 前缀标签——用户不知道这行文字是什么
- 没有 truncation 或 tooltip——长描述会撑高 TeamOverview 卡片

**建议改进：**

```tsx
{team.config?.description && (
  <div style={{
    display: 'flex', alignItems: 'baseline', gap: '10px',
    marginBottom: '14px', maxWidth: '520px',
  }}>
    <span style={{
      fontSize: '8px', color: 'var(--text-muted)',
      letterSpacing: '0.15em', flexShrink: 0, marginTop: '1px',
    }}>
      MISSION
    </span>
    <span
      style={{
        fontSize: '11px', color: 'var(--text-secondary)',  // ← 提升到 secondary
        letterSpacing: '0.03em', lineHeight: 1.5,
        overflow: 'hidden', textOverflow: 'ellipsis',
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
      }}
      title={team.config.description}
    >
      {team.config.description}
    </span>
  </div>
)}
```

变化点：
- 颜色从 `--text-muted` → `--text-secondary`（提升视觉层级）
- 增加 `MISSION` 前缀标签（和 `SYS // OVERVIEW` 风格一致）
- 限制 2 行截断（`-webkit-line-clamp: 2`），避免长描述撑高布局
- `title` 展示完整文本

---

### 3. A-F3 时间戳 — 展开区信息密度偏低

**当前展开区（TaskList.tsx:291-321）：**
```
Description text here...

BLOCKED BY: #1, #2        BLOCKS: #3, #4
```

展开后只有描述和依赖关系，没有时间信息。这是 spec 里正确指出的缺失。

**建议的展开区布局——增加 metadata 条：**

```
   Description text here...

   ┌─────────────────────────────────────────────────┐
   │  CREATED  03/06 10:15   UPDATED  03/06 10:30    │  ← 新增 metadata 行
   │  OWNER  architect       DURATION  15m           │
   └─────────────────────────────────────────────────┘
   BLOCKED BY: #1, #2
```

具体视觉：
- metadata 区用 `var(--surface-1)` 背景，与描述文本区分
- 两列 grid 布局，标签 `8px var(--text-muted)`，值 `9px var(--text-secondary)`
- `DURATION` 字段：`updatedAt - createdAt` 的差值，帮用户判断"这个任务从创建到完成花了多久"
- 日期格式用短格式 `MM/DD HH:mm`，不用完整 ISO——在 8px 字体下 ISO 格式太长

---

### 4. A-F10 空状态 — 需要比文案更多的东西

**Spec 方案的问题：** 当前设计是图标 + 两行文字，这是最基础的空状态处理。对于一个 CRT/phosphor 主题的产品，空状态是展现品牌个性的机会。

**已有的好参考——`EmptyState.tsx`：** 无团队时有完整的终端 boot sequence 动画，这是非常好的品牌化空状态。但视图级空状态不需要这么重——需要的是**轻量但有性格的空状态**。

**建议——CRT 风格的扫描线空状态：**

```
┌─────────────────────────────────────────┐
│                                         │
│      ░░░░░░░░░░░░░░░░░░░░░░░░░         │  ← 扫描线动画（3 行，交替闪烁）
│      ░░░░░░░░░░░░░░░░░░░░░░░░░         │
│      ░░░░░░░░░░░░░░░░░░░░░░░░░         │
│                                         │
│      AWAITING SIGNAL...                 │  ← 主文字，带打字机光标动画
│      No agent communications detected   │
│                                         │
└─────────────────────────────────────────┘
```

具体实现：
- 3 条 `4px` 高的水平线，`var(--border)` 颜色，`opacity` 在 `0.1-0.3` 之间交替动画（`animation: scanline 3s ease-in-out infinite`）
- 主文字使用 `var(--font-display)` 字体 + `letter-spacing: 0.15em`，和产品头部风格一致
- 文字末尾一个闪烁的 `▮` 光标（复用 EmptyState 中已有的 `status-pulse` 动画）
- **每个视图使用不同的"等待"动词**——避免千篇一律：

| 视图 | 主文字 | 风格说明 |
|------|--------|---------|
| MATRIX Agents | `AWAITING AGENTS...` | 等待 Agent 上线 |
| MATRIX Tasks | `NO TASKS IN REGISTRY` | 注册表为空 |
| GRAPH | `TOPOLOGY OFFLINE` | 拓扑图离线 |
| COMMS | `RADIO SILENCE` | 无通信（最有终端味道） |
| LOG | `NO EVENTS LOGGED` | 日志为空 |
| HIST | `SESSION NOT FOUND` | 无会话 |

**为什么不用 lucide 图标：** 产品的整体风格是 CRT 终端——没有图标，只有文字、线条和发光。引入 lucide 图标做空状态会和 EmptyState.tsx 的终端 boot sequence 风格不一致。

---

### 5. A-F11 TEAM_GUIDE — 已实现但有体验问题

**当前实现的问题：**

**5a. 入口不够显眼**

`TeamOverview.tsx:57-85` 中 GUIDE 按钮是一个 8px 文字的小按钮，挤在 `SYS // OVERVIEW` 旁边。用户不太可能注意到。

建议：如果 TEAM_GUIDE 存在，在 TeamOverview 卡片底部增加一条提示横条：
```
┌──────────────────────────────────────────────────┐
│  [正常的 TeamOverview 内容]                       │
├──────────────────────────────────────────────────┤
│  📋 TEAM GUIDE available                   VIEW ▸ │  ← 底部横条
└──────────────────────────────────────────────────┘
```

或者更符合产品风格：在 header nav 旁边加一个 `GUIDE` 按钮（和 MATRIX/GRAPH/COMMS/LOG/HIST 同级），而非嵌套在 TeamOverview 内部。这样 GUIDE 的层级更高，符合"核心行为规范"的重要性。

**5b. Markdown 渲染器缺少链接支持**

`inlineRender` 函数只处理 `**bold**`、`` `code` ``、`*italic*`，不处理 `[text](url)` 链接。TEAM_GUIDE 中可能有链接（如指向 wiki 的参考）。

建议在 `inlineRender` 的正则中增加链接匹配：
```regex
/(\*\*(.+?)\*\*|`(.+?)`|\*(.+?)\*|\[(.+?)\]\((.+?)\))/g
```

**5c. GUIDE 面板加载无反馈**

loading 状态只是居中的 `LOADING...` 文字。建议用 3-4 行的 skeleton shimmer 条代替，和产品的扫描线风格一致。

---

### 6. 跨功能建议 — AgentCard 信息密度

AgentCard 目前展示了：名字、角色、状态、当前工作、进度条、Token 消耗、未读徽章、Lead 徽章、排序徽章。在 220px 的卡片内信息密度已经很高。

**问题：** 所有信息平铺展示，没有主次之分。用户实际扫描 Agent 卡片时，最想知道的是：
1. 这个 Agent 的**状态**（在跑 / 卡住 / 空闲）——最重要
2. 在做**什么**（activeForm）——次重要
3. 进度如何——第三

但当前的视觉层级中，名字和角色占了最大的空间，状态只是一个 5px 的圆点。

**建议——状态驱动的卡片布局：**

当 Agent 处于 `awaiting input` 状态时，整个卡片应该有更强的视觉紧迫感：
- 边框从 `1px solid var(--border)` 变为 `1px solid var(--amber)` + 持续脉冲
- 顶部 accent bar 增加宽度（从 `2px` → `3px`）并且闪烁更快
- 当前的 `⚠ INPUT` 标签改为**满宽横幅**，文案改为 `WAITING FOR YOUR INPUT — [RESPOND]`，RESPOND 可点击直接跳到 COMMS 视图

这样用户在 Agent 卡片 grid 中扫一眼，需要介入的 Agent 会像"报警灯"一样跳出来。

---

### 7. A-F7 GRAPH 选中状态 — 需要和 Panel 联动

**当前行为：** 点击 Agent 节点 → 打开 AgentProfilePanel → 但节点没有选中态 → 用户不确定 Panel 对应哪个节点。

**建议——选中状态 + 连接线：**

选中的 Agent 节点：
- 边框变为 `2px solid var(--phosphor)` + `box-shadow: 0 0 15px var(--phosphor-glow-strong)`
- 其他节点 opacity 降为 `0.5`（焦点化）
- 面板关闭时恢复

选中的 Task 节点同理（已有 TaskDetailPanel，但同样缺少选中态）。

技术实现：`TopologyView` 传入 `selectedNodeId`，AgentNode/TaskNode 通过 `data.isSelected` 控制样式。

---

### 优先级排序（按 UX 影响）

| # | 改进 | 影响面 | 工作量 |
|---|------|-------|--------|
| 1 | A-F10 CRT 风格空状态 | 所有视图 | 中 — 写一个通用组件 + 6 处调用 |
| 2 | A-F1 Lead GRAPH 结构区分 | GRAPH 视图 | 小 — AgentNode 样式条件 |
| 3 | A-F2 Description 语义提升 | MATRIX 视图 | 小 — 改 3 行样式 |
| 4 | AgentCard awaiting input 紧迫感 | MATRIX 视图 | 中 — 条件样式 + 横幅 |
| 5 | A-F7 节点选中态 | GRAPH 视图 | 中 — 需要穿透 props |
| 6 | A-F3 展开区 metadata | MATRIX 视图 | 小 — 增加一个 div |
| 7 | A-F11 GUIDE 链接支持 | MATRIX 视图 | 小 — 正则扩展 |
| 8 | A-F11 GUIDE 入口提升 | MATRIX 视图 | 中 — 布局调整 |
