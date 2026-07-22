---
name: smart-archive
description: Smart Archive 阶段适配器 — 明确确认后执行解析出的归档 contract
---

# Smart Archive 阶段

先阅读 `smart/reference/workflow-runtime.md`。只有 `currentStage=archive` 且验证输入齐全时继续。

先展示归档目标、受影响产物、验证结果和残余风险，并等待本次操作的明确确认。以前的确认不能授权本次归档。

对于 `openspec.archive.instruction-driven.v1`，调用已安装 OpenSpec 的归档能力，由 OpenSpec 保持规格
增量同步和原生归档语义。其他 contract 调度其解析 actors 并检查声明输出。

验证原生归档和全部 `required_outputs` 后执行：

```bash
smart run advance <change-name> --stage archive
```

失败时保持 archive stage 并使用 `smart run block`，禁止直接编辑状态伪造成功。
