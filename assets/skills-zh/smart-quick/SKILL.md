---
name: smart-quick
description: Smart 官方认证快速流程 — 用于低风险小改并保留明确验证
---

# Smart Quick 流程

先阅读 `smart/reference/workflow-runtime.md`。仅对无需架构或跨模块协调的文案、文档、提示词或配置值小改使用：

```bash
smart run init <change-name> --workflow official/quick --route quick
```

调度解析出的 `currentStage`。官方 quick 预设省略 design，但仍要求需求、实现证据、验证和归档；小改不等于
无需测试。

影响多个模块、增加/删除配置结构、修改 API/Schema、需要大量新测试或需要规格/设计决策时，说明原因并
等待确认，然后执行：

```bash
smart run switch <change-name> official/full --confirmed
```

自定义工作流自行控制阶段，不得隐式继承 quick 的省略规则。
