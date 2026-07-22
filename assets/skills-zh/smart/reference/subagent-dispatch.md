# 子代理调度

先解析当前 build stage。下文涉及 Superpowers 或 OpenSpec 的内容仅是官方适配器细节，只有对应集成
被 stage 声明时才适用。协调进度写入 `smartdocs/changes/<name>/coordination/`，不得写入第三方变更目录。

## 概述

Build 阶段的 `subagent-driven-development` 模式使用独立子代理完成每个任务的实现。

## 工作流

```
Build 阶段
  → 加载计划编写技能
  → 子代理生成实现计划
  → 子代理调度器为每个任务分配子代理
  → 每个子代理独立实现任务
  → 任务结果收集和验证
  → 审查（如启用）
  → 提交
```

## 调度模式

| 模式 | 说明 |
|------|------|
| `subagent-driven-development` | 每任务使用独立子代理，并行度可配置 |
| `executing-plans` | 按预定义计划顺序执行 |
| `direct` | 主 Agent 直接实现，不经过子代理 |

## 子代理配置

```yaml
# .smart.yaml
build_mode: subagent-driven-development
subagent_dispatch: confirmed   # null | confirmed
```

`subagent_dispatch: null` 时，Agent 应在调度前请求用户确认。

## TDD 模式

| 模式 | 说明 |
|------|------|
| `tdd` | 先写测试，再实现，再验证 |
| `direct` | 直接实现，后补测试 |

## 审查模式

| 模式 | 说明 |
|------|------|
| `off` | 不执行审查 |
| `standard` | 标准审查（自动检查） |
| `thorough` | 全面审查（子代理交叉审查） |

## 安全

- 子代理仅操作分配给它的任务目录
- 任务间隔离保障
- 所有变更通过 Guard 校验
