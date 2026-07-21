---
name: smart-bugfix
description: Smart 官方认证缺陷流程 — 根因分析、限定范围实现、验证和归档
---

# Smart Bugfix 流程

先阅读 `smart/reference/workflow-runtime.md`。新缺陷执行：

```bash
smart run init <change-name> --workflow official/bugfix --route bugfix
```

编辑前明确现象、复现、入口、根因、修复范围和验证计划。已声明代码智能 assistant 时优先使用；不可用时
使用直接证据。随后根据实际 `currentStage` 调度 issue、build、verify 或 archive 适配器。

如果修复演变为架构调整、跨多个模块、新依赖、公共 API 或 Schema 变化，说明原因并等待确认，然后执行：

```bash
smart run switch <change-name> official/full --confirmed
```

用户可以选择已验证自定义流程替代官方 bugfix，解析后的 DAG 始终拥有最高优先级。
