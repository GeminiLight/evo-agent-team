### Team组织

- **Leader：**创建团队、生成Teammate和协调工作的主 Claude Code 会话
    - proactively：Lead 会主动判断任务是否值得开团队，而不总是等着你明确要求。

> *Use this tool proactively whenever the user explicitly asks to use a team, swarm, or group of agents, or a task is complex enough that it would benefit from parallel work.*
> 
- **Teammate：** 各自处理分配任务的独立 Claude Code 实例

> *IMPORTANT for teammates: Your plain text output is NOT visible to the team lead or other teammates. To communicate with anyone on your team, you MUST use the SendMessage tool.*
> 
- **TaskList：** Teammate认领和完成的工作项共享列表
    - 团队配置：`~/.claude/teams/{team-name}/config.json`，所有成员都可以访问。
    - 任务有三种状态：pending、in_progress、completed。
    - 任务之间可以设置依赖关系，被依赖的任务没完成时，下游任务就不能被领取。
    - 任务领取用的是文件锁机制来防止竞争条件，确保多个 Teammate 同时抢同一个任务时不会冲突。

> Teammates should check TaskList periodically, especially after completing each task. Claim unassigned, unblocked tasks with TaskUpdate. Prefer tasks in ID order (lowest ID first).
> 
- **Mailbox：** 代理之间通信的消息系统
    - 任务列表：`~/.claude/tasks/{team-name}/`
    
    通信机制支持三种消息类型：
    
    - `message`：点对点私信，发给特定 Teammate；
    - `broadcast`：广播消息，发给所有人，成本较高；
    - `shutdown_request` / `shutdown_response`：关停协议，Teammate 可以拒绝关停（比如“我还在处理任务 #3”）。
    - `plan_approval_response`。Lead 可以要求 Teammate 在做之前先写计划，Lead 审批通过后才允许执行，进一步保证了 Teammate 任务执行的质量。

### **上下文和通信**

每个Teammate有自己的上下文窗口。

- 生成时，Teammate加载与常规会话相同的项目上下文：[CLAUDE.md](http://claude.md/)、MCP 服务器和技能。
- 但是Leader的对话历史不会传递过来。

Teammate如何分享信息：

- 自动消息传递： 当Teammate发送消息时，自动传递给接收者
- 空闲通知： 当Teammate完成并停止时，自动通知Leader
- 共享任务列表： 所有代理可以看到任务状态并认领可用工作