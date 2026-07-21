---
name: smart-design
description: Smart Design 阶段适配器 — 执行解析后的设计 contract 并验证设计证据
---

# Smart Design 阶段

先阅读 `smart/reference/workflow-runtime.md`。只有 `currentStage=design` 且依赖阶段全部完成时继续。

1. 加载全部必需输入，调度解析出的 owner/executors；participants 只承担声明的协作角色。
2. 分析约束、备选方案、风险、接口、数据流、测试和迁移影响。
3. 通过阻塞式用户决策确认关键设计选择。
4. 对 `superpowers.design.instruction-driven.v1`，加载已安装 Superpowers 的设计能力，生成设计文档
   和细化任务；OpenSpec 作为 participant 时，通过其适配器更新原生规格产物。

验证全部 `required_outputs` 并获得明确确认后执行：

```bash
smart run advance <change-name> --stage design
```

适配器或设计校验失败时使用 `smart run block`。参考 `decision-point.md` 和 `context-recovery.md`。
