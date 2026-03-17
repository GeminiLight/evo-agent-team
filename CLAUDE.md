# evo-agent-team

## Wiki 维护

开发过程中，以下操作需要同步更新对应 wiki 文件：

| 当你做了这件事 | 更新哪个文件 |
|--------------|------------|
| 新增/修改 API 路由 | `wiki/04-api-reference.md` 追加或修改对应条目 |
| 完成一个 stage 的功能 | `wiki/01-project-roadmap.md` 对应行状态改为 ✅ |
| 遇到非显而易见的坑 | `wiki/80-known-pitfalls.md` 追加一条（现象、原因、解法） |
| 多个 bug 互相关联、暴露系统性问题 | 新建 `wiki/82-postmortem-*.md`（单点问题用 pitfalls，系统性问题用 postmortem） |
| 架构变更（新模块、新数据流） | `wiki/02-system-architecture.md` 更新对应章节 |
| 阶段全部交付 | `wiki/90-changelog.md` 补一笔（从 backlog 已完成条目整理） |
| 发现 bug / 技术债 / 改进想法 | `wiki/85-backlog.md` 追加一条 |
| 新增设计 token / 动效 | `wiki/03-design-principle.md` 追加对应条目 |
| 重命名 / 移动 wiki 文件 | 同步更新所有引用该文件的链接 |

**新建文件时机：**
- 新功能复杂度超过一句话说清 → 新建 `wiki/1X-stage-X.md`
- 小功能 / 改进点需要 spec → 新建 `wiki/task-spec-xxx.md`（实现完成后归档或合并进 stage 文件）

**定期检查（每个阶段开始时）：**
- 扫描 wiki/ 下所有文件，更新 `Last verified` 日期
- 标出内容可能已过时的章节（加 `<!-- May be outdated -->` 注释）

不需要在每次 commit 时都更新——在功能完成、API 变更、架构调整这些"节点"时同步即可。
