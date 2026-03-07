# evo-agent-team · 产品路线图

> **版本：** v1.2 · 2026-03-07
> **产品定位：** 通过可视化、持久化与人类反馈闭环，将 Claude Code 一次性蜂群协作升级为可持续演化的驻场专家团队。
> **核心一句话：** 让你的 AI 团队持续进化，更加专业。

---

## AI 依赖分级说明

本路线图中每个功能标注以下三种 AI 依赖等级之一：

| 标签 | 含义 | 说明 |
|------|------|------|
| `🟢 无 AI` | 纯工程实现 | 不依赖任何 AI 模型。通过文件解析、UI 渲染、数据聚合等常规工程手段完成。 |
| `🟡 基础 AI` | 单次 LLM 调用 | 依赖 LLM 做文本摘要、格式转换、模板填充等"单进单出"任务。不涉及训练、微调或复杂推理链。调用失败时功能降级但不崩溃。 |
| `🔵 Memory AI` | 记忆驱动的 AI | 基于持久化记忆文件（MEMORY.md、TEAM_GUIDE.md、Agent Profile、反馈日志）构建结构化上下文，通过 LLM 的 in-context learning 实现行为演化。不依赖模型训练或微调，所有"学习"通过记忆文件的增量更新完成。 |

---

## 路线图总览

```
Stage A (已完成)        Stage B (已完成)        Stage C                 Stage D                    Stage E
可视化与原始数据        智能观测                轻量干预                持久化与反馈闭环            记忆驱动的演化
─────────────────  ─────────────────────  ────────────────────  ─────────────────────    ─────────────────────
Dashboard ✅        执行摘要 (B1 待实现)    人工介入增强           Agent Profile 持久化      反馈驱动的偏好沉淀
Topology Graph ✅   智能告警 ✅             任务状态内联编辑        高保真反馈捕获             规则化按需监督
Comm Log ✅         跨 Agent 会话浏览 ✅                           TEAM_GUIDE 自动演化        跨团队知识迁移
Timeline ✅         成本分析仪表板 ✅                              会话记忆管理               语境摘要注入
Session History ✅                                               冲突检测与可视化合并
Export ✅

      🟢 无 AI 为主         🟢+🟡 混合             🟢 无 AI               🟢+🟡 混合                 🔵 Memory AI 为主
```

---

## Stage A：可视化与原始数据管理（已完成）

> 详见 `product_stage_a.md`。以下仅列出状态摘要。

### 已交付

| # | 功能 | AI 依赖 | 状态 |
|---|------|---------|------|
| A1 | MATRIX 仪表板（团队概览、Agent 卡片、Todo 列表、热力图、任务表格） | `🟢 无 AI` | ✅ 已完成 |
| A2 | GRAPH 拓扑图（DAG 可视化、三种布局、节点交互） | `🟢 无 AI` | ✅ 已完成 |
| A3 | COMMS 通信日志（消息过滤、线程折叠、自动滚动、人工输入告警） | `🟢 无 AI` | ✅ 已完成 |
| A4 | LOG 时间线（任务状态变更事件流） | `🟢 无 AI` | ✅ 已完成 |
| A5 | HIST 会话历史（Lead 会话浏览、工具调用检查、搜索高亮） | `🟢 无 AI` | ✅ 已完成 |
| A6 | 导出功能（PNG / JSON / CSV） | `🟢 无 AI` | ✅ 已完成 |
| A7 | 实时推送（WebSocket + 轮询降级） | `🟢 无 AI` | ✅ 已完成 |
| A8 | Demo 模式（无真实团队时合成数据） | `🟢 无 AI` | ✅ 已完成 |

### Stage A 收尾 Backlog

| # | 功能 | AI 依赖 | 优先级 | 状态 |
|---|------|---------|--------|------|
| A-F1 | Lead 智能体徽章 — 卡片和 GRAPH 节点区分 Lead（圆形头像、amber 双边框、持续光晕） | `🟢 无 AI` | P0 | ✅ 已完成 |
| A-F2 | 团队描述展示 — MISSION 标签 + 2行截断 + 点击展开 | `🟢 无 AI` | P0 | ✅ 已完成 |
| A-F3 | 任务时间戳列 — 展开任务时显示 CREATED / UPDATED / DURATION | `🟢 无 AI` | P1 | ✅ 已完成 |
| A-F4 | 未读收件箱徽章 — AgentCard 展示未读消息数 | `🟢 无 AI` | P1 | ✅ 已完成 |
| A-F5 | Token 消耗 → SYS // OVERVIEW — 团队级聚合统计（IN / OUT / CACHE / MSG / TIME） | `🟢 无 AI` | P1 | ✅ 已完成 |
| A-F7 | GRAPH 节点点击 — 点击 Agent 节点打开详情面板 + 选中高亮 / 其余节点降暗 | `🟢 无 AI` | P2 | ✅ 已完成 |
| A-F10 | 空状态优化 — CRTEmptyState 组件统一各视图无数据提示 | `🟢 无 AI` | P3 | ✅ 已完成 |
| A-F11 | TEAM_GUIDE 展示 — Markdown 渲染 + 链接支持 | `🟢 无 AI` | P3 | ✅ 已完成 |

---

## Stage B：智能观测（已完成，B1 待实现）

> **核心目标：** 从"能看"升级到"看得懂"。让用户在 2 分钟内掌握团队全局状况，系统主动识别问题而非等用户发现。
> **架构约束：** 纯只读。仅读取 `~/.claude/` 文件，不做任何写操作。

### B1：执行摘要 — "晨会报告"

`🟡 基础 AI` · P0 · **待实现**

**用户场景：** 团队跑了一晚上，早上打开 Dashboard，想在 2 分钟内知道：做了什么、卡在哪里、关键决策是什么。

**功能描述：**
- 在 MATRIX 视图顶部新增"执行摘要"卡片
- 后端解析 `{leadSessionId}.jsonl`，提取关键事件（任务状态变更、工具调用统计、错误记录）
- 调用 LLM 生成结构化摘要，包含：
  - 已完成的任务及关键成果
  - 当前阻塞点及阻塞原因
  - 值得关注的决策或风险
  - Token 消耗概览
- 摘要缓存在服务端内存中，每次团队数据变更时标记为 stale，下次请求时重新生成
- 降级方案：LLM 不可用时，展示纯规则生成的统计摘要（任务完成率、活跃 Agent 数、最近事件列表）

**验收标准：**
- [ ] 摘要卡片在 MATRIX 视图顶部展示，支持折叠
- [ ] 摘要在 5 秒内生成（含 LLM 调用）
- [ ] LLM 不可用时自动降级为统计摘要
- [ ] 用户可手动刷新摘要

**API 设计：**
```
GET /api/teams/:id/summary
Response: { teamId, summary: string, generatedAt: string, isAIGenerated: boolean }
```

---

### B2：智能告警与瓶颈检测

`🟢 无 AI` · P0 · ✅ **已完成**

**实现摘要：**
- `server/src/alertEngine.ts`：规则引擎，支持 4 种告警类型
- `GET /api/teams/:id/alerts`：返回实时告警列表
- 客户端：`useAlerts` hook + `AlertBanner` 组件（可逐条关闭）
- 顶部导航栏新增告警计数徽章，critical 级别脉冲动画
- AgentNode 告警高亮待实现（见遗留项）

**已实现的告警规则：**
- `agent_stuck`：Agent 有 in_progress 任务但 N 分钟无新消息（来自 `lastMessageAt`）
- `human_input_escalated`：检测到人工输入等待 Agent（复用 humanInputDetector）
- `critical_path_blocked`：所有 pending 任务均因未解决依赖而无法执行
- `token_anomaly`：Agent Token 消耗速率 ≥ 团队均值 × 阈值

**遗留项：**
- [ ] GRAPH 视图中被告警节点的红色脉冲边框（AgentNode 视觉高亮）
- [ ] 告警阈值通过 `/api/config` 可配置

---

### B3：跨 Agent 会话浏览

`🟢 无 AI` · P1 · ✅ **已完成**

**实现摘要：**
- `server/src/sessionHistory.ts`：新增 `listAvailableAgentSessions()`，扫描项目目录匹配 Agent 名称
- `GET /api/teams/:id/session-agents`：返回可浏览的 Agent 会话列表
- `GET /api/teams/:id/session-history?agentName=xxx`：按 Agent 名称返回会话内容
- 客户端：`SessionHistoryContainer` 包装组件，顶部 Agent 选择器 Tab（Lead 用 ★ 标记），切换时保留所有过滤条件
- `useAgentSessions` hook 轮询可用会话列表

**已知限制：**
- In-process 子 Agent 不写独立 JSONL 文件，其工具调用通过 Lead 会话可见
- 文件名匹配算法基于 `inferAgentName()`（TaskUpdate owner + parentToolUseId），对部分会话可能无法识别

---

### B4：成本分析仪表板

`🟢 无 AI` · P2 · ✅ **已完成**

**实现摘要：**
- `sessionScanner.ts` 扩展：新增 `lastMessageAt`、`toolCallCounts`、`tokenTimeSeries`（60s 降采样）
- `GET /api/teams/:id/cost`：返回团队级成本数据（totals / byAgent / byTool / timeSeries）
- 客户端：`CostView` 组件（独立 COST 视图 Tab），三个子 Tab：
  - **OVERVIEW**：按 Agent 的 Token 水平条形图（输入/输出/缓存三段着色）
  - **TOOLS**：工具调用次数排行（水平柱状图，前 10）
  - **TRENDS**：累积 Token 折线图，含 X 轴时间标签（4 个时间节点，跨日/同日自适应格式）和 Y 轴 Token 刻度
- `useCostData` hook 轮询，30s 间隔
- 顶部导航新增 COST Tab（DollarSign 图标）

---

### Stage B 功能汇总

| # | 功能 | AI 依赖 | 优先级 | 关键用户场景 |
|---|------|---------|--------|-------------|
| B1 | 执行摘要 | `🟡 基础 AI` | P0 | 快速了解团队进展 |
| B2 | 智能告警与瓶颈检测 | `🟢 无 AI` | P0 | 及时发现卡住的 Agent |
| B3 | 跨 Agent 会话浏览 | `🟢 无 AI` | P1 | 查看 Teammate 的具体行为 |
| B4 | 成本分析仪表板 | `🟢 无 AI` | P2 | Token 消耗归因和控制 |

---

## Stage C：轻量干预

> **核心目标：** 从"只能看"升级到"能动手"。用户可以在 UI 中直接响应 Agent 请求和修正数据，不需要切回终端。
> **架构变化：** 引入有限写操作（仅限 inbox JSON 文件、tasks/*.json）。

### C1：人工介入增强

`🟢 无 AI` · P0

**用户场景：** 看到某个 Agent 在等人工确认（AskUserQuestion），想直接在 Dashboard 里响应，而不是切回终端。

**功能描述：**
- 在 COMMS 视图中，当检测到 `human_input_request` 类型消息时，渲染交互式响应组件：
  - 展示 Agent 的问题内容
  - 提供文本输入框供用户回复
  - 回复写入对应 Agent 的 inbox JSON 文件
- 在 MATRIX 视图的"等待人工输入"告警上，提供"快速响应"按钮，点击直接弹出响应对话框
- 人工响应后自动刷新相关 Agent 的状态

**验收标准：**
- [ ] COMMS 视图中 human_input_request 消息下方出现回复输入框
- [ ] 回复成功后消息标记为已处理，告警消失
- [ ] 同时支持从 MATRIX 视图的告警横幅快速响应

**API 设计：**
```
POST /api/teams/:id/agents/:name/respond
Body: { message: string }
```

---

### C2：任务状态内联编辑

`🟢 无 AI` · P1

**用户场景：** 用户看到某个任务实际已完成但状态未更新，想直接在 UI 里修正。

**功能描述：**
- 任务表格中点击状态徽章弹出下拉菜单：`pending` → `in_progress` → `completed`
- 调用 `PATCH /api/teams/:id/tasks/:taskId` 写入 `~/.claude/tasks/{team}/{N}.json`
- 修改通过 WebSocket 实时广播
- 操作确认：状态回退（如 completed → pending）时弹出二次确认

**验收标准：**
- [ ] 点击状态徽章可切换任务状态
- [ ] 修改即时反映在所有视图（MATRIX、GRAPH、LOG）
- [ ] 回退操作有二次确认

---

### Stage C 功能汇总

| # | 功能 | AI 依赖 | 优先级 | 关键用户场景 |
|---|------|---------|--------|-------------|
| C1 | 人工介入增强 | `🟢 无 AI` | P0 | 在 UI 中响应 Agent 请求 |
| C2 | 任务状态内联编辑 | `🟢 无 AI` | P1 | 在 UI 中修正任务状态 |

---

## Stage D：持久化与反馈闭环

> **核心目标：** 从"能看能改"升级到"能积累能进化"。将人类反馈沉淀为 Agent 团队的长期知识。
> **架构变化：** 引入持久化存储层，对 `~/.claude/agents/`、`~/.claude/teams/` 进行结构化写入。

### D1：Agent Profile 持久化 — 驻场专家档案

`🟡 基础 AI` · P0

**用户场景：** 用户希望"架构师 Agent"记住它在这个项目上积累的经验 — 哪些模块它处理过、成功率如何、用户给过什么纠偏意见。

**功能描述：**
- 为每个 Agent 建立持久化 Profile 文件：`~/.claude/agents/{agentType}.profile.json`
- Profile 内容：
  - 基础信息：名称、角色类型、创建时间
  - 任务历史统计：参与任务数、完成数、按模块分类的成功率
  - 用户评价记录：每条评价包含时间、关联任务、评价内容
  - 行为偏好：从用户反馈中提取的规则列表（如"偏好函数式写法"、"测试覆盖率要求 > 80%"）
- 数据来源：
  - 任务历史 → 从 `tasks/{team}/*.json` 的 `owner` 字段聚合
  - Token 统计 → 从 session stats 聚合
  - 用户评价 → 新增交互入口（见 D2）
- 行为偏好的提取使用 LLM：将用户评价文本归纳为简洁的规则条目
- UI：AgentProfilePanel 增加"成长档案"标签页

**验收标准：**
- [ ] 每个 Agent 有独立的 profile 文件
- [ ] Profile 面板展示任务历史统计和趋势
- [ ] 用户评价列表可浏览和搜索
- [ ] 行为偏好从评价中自动提取（LLM），可人工编辑

---

### D2：高保真反馈捕获

`🟢 无 AI` · P0

**用户场景：** Agent 生成了一段代码，用户想标注"这里的错误处理方式不对，应该用 Result 类型而不是 try-catch"，并且希望这个意见被永久记住。

**功能描述：**
- HIST 视图中每条 Assistant 消息旁增加"评价"按钮
- 评价类型：
  - 👍 采纳 — "这个做法好"
  - 👎 纠偏 — "这里需要改"（必须填写理据）
  - 📌 标记 — "值得记住的模式"
- 评价数据结构：
  ```json
  {
    "id": "fb-001",
    "sessionId": "ad2c55f0-...",
    "messageUuid": "4d5cca14-...",
    "agentName": "architect",
    "type": "correction",
    "content": "错误处理应使用 Result<T, E> 而非 try-catch",
    "context": { "toolName": "Write", "filePath": "src/handler.ts" },
    "createdAt": "2026-03-06T10:30:00Z"
  }
  ```
- 存储位置：`~/.claude/teams/{team}/feedback/{agentName}.jsonl`（每条一行，追加写入）
- 评价后的即时效果：无（纯记录）。评价的消费在 D3 中实现。

**验收标准：**
- [ ] HIST 视图中每条 assistant 消息可评价
- [ ] 纠偏类评价必须填写理据文字
- [ ] 评价数据持久化到文件
- [ ] AgentProfilePanel 中可浏览该 Agent 收到的所有评价

---

### D3：TEAM_GUIDE 自动演化

`🟡 基础 AI` · P1

**用户场景：** 用户给了 20 条纠偏意见后，不想每次新建团队都手动写 TEAM_GUIDE.md。希望系统自动将这些意见归纳为团队指南。

**功能描述：**
- 后端定期扫描 `feedback/{agentName}.jsonl`，当新评价累积到阈值（如 5 条）时触发更新
- 调用 LLM 将评价归纳为 TEAM_GUIDE.md 的增量更新：
  - 提取通用规则（适用于整个团队的偏好）
  - 提取 Agent 专属规则（仅适用于特定角色的偏好）
- 更新方式：生成 diff preview → 用户在 UI 中审批 → 写入文件
- 防止过度拟合：LLM prompt 中明确区分"针对特定 Bug 的临时修复"和"通用编码偏好"
- 同时更新 `agents/{agentType}.md` 中的角色定义（如有相关规则）

**验收标准：**
- [ ] 新评价累积到阈值时触发更新建议
- [ ] 用户在 UI 中预览 TEAM_GUIDE.md 的变更 diff
- [ ] 用户审批后自动写入文件
- [ ] 区分全局规则和 Agent 专属规则
- [ ] 更新历史可追溯（版本化）

---

### D4：会话记忆管理

`🟡 基础 AI` · P1

**用户场景：** 新建了一个团队来继续上次的工作，但新 Agent 对上次的进度一无所知。用户想让新 Agent 继承之前的关键决策和上下文。

**功能描述：**
- 管理 `projects/{cwdEncoded}/memory/MEMORY.md` — Claude Code 的自动记忆文件
- UI 新增"项目记忆"面板：
  - 查看和编辑 MEMORY.md 内容
  - 从历史会话中提取关键决策，追加到 MEMORY.md（LLM 辅助摘要）
  - 将 TEAM_GUIDE.md 中的通用规则同步到 MEMORY.md（确保新 Agent 继承）
- "一键生成记忆"功能：选择一个已完成的团队会话，LLM 自动提取值得记住的内容

**验收标准：**
- [ ] 可在 UI 中查看和编辑 MEMORY.md
- [ ] 可从历史会话自动提取关键信息
- [ ] 导入的信息格式与 Claude Code 自动记忆兼容

---

### D5：冲突检测与可视化合并

`🟢 无 AI` · P2

**用户场景：** 两个 Agent 同时修改了 `src/handler.ts`，用户想知道它们的修改是否冲突，并选择如何合并。

**功能描述：**
- 数据来源：`file-history/{sessionId}/` 存储了每个 session 的文件编辑快照
- 后端扫描同一团队中多个 Agent 的 file-history，检测同一文件的并发修改
- UI 展示：
  - 冲突文件列表（哪些文件被多个 Agent 同时修改）
  - Side-by-side diff 视图（显示两个 Agent 各自的修改）
  - 冲突状态标记：无冲突（修改不重叠）/ 潜在冲突（修改同一区域）
- 注意：**不自动合并**。仅检测和展示，合并由用户在终端中手动完成（或委托给 Agent）。

**验收标准：**
- [ ] 检测到并发文件修改时在 MATRIX 视图显示告警
- [ ] 提供 side-by-side diff 视图
- [ ] 区分"无冲突并发修改"和"潜在冲突修改"

---

### Stage D 功能汇总

| # | 功能 | AI 依赖 | 优先级 | 关键用户场景 |
|---|------|---------|--------|-------------|
| D1 | Agent Profile 持久化 | `🟡 基础 AI` | P0 | 累积 Agent 的工作经验 |
| D2 | 高保真反馈捕获 | `🟢 无 AI` | P0 | 在会话中标注纠偏意见 |
| D3 | TEAM_GUIDE 自动演化 | `🟡 基础 AI` | P1 | 将反馈沉淀为团队知识 |
| D4 | 会话记忆管理 | `🟡 基础 AI` | P1 | 跨会话继承上下文 |
| D5 | 冲突检测与可视化合并 | `🟢 无 AI` | P2 | 发现并处理并发编辑冲突 |

---

## Stage E：记忆驱动的演化

> **核心目标：** 从"人驱动的反馈循环"升级到"系统基于记忆主动优化"。通过结构化记忆文件（而非模型训练）实现 Agent 团队的持续演化。
> **核心理念：** 所有"学习"均通过记忆文件的增量更新 + LLM in-context learning 实现。不依赖 RLHF、DPO、微调或任何形式的模型训练。
> **架构变化：** 引入多层记忆管理系统，统一管理 MEMORY.md、TEAM_GUIDE.md、Agent Profile、反馈日志之间的信息流转。

### E1：反馈驱动的偏好沉淀

`🔵 Memory AI` · P0

**用户场景：** 用户长期使用后，希望 Agent 能够自动理解"我的编码品味" — 不只是遵循明确规则，而是从历史评价中学会隐含偏好。

**功能描述：**
- 基于 D2 积累的反馈数据，通过 LLM 提取结构化偏好规则，写入记忆文件
- 记忆沉淀流程：
  1. 定期扫描 `feedback/{agentName}.jsonl` 中的新评价
  2. LLM 将评价归纳为结构化偏好条目（如"偏好函数式写法"、"错误处理用 Result 而非 try-catch"）
  3. 偏好条目写入 `agents/{agentType}.profile.json` 的 `preferences` 字段
  4. 高频偏好自动提升到 `agents/{agentType}.md` 角色定义中（确保 Agent spawn 时立即生效）
  5. 通用偏好同步到 `TEAM_GUIDE.md` 和 `MEMORY.md`（确保跨 Agent 继承）
- 偏好分级：
  - **试探性偏好**（出现 1-2 次）→ 仅记录在 profile 中，不注入 prompt
  - **确认性偏好**（出现 3+ 次或用户显式确认）→ 写入角色定义，注入 Agent 系统提示
  - **团队级偏好**（跨多个 Agent 出现）→ 写入 TEAM_GUIDE.md
- 防止过拟合：
  - 偏好条目带"来源评价数"计数，低频偏好标记为"待确认"
  - 用户可在 UI 中审核、编辑、删除偏好条目
  - LLM prompt 中明确区分"特定 Bug 的临时修复"和"通用编码偏好"
- 效果评估：统计用户在新会话中的纠偏频率是否下降（纯数据统计，非模型评估）

**验收标准：**
- [ ] 反馈自动归纳为偏好条目，写入 Agent profile
- [ ] 高频偏好自动提升到角色定义和 TEAM_GUIDE.md
- [ ] 用户可在 UI 中审核和管理所有偏好条目
- [ ] 偏好注入后，Agent 在新会话中表现出对应行为变化

---

### E2：规则化按需监督

`🔵 Memory AI` · P1

**用户场景：** 用户不想每 5 分钟看一次 Dashboard。希望系统只在"真正需要人工判断"时才打断自己。

**功能描述：**
- 基于记忆文件中的规则（而非实时信心评分算法）决定何时请求人类监督
- 监督规则来源：
  - **显式规则**：用户在 UI 中配置"哪些操作必须审批"（如：修改核心模块、删除文件、修改超过 N 行）
  - **历史规则**：从反馈日志中提取"用户曾经在哪类操作上纠偏" → 自动将该类操作标记为"建议审批"
  - **范围规则**：修改影响的文件数 > 阈值、涉及 `blockedBy` 关键路径任务时自动触发
- 规则存储在 `TEAM_GUIDE.md` 的 `## Supervision Rules` 章节，格式为人类可读的 Markdown 列表
- Agent 通过读取 TEAM_GUIDE.md 中的监督规则来决定是否暂停（利用 Claude Code 已有的 A2H 机制）
- UI 提供规则管理面板：
  - 查看当前生效的监督规则列表
  - 手动添加/删除规则
  - 查看"建议规则"（从反馈历史自动生成）并一键采纳
- 阈值调节滑块：偏向自主 ↔ 偏向保守（控制"建议审批"规则的灵敏度）

**验收标准：**
- [ ] 用户可在 UI 中配置显式监督规则
- [ ] 系统从反馈历史自动生成建议规则
- [ ] 规则写入 TEAM_GUIDE.md，Agent 在运行时遵守
- [ ] 监督请求频率可通过阈值滑块调节

---

### E3：跨团队知识迁移

`🟡 基础 AI` · P2

**用户场景：** 项目 A 的团队积累了很多经验，现在要启动项目 B。用户希望把项目 A 中通用的知识带到项目 B，但不带那些项目特有的临时规则。

**功能描述：**
- UI 提供"知识迁移向导"：
  - 选择源团队和目标团队
  - LLM 分析源团队的 TEAM_GUIDE.md + Agent Profiles + MEMORY.md，区分：
    - 通用知识（如编码规范、测试要求）→ 推荐迁移
    - 项目特有知识（如特定 API 的使用方式）→ 标记为"可选"
    - 临时修复（如某个 Bug 的 workaround）→ 建议排除
  - 用户确认后，将选中的知识写入目标团队的 TEAM_GUIDE.md、MEMORY.md 和相关 Agent profile

**验收标准：**
- [ ] 知识分类准确率 > 80%（用户对推荐结果的采纳率）
- [ ] 支持逐条审核和修改
- [ ] 迁移后的目标团队 TEAM_GUIDE.md 格式正确可读

---

### E4：语境摘要注入

`🔵 Memory AI` · P2

**用户场景：** Lead Agent 做出了一个关键架构决策（如选择 PostgreSQL 而非 MongoDB），但后续 spawn 的 Teammate 不知道这个决策，浪费 Token 重新扫描或做出矛盾的选择。

**功能描述：**
- 维护一份"活跃语境摘要"文件：`~/.claude/teams/{team}/context-summary.md`
- 摘要分为三个章节，按重要性排序：
  - `## Decisions`：架构决策、技术选型（低频更新，必须同步）
  - `## Progress`：当前进度、任务分配、阻塞状态（中频更新）
  - `## Context`：相关文件路径、最近修改的模块（高频更新，按需裁剪）
- 更新机制：
  - Lead 会话中检测到关键事件（如 TaskUpdate、架构相关讨论）时，LLM 增量更新摘要
  - 更新以追加/替换为主，不重写全文，控制 Token 消耗
  - 摘要总长度控制在 4K Token 以内
- 消费机制：
  - spawn 新 Teammate 时，从 context-summary.md 中提取与其任务相关的章节，注入 bootstrap prompt
  - 通过 TEAM_GUIDE.md 中的引用指令（如"参考 context-summary.md 了解当前进度"）让 Agent 主动读取
- UI 展示"语境摘要"面板，用户可查看和手动编辑摘要内容

**验收标准：**
- [ ] context-summary.md 在关键事件后自动更新
- [ ] 新 Teammate 收到的上下文摘要 < 4K Token
- [ ] 用户可在 UI 中查看和编辑语境摘要
- [ ] Teammate 的"冷启动"冗余扫描有明显减少

---

### Stage E 功能汇总

| # | 功能 | AI 依赖 | 优先级 | 关键用户场景 |
|---|------|---------|--------|-------------|
| E1 | 反馈驱动的偏好沉淀 | `🔵 Memory AI` | P0 | Agent 通过记忆文件学会用户的编码品味 |
| E2 | 规则化按需监督 | `🔵 Memory AI` | P1 | 减少监督疲劳，基于规则按需打断 |
| E3 | 跨团队知识迁移 | `🟡 基础 AI` | P2 | 复用团队经验到新项目 |
| E4 | 语境摘要注入 | `🔵 Memory AI` | P2 | 消除 Teammate 的冷启动 |

---

## 全局功能索引

| # | 功能名称 | Stage | AI 依赖 | 优先级 |
|---|---------|-------|---------|--------|
| A1-A8 | 可视化与原始数据 | A | `🟢 无 AI` | — (已完成) |
| B1 | 执行摘要 | B | `🟡 基础 AI` | P0 |
| B2 | 智能告警与瓶颈检测 | B | `🟢 无 AI` | P0 |
| B3 | 跨 Agent 会话浏览 | B | `🟢 无 AI` | P1 |
| B4 | 成本分析仪表板 | B | `🟢 无 AI` | P2 |
| C1 | 人工介入增强 | C | `🟢 无 AI` | P0 |
| C2 | 任务状态内联编辑 | C | `🟢 无 AI` | P1 |
| D1 | Agent Profile 持久化 | D | `🟡 基础 AI` | P0 |
| D2 | 高保真反馈捕获 | D | `🟢 无 AI` | P0 |
| D3 | TEAM_GUIDE 自动演化 | D | `🟡 基础 AI` | P1 |
| D4 | 会话记忆管理 | D | `🟡 基础 AI` | P1 |
| D5 | 冲突检测与可视化合并 | D | `🟢 无 AI` | P2 |
| E1 | 反馈驱动的偏好沉淀 | E | `🔵 Memory AI` | P0 |
| E2 | 规则化按需监督 | E | `🔵 Memory AI` | P1 |
| E3 | 跨团队知识迁移 | E | `🟡 基础 AI` | P2 |
| E4 | 语境摘要注入 | E | `🔵 Memory AI` | P2 |

### AI 依赖分布

```
🟢 无 AI (11 个功能)
   A1-A8, B2, B3, B4, C1, C2, D2, D5

🟡 基础 AI (5 个功能)
   B1, D1, D3, D4, E3

🔵 Memory AI (3 个功能)
   E1, E2, E4
```

---

## 风险与缓解

| 风险 | 影响 | 缓解策略 |
|------|------|----------|
| LLM 调用成本失控 | Stage B/D/E 功能的运营成本上升 | 摘要缓存 + 增量更新 + 用户触发而非自动触发 |
| 反馈信号稀疏 | Stage D/E 的偏好沉淀效果不足 | 降低评价门槛（一键 👍/👎），主动在高风险点提示用户评价 |
| 指令过度拟合 | 临时修复被泛化为永久规则 | LLM 分类 + 用户审核 + 偏好分级机制（试探性 → 确认性） |
| 记忆文件膨胀 | TEAM_GUIDE.md / MEMORY.md 超出上下文窗口 | 定期归档低频规则 + 分层存储（核心规则 vs 参考规则）+ 总长度硬限制 |
| 写操作破坏 Claude Code 状态 | 修改文件导致 CLI 行为异常 | 写操作前备份 + 严格遵守文件格式 + 限制写入范围 |
| 监督疲劳 | 告警过多导致用户关闭通知 | 可配置阈值 + 告警降噪（合并同类告警）+ E2 的规则化监督 |
| 记忆一致性 | 多个记忆文件之间的规则冲突 | 单一来源原则（反馈 → profile → 角色定义 → TEAM_GUIDE 的单向流转）|

---

*本文档基于 `wikis/product-proposal.md`（产品方案）、`wikis/product_stage_a.md`（Stage A PRD）、`wikis/cache-data-structure.md`（技术架构）及代码库现状编写。*
