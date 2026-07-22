---
name: smart-build
description: Smart Build 阶段适配器 — 执行解析后的实现 contract，形成测试和评审证据
---

# Smart Build 阶段

先阅读 `smart/reference/workflow-runtime.md`。只有 `currentStage=build` 时继续。

## 产物语言

读取 `.smart/config.yaml`。`smart_language: zh` 使用中文，`smart_language: en` 使用英文；字段缺失时
使用用户请求语言。已有产物保持其主导语言。路径、文件名、标识符、元数据和机器值保持不变。

实现前获取 contract 要求的明确选择：branch/worktree 隔离、直接或计划驱动执行、TDD 模式和评审深度。
按 `dirty-worktree.md` 保护无关用户改动。

对于 `superpowers.build.instruction-driven.v1`，加载已安装 Superpowers 的规划与执行能力；需要时生成
实现计划，再按任务粒度实现、测试和评审。选择子代理时遵循 `subagent-dispatch.md`，协调者必须维护
持久任务进度。其他 contract 只调度声明的 actors；assistant 可以提供代码上下文，但不拥有实现。

测试或构建失败时遵循 `debug-gate.md`。不得仅凭代理报告判定完成，必须检查工作树并实际运行验证。
全部 `required_output` 齐全后，分别执行
`smart run evidence <change-name> <artifact-id> <evidence-value>` 登记证据，然后推进：

```bash
smart run advance <change-name> --stage build
```

范围超过 bugfix/quick 时，确认后执行 `smart run switch <change-name> official/full --confirmed`。
