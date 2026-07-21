# 上下文恢复

Smart run 和最新解析的工作流是状态事实来源。第三方产物只是支持证据，必须按当前 stage 绑定读取。

## 概述

Smart 的核心价值之一是 Agent 中断后自动恢复进度。通过 `.smart.yaml` 状态字段实现。

## 恢复流程

```
/smart
  → 读取 .smart.yaml 的 phase 字段
  → 根据 phase 加载对应阶段技能
  → 读取已有产物
  → 从断点继续执行
```

## 恢复点

| 阶段 | 恢复点 | 前置条件 |
|------|--------|---------|
| `issue` | 需求澄清 | 产物不存在时重新开始 |
| `design` | Brainstorm / Design Doc | 读取 brainstorm-summary.md（如存在）|
| `build` | 未完成任务 | 读取 tasks.md 找到未勾选任务 |
| `verify` | 验证 | 读取 handoff_hash 检测漂移 |
| `archive` | 归档确认 | 读取 verify_result |

## Handoff 上下文

Design → Build 交接时生成上下文包：

```
smartdocs/changes/<name>/handoff/
├── design-context.json    # 设计上下文
├── spec-context.json      # 规范上下文
└── spec-context.md        # 规范摘要
```

SHA256 哈希写入 `.smart.yaml` 的 `handoff_hash`，用于 Verify 阶段检测规范漂移。

## 环境变量

```bash
SMART_CONTEXT_COMPRESSION=beta    # off | beta
```

## 恢复示例

```bash
# Agent 中断后重新运行
/smart
# Smart 自动检测当前阶段并恢复
```
