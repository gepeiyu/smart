---
description: Smart 阶段守卫规则 — 每轮对话注入，提醒 Agent 当前阶段和所需产物
---

# Smart 阶段守卫规则

## 职责

本规则在每轮对话中注入系统提示，确保 Agent 在当前阶段只能操作允许的产物，防止阶段漂移。

## 规则

### 当前阶段感知

Agent 必须始终知道当前所在的 Smart 工作流阶段。通过读取 `.smart.yaml` 中的 `phase` 字段确定。

### 阶段产物

| 阶段 | 允许产物 | 禁止写入 |
|------|---------|---------|
| `open` | `proposal.md`, `design.md`, `tasks.md`, `specs/**/*.md` | 源码文件 |
| `design` | `brainstorm-summary.md`, `design.md`, `specs/**/*.md`, `plans/**/*.md` | 源码文件 |
| `build` | `src/**`, `lib/**`, `tests/**`, `plans/**/*.md` | — |
| `verify` | `verification-report.md` | 源码文件（仅读） |
| `archive` | 只读 | 源码文件（仅读） |

### 硬性约束

在 **非 build 阶段**：
- 禁止写入或修改 `src/`、`lib/`、`tests/` 下的源码文件
- 允许写入 `openspec/*`、`docs/superpowers/*`、`.smart/*`、`.claude/*`

### 提示模板

```
[Smart Guard] 当前阶段：<phase>
[Smart Guard] 当前变更：<change-name>
[Smart Guard] 下一命令：<next-command>
[Smart Guard] 产物要求：<required-artifacts>
```

## 参考

- `smart/reference/smart-yaml-fields.md`
- `smart/reference/file-structure.md`
- `smart/reference/debug-gate.md`
