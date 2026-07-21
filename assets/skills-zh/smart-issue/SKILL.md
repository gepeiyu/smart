---
name: smart-issue
description: Smart Issue 阶段适配器 — 执行解析后的需求 contract 并初始化可追踪产物
---

# Smart Issue 阶段

先阅读 `smart/reference/workflow-runtime.md`。只有 run 的 `currentStage=issue` 时才能继续。

1. 澄清需求、约束、验收标准和非目标；需要拆分时展示方案并等待明确确认。
2. 读取 issue stage，检查必需输入，调度声明的 owner/executors。
3. 对 `openspec.issue.instruction-driven.v1`，通过已安装 OpenSpec 适配器创建原生变更，并生成
   proposal、规格增量和任务清单。保留 OpenSpec 原生路径和元数据。
4. 其他 contract 使用对应已注册适配器，并严格验证声明的输出。

第三方不可用时不得模拟其能力，应通过 `smart run block` 记录具体原因。需要用户审阅时展示产物并等待
确认；全部 `required_outputs` 验证通过后只推进一次：

```bash
smart run advance <change-name> --stage issue
```

产物语言遵循 `.smart/config.yaml` 和已有文档语言。参考 `decision-point.md`。
