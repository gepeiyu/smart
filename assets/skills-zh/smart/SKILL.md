---
name: smart
description: Smart AI 工作流编排引擎 — 状态机驱动的 5 阶段管线（Issue → Design → Build → Verify → Archive）
---

# Smart — AI 工作流编排引擎

## 概述

Smart 是一个 **AI 工作流编排引擎**，通过状态机驱动的 5 阶段管线（Issue → Design → Build → Verify → Archive），将 AI 编码 Agent 的开发流程从"人工提醒"升级为"自动推进"。

```
/smart-issue ──→ /smart-design ──→ /smart-build ──→ /smart-verify ──→ /smart-archive
```

## 命令

| 命令 | 说明 |
|------|------|
| `/smart` | 自动检测当前阶段并恢复工作流 |
| `/smart-issue` | Issue 阶段 — 需求澄清、PRD 拆分、变更创建 |
| `/smart-design` | Design 阶段 — 设计方法 Brainstorm、Design Doc、上下文 Handoff |
| `/smart-build` | Build 阶段 — 子代理调度、TDD 实现、代码审查、提交 |
| `/smart-verify` | Verify 阶段 — 规范漂移检测、验证报告、分支处理 |
| `/smart-archive` | Archive 阶段 — Delta 合并、注释、归档 |
| `/smart-bugfix` | Smart Bug修复模式 - 根因分析 → Build → Verify → Archive |
| `/smart-quick` | Smart 快捷模式 — 跳过 Brainstorming 和 Plan，直接进行快捷的Build和Verify |

## 核心机制

- **状态机**: `.smart.yaml` 驱动，5 阶段 + 6 种命名转换
- **守卫**: `smart-guard.sh` 硬校验前置条件，不满足不放行
- **Handoff**: `smart-handoff.sh` 设计→构建上下文传递 + SHA256 完整性
- **阶段写入守卫**: `smart-hook-guard.sh` PreToolUse 硬阻断错误阶段写入
- **Phase Guard Rule**: 每轮对话注入，提醒当前阶段和所需产物

## 环境变量

| 变量 | 说明 |
|------|------|
| `SMART_ENV` | 环境标识 |
| `SMART_GUARD` | 守卫引擎路径 |
| `SMART_STATE` | 状态机路径 |
| `SMART_HANDOFF` | 上下文 Handoff 脚本路径 |
| `SMART_ARCHIVE` | 归档脚本路径 |
| `SMART_YAML_VALIDATE` | YAML 校验脚本路径 |
| `SMART_BASH` | Bash 兼容 shell 路径 |

## 使用方式

```bash
# 在工作流中进行到任意阶段时运行
/smart

# 或直接进入特定阶段
/smart-issue
/smart-design
/smart-build
/smart-verify
/smart-archive
```

## 参考文档

- `smart/reference/auto-transition.md` — 自动转换
- `smart/reference/smart-yaml-fields.md` — .smart.yaml 字段参考
- `smart/reference/context-recovery.md` — 上下文恢复
- `smart/reference/debug-gate.md` — 异常调试协议
- `smart/reference/decision-point.md` — 9 个用户决策点
- `smart/reference/dirty-worktree.md` — 脏工作树处理
- `smart/reference/file-structure.md` — 文件结构
- `smart/reference/subagent-dispatch.md` — 子代理调度

## 相关技能

- `smart-issue` — Issue 阶段
- `smart-design` — Design 阶段
- `smart-build` — Build 阶段
- `smart-verify` — Verify 阶段
- `smart-archive` — Archive 阶段
- `smart-bugfix` — Smart Bug修复模式
- `smart-quick` — Smart 快捷模式
