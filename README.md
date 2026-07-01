# @gepeiyu/smart

**AI 工作流编排引擎** — 将 AI 编码 Agent 的开发流程从"人工提醒"升级为"自动推进"。

```
OpenSpec (WHAT)  +  Superpowers (HOW)  =  Smart (ORCHESTRATION OS)
```

---

## 快速开始

```bash
npm install -g @gepeiyu/smart
cd your-project
smart init
```

之后在 AI Agent（Claude Code、Cursor 等）中运行 `/smart` 即可启动工作流。

---

## 解决的问题

| 问题 | Smart 方案 |
|------|-----------|
| Agent 中断后丢失进度 | 一次 `/smart` 自动检测当前阶段并恢复 |
| 阶段跳过的"我好了"陷阱 | Guard 脚本硬校验前置条件，不满足不放行 |
| 手动同步文档（设计文档/规范/任务清单） | Handoff 自动生成上下文包 + SHA256 完整性 |
| 错误阶段写入源码 | Hook Guard 在 PreToolUse 时硬阻断 |
| 跨平台技能部署 | `smart init` 一次安装到所有支持的 AI 平台 |

---

## 5 阶段工作流

```
Issue → Design → Build → Verify → Archive
```

1. **Issue** — OpenSpec 创建提案、设计和任务清单
2. **Design** — Superpowers 头脑风暴，生成设计文档 + 增量规范
3. **Build** — Superpowers 执行实现（TDD 模式、子 Agent、分支隔离）
4. **Verify** — OpenSpec + Superpowers 联合验证，检查 Handoff 完整性
5. **Archive** — OpenSpec 合并增量，归档到 `.smart/archive/`

**预设流程：**
- `/smart-hotfix` — 跳过设计，直接构建
- `/smart-tweak` — 跳过设计和规划，轻量修改

---

## CLI 命令

| 命令 | 用途 |
|------|------|
| `smart init [path]` | 初始化 Smart，检测 AI 平台并安装技能 |
| `smart status [path]` | 显示当前工作流状态 |
| `smart dashboard [path]` | 启动 Web 仪表盘（默认 `127.0.0.1:4321`）|
| `smart doctor [path]` | 诊断安装健康状态 |
| `smart update` | 更新 npm 包和技能文件 |
| `smart uninstall [path]` | 卸载 Smart 组件 |

所有命令支持 `--json` 输出。

---

## 支持的平台

Claude Code, Cursor, Codex, OpenCode, Trae

---

## 系统要求

- Node.js >= 20
- Git
- Bash 兼容环境（Windows 使用 Git Bash）

---

## 架构概览

```
User Request
    ↓
[CLI Layer]      — Commander 命令（init, status, dashboard, doctor, update, uninstall）
    ↓
[Core Layer]     — 状态机、Guard 引擎、Context Handoff、Adapter 注册
    ↓
[Skill Layer]    — 部署到 AI 平台的 SKILL.md 文件
    ↓
[Script Layer]   — Shell 脚本（smart-state, smart-guard, smart-handoff 等）
    ↓
[External Tools] — OpenSpec, Superpowers, CodeGraph
```

---

## 相关文档

- [`prd/`](prd/) — 完整产品设计文档（14 篇）
- [OpenSpec](https://github.com/gepeiyu/openspec) — 规范与生命周期工具
- [Superpowers](https://github.com/gepeiyu/superpowers) — TDD 执行引擎
- [CodeGraph](https://github.com/anomalyco/codegraph) — 语义代码索引

---

## License

MIT
