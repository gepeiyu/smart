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

它的核心思路是**编排而非替代**。Smart 提供用户入口、工作流解析、状态、门禁和第三方生命周期；具体能力由已注册集成完成。默认官方预设会协调 OpenSpec、Superpowers 和可选 CodeGraph，高级用户也可以继承预设并自定义阶段 DAG。

```
User Request
    ↓
[ Smart ]       — 预设/自定义 DAG · 状态 · 证据门禁
    ↓
[ OpenSpec    ] — 需求拆解、规范管理、生命周期
[ Superpowers ] — 设计方案、TDD 执行、代码审查
[ CodeGraph   ] — 语义索引、代码理解
```

这些第三方是官方预设绑定，不是 Smart 核心的硬依赖。几个设计原则贯穿始终：

- **非侵入集成** — 不修改任何外部工具，只通过 CLI 和文件交互
- **显式支持等级** — 区分官方认证、组件验证和本地信任，自定义流程不冒充官方认证
- **证据门禁** — 每个阶段必须登记声明的输入输出证据，缺失时状态机拒绝推进
- **谁产生谁管理** — Smart 只校验状态，不篡改产物
- **普通用户用预设，高级用户可扩展** — 初始化即可安装所需第三方，也可按项目定义特殊流程

---

## 解决的问题

| 问题                     | Smart 的做法                                                |
| ------------------------ | ----------------------------------------------------------- |
| Agent 中断后进度丢失     | 自动检测当前阶段，从断点恢复                                |
| 跳过必要步骤直接推进     | `required_inputs` / `required_outputs` 证据不完整时拒绝推进 |
| 设计和实现脱节           | DAG 依赖、工作流 digest 和持久 evidence 共同校验            |
| 第三方组合不适合特殊场景 | 继承官方预设，自定义 stage、checkpoint、owner 和 contract   |
| 每个平台重复配置         | 一次 `smart init` 装到所有平台                              |

---

## 工作流

普通用户直接选择经过验证的官方预设：

- `official/full`：完整开发流程，包含代码智能辅助
- `official/workflow`：不启用 CodeGraph 的完整流程
- `official/bugfix`：根因分析、实现、验证和归档
- `official/quick`：面向低风险小改的精简流程

完整预设仍按 Issue → Design → Build → Verify → Archive 推进。自定义流程可以插入用户检查点、删除或重排阶段、替换已注册 owner；解析器会校验 DAG、能力、contract、产物生产关系和信任策略。

```bash
smart workflow list
smart workflow create team-flow --extends official/full
smart workflow validate team-flow
smart workflow use team-flow
```

项目还可以声明用户管理的本地集成。Manifest 只能声明 capability、stage contract 和平台映射，
不能包含命令或代码；信任记录保存在用户级 `SMART_HOME`（默认 `~/.smart`），并绑定精确内容摘要：

```bash
smart integration create team-review \
  --capabilities review \
  --contracts team-review.run.v1 \
  --platforms codex
smart integration validate team-review
smart integration trust team-review --digest <validate 输出的 sha256>
```

Manifest 内容变化后旧信任自动失效，引用它的工作流也会产生新的 digest。Local integration 为
`user-managed`：Smart 负责编排、状态和诊断，不会自动安装或卸载它，也不提供官方组合兼容保证。

## Slash Commands

安装完成后，在 Claude Code、Cursor、OpenCode、Trae 等 AI 编码平台中使用这些命令驱动工作流：

| 命令                            | 说明                                                                  |
| ------------------------------- | --------------------------------------------------------------------- |
| `/smart <需求描述>` 或 `/smart` | 主入口。自动判断当前状态：新需求进入 Issue，已有变更从当前阶段恢复。  |
| `/smart-issue <需求描述>`       | 执行当前工作流的 Issue contract，并登记需求产物证据。                 |
| `/smart-design <change-name>`   | 基于 Issue 产出设计方案和增量规范。                                   |
| `/smart-build <change-name>`    | 根据解析后的 Build contract 实现代码，支持 TDD、子 Agent 和评审证据。 |
| `/smart-verify <change-name>`   | 运行验证，检查实现、测试、上下文完整性和归档条件。                    |
| `/smart-archive <change-name>`  | 明确确认后，调用当前 Archive contract 完成原生归档。                  |
| `/smart-bugfix <bug 描述>`      | Bug修复模式：先做根因分析，再进入 Build → Verify → Archive。          |
| `/smart-quick <小改动描述>`     | 快捷模式：跳过 Brainstorming 和 Plan，直接进行快捷 Build 和 Verify。  |

常见用法：

```text
/smart 添加用户导出功能
/smart-issue #123
/smart-design export-users
/smart-build export-users
/smart-verify export-users
/smart-archive export-users
/smart-bugfix 修复登录后偶发跳回首页的问题
/smart-quick 修改按钮文案和 README 说明
```

---

## CLI 命令

| 命令                                                         | 功能                                     |
| ------------------------------------------------------------ | ---------------------------------------- |
| `smart init [path]`                                          | 检测 AI 平台，安装流水线技能             |
| `smart status [path]`                                        | 查看当前工作流状态                       |
| `smart dashboard [path]`                                     | 打开 Web 仪表盘（默认 `127.0.0.1:5271`） |
| `smart doctor [path]`                                        | 诊断环境健康度                           |
| `smart update [path]`                                        | 升级 Smart 和技能文件                    |
| `smart uninstall [path]`                                     | 卸载 Smart 组件                          |
| `smart workflow list/create/validate/use/export`             | 管理官方预设和项目自定义流程             |
| `smart integration list/create/validate/trust/untrust`       | 管理官方集成和显式信任的本地声明式集成   |
| `smart run init/status/evidence/advance/block/resume/switch` | 管理单个变更的 DAG 运行状态和证据        |

初始化时可用 `--preset full` 选择官方预设，或用 `--workflow <id-or-yaml>` 选择自定义流程。`smart uninstall` 默认保留第三方，避免误删用户自行安装或共享的工具。

初始化选择的 AI 平台会写入 `.smart/config.yaml` 的 `platforms`。Status、Doctor 和 Dashboard 只针对这些项目平台检查 Smart 技能与 Integration；项目中其他工具创建的 `.cursor`、`.codex` 等目录不会被自动视为启用平台。重复运行 `smart init` 可以更新平台选择。

### 项目状态与诊断

`status`、`dashboard` 和 `doctor` 使用同一份版本化项目快照，因此 Workflow 漂移、运行状态、Integration 健康和修复建议在三个入口中保持一致：

```bash
# 当前运行和需要处理的诊断
smart status

# 包含已完成运行
smart status --all

# 聚焦单个运行，或展开平台、Integration 和 Git 信息
smart status --change export-users
smart status --verbose

# 打开只读 Dashboard；也可以只输出快照 JSON
smart dashboard
smart dashboard --no-open --port 5271
smart dashboard --json

# 分组检查项目、Workflow、平台、Integration 和运行状态
smart doctor

# 只执行明确标记为可自动修复的 Smart-managed 项目
# 修复后会重新检查；user-managed Integration 永远不会被修改
smart doctor --fix
```

三个命令默认读取初始化时写入 `.smart/config.yaml` 的 `smart_language`，自动显示中文或英文。需要临时切换时，可在任一命令后添加 `--lang zh` 或 `--lang en`（`--language` 是等价写法），不会修改项目配置。

Dashboard 页面右上角也可以选择“跟随项目 / 中文 / English”。页面内切换只在当前页面会话生效，不写项目配置；刷新页面后重新跟随项目语言。

三个命令均支持结构化输出。`smart status --json` 和 `smart dashboard --json` 返回 `ProjectSnapshot v1`；`smart doctor --json` 返回 `{ snapshot, fixes }`。快照中的 `language` 表示本次展示语言；诊断 ID、状态值和命令保持稳定，不随语言变化。

---

## 系统要求

- Node.js >= 20
- Git

---

## License

MIT
