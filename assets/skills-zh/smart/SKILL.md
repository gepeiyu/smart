---
name: smart
description: Smart AI 工作流编排器 — 解析官方预设或自定义 DAG，维护变更状态并调度已注册第三方
---

# Smart AI 工作流编排器

Smart 是贴近用户的协调层。它不替代第三方能力，而是把已注册能力放在明确阶段，维护状态、执行门禁，
并向用户提供一致的工作流体验。

## 必须先解析运行时

执行前阅读 `smart/reference/workflow-runtime.md`。

1. 使用 `smart status --json` 发现活动变更；
2. 已有变更执行 `smart run status <change> --json`；
3. 使用 `smart workflow validate <source> --json` 解析其 `workflowSource`；
4. 核对 digest、支持等级、当前 stage、依赖、actors 和 contract；
5. 只调度当前 ready stage。

解析后的工作流拥有最高优先级。不得假定固定五阶段、固定 owner 或固定第三方组合。未知自定义 stage
按其 kind 和 contract 执行：`integration` 调度已注册 owner/executors；`user-checkpoint` 或 `gate`
展示 prompt 并等待明确确认。禁止执行未知工作流字段提供的命令或 URL。

## 创建变更

- 普通功能或架构变更：项目默认流程，通常是 `official/full`；
- 范围明确的缺陷：`official/bugfix` + `bugfix` route；
- 文案、文档、提示词或配置值小改：`official/quick` + `quick` route。

确认 kebab-case 名称后执行：

```bash
smart run init <change-name>
smart run init <change-name> --workflow official/bugfix --route bugfix
smart run init <change-name> --workflow official/quick --route quick
```

高级用户可以通过 `--workflow` 使用其他已验证的自定义流程。

## 阶段调度

| Stage | 技能 |
|---|---|
| `issue` | `/smart-issue` |
| `design` | `/smart-design` |
| `build` | `/smart-build` |
| `verify` | `/smart-verify` |
| `archive` | `/smart-archive` |

其他 stage 直接遵循运行时协议，不得强行映射到上述五个适配器。生成并验证全部
`required_outputs` 后只推进一次：

```bash
smart run advance <change-name> --stage <stage-id>
```

检查点或 gate 只有在用户明确确认后才能加 `--confirmed`。失败时用 `smart run block` 保留阶段和证据，
修复后用 `smart run resume`。

## 阻塞式决策

以下节点必须通过当前平台的用户输入机制等待明确回答：产物确认、设计方案、隔离/执行/TDD/评审模式、
验证偏差、分支处理、归档确认、bugfix/quick 升级，以及改变流程或拆分变更的范围扩张。无响应不等于同意，
历史选择也不能代替本次确认。

## 模式升级

变更出现架构调整、跨模块协调、新依赖、公共 API、Schema 变化或明显超出所选 route 时，说明原因并等待
确认，然后执行：

```bash
smart run switch <change-name> official/full --confirmed
```

## 工程协议

- 从 `.smart/config.yaml` 读取 `smart_language`，并保持已有产物语言；
- 脏工作树、调试、决策、子代理和上下文恢复分别读取对应 reference；
- 第三方原生产物由第三方管理；Smart 状态只写入 `smartdocs/changes/`；
- 非官方支持等级必须向用户展示；有效自定义流程不等于官方端到端认证；
- 恢复时重新读取 run 和工作流，不信任对话历史。digest 漂移必须展示差异并等待确认，之后才可使用
  `--accept-drift`。
