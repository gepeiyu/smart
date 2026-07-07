# @gepeiyu/smart

**AI 开发流水线管理器** — 一次安装，跑通所有主流编码平台。

```bash
npm install -g @gepeiyu/smart
cd your-project
smart init
```

之后在 Claude Code、Cursor、OpenCode、Trae 等平台中直接运行 `/smart`。

---

## 理念

AI 编码工具越来越强，但开发流程还是靠人记：现在该写设计文档了、任务做完了吗、别忘了验证。Smart 把这件事自动化了。

它的核心思路是**编排而非替代**。OpenSpec 负责需求与规范，Superpowers 负责 TDD 执行，CodeGraph 负责代码理解——Smart 站在它们之上，像操作系统管理进程一样，用状态机驱动开发流程自动推进。

```
User Request
    ↓
[ Smart ]       — 状态机 · 守卫 · 上下文传递
    ↓
[ OpenSpec    ] — 需求拆解、规范管理、生命周期
[ Superpowers ] — 设计方案、TDD 执行、代码审查
[ CodeGraph   ] — 语义索引、代码理解
```

几个设计原则贯穿始终：

- **非侵入集成** — 不修改任何外部工具，只通过 CLI 和文件交互
- **软硬双层防护** — Rule 每轮提醒 + Hook 硬拦截，纵深防御
- **谁产生谁管理** — Smart 只校验状态，不篡改产物
- **一次定义，到处部署** — 一份配置装到所有 AI 平台

---

## 解决的问题

| 问题 | Smart 的做法 |
|------|------------|
| Agent 中断后进度丢失 | 自动检测当前阶段，从断点恢复 |
| 跳过必要步骤直接写代码 | Guard 脚本硬校验，不满足不放行 |
| 设计和实现脱节 | 阶段切换时自动打包上下文，SHA256 校验 |
| 错误阶段写入源码 | Hook Guard 在写入前拦截 |
| 每个平台重复配置 | 一次 `smart init` 装到所有平台 |

---

## 流水线

一次开发任务分为 5 个阶段，由状态机驱动依次推进：

```
任务拆分 → 方案设计 → 编码实现 → 验证确认 → 归档收尾
```

1. **Issue** — OpenSpec 拆解需求，生成提案、设计文档和任务清单
2. **Design** — Superpowers 设计方案，产出设计文档和增量规范
3. **Build** — Superpowers 按规范编码，支持 TDD、子 Agent、分支隔离
4. **Verify** — OpenSpec + Superpowers 联合验证，检查上下文完整性
5. **Archive** — OpenSpec 合并增量，归档成果

**快捷入口：**
- `/smart-bugfix` — Smart Bug修复模式 - 根因分析 → Build → Verify → Archive
- `/smart-quick` — Smart 快捷模式 — 跳过 Brainstorming 和 Plan，直接进行快捷的Build和Verify

---

## CLI 命令

| 命令 | 功能 |
|------|------|
| `smart init [path]` | 检测 AI 平台，安装流水线技能 |
| `smart status [path]` | 查看当前工作流状态 |
| `smart dashboard [path]` | 打开 Web 仪表盘（默认 `127.0.0.1:5271`）|
| `smart doctor [path]` | 诊断环境健康度 |
| `smart update [path]` | 升级 Smart 和技能文件 |
| `smart uninstall [path]` | 卸载 Smart 组件 |

`init`、`status`、`dashboard`、`doctor`、`update`、`uninstall` 均支持 `--json` 输出。

---

## 系统要求

- Node.js >= 20
- Git
- Bash 兼容环境（Windows 用 Git Bash）

---

## License

MIT
