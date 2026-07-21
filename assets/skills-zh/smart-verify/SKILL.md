---
name: smart-verify
description: Smart Verify 阶段适配器 — 协调解析出的 executors 并生成可审计验证证据
---

# Smart Verify 阶段

先阅读 `smart/reference/workflow-runtime.md`。只有 `currentStage=verify` 时继续。

## 产物语言

读取 `.smart/config.yaml`。`smart_language: zh` 使用中文，`smart_language: en` 使用英文；字段缺失时
使用用户请求语言。已有产物保持其主导语言。路径、文件名、标识符、元数据和机器值保持不变。

1. 加载全部声明输入并检查真实工作树，不能只依赖先前摘要。
2. 精确调度解析出的 owner/executors，收集每一方证据。
3. 执行适当的测试、构建、静态检查、验收检查和产物一致性检查。
4. 需要处理分支或 worktree 时，通过阻塞式用户决策确认。

对于 `smart.verify-coordination.v1`，把 executor 证据汇总成一份报告，列出命令、结果、未满足需求、
已接受偏差和残余风险。assistant 不能把失败变成通过。

失败时写报告并执行：

```bash
smart run block <change-name> "verification failed: <summary>"
```

修复或处理偏差后才能 `smart run resume`；失败状态不得推进。全部 `required_output` 通过后，分别用
`smart run evidence <change-name> <artifact-id> <evidence-value>` 登记证据，再执行：

```bash
smart run advance <change-name> --stage verify
```
