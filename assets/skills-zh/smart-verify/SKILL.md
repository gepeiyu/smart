---
name: smart-verify
description: Smart Verify 阶段 — 规范漂移检测、验证报告、分支处理
---

# Smart Verify 阶段

## 职责

本阶段由 OpenSpec + Superpowers 共同负责，产生验证报告并处理分支。

## 产物语言

创建或更新产物前，读取已有的 `.smart/config.yaml`。`smart_language: zh` 使用中文，`smart_language: en` 使用英文；字段不存在时，使用触发本次工作流的用户请求语言。恢复已有变更时，如果现有产物已有明确主导语言，应保持该语言，除非用户明确要求切换。

将解析后的语言用于 `verification-report.md` 的正文，以及 `tasks.md` 中接受偏差的更新。路径、文件名、元数据键、命令、标识符和机器可读值保持不变。

## 工作流

1. **加载验证技能** — 加载 Superpowers 的 verification-before-completion 技能
2. **Handoff 哈希检查** — 检查 `handoff_hash` 检测规范漂移
   - 哈希匹配：跳过 tasks.md 重读（proposal.md 和 design.md 仍读）
   - 哈希不匹配：完全重读（检测到规范漂移）
3. **选择验证规模** — `light`（轻量）/ `full`（完整）
   - Light：6 项检查清单（模式流程）
   - Full：需求满足度 + 设计一致性 + 实现验证
4. **分支处理** — 合并分支或清理工作树
5. **生成验证报告** — 编写 verification report
6. **守卫验证** — 验证报告存在 + branch_status=handled，执行 `guard --apply verify-pass`

## 产物

| 产物 | 说明 |
|------|------|
| `verification-report.md` | 验证报告 |
| `.smart.yaml` | Smart 状态文件（phase=verify, verify_result=pass/fail）|

## 守卫条件

`verify-pass` 转换要求：
- `verification_report` 文件存在
- `branch_status=handled`

`verify-fail` 留出：
- 保留 `verification_report` 和 `branch_status`
- 返回 `/smart-build` 阶段

## 验证规模

| 模式 | 说明 |
|------|------|
| `light` | 6 项模式检查清单 |
| `full` | 需求满足度 + 设计一致性 + 实现验证 |

## 用户决策点

1. 验证通过/失败确认

## 下一阶段

- 通过：`/smart-archive`
- 失败：`/smart-build`（保留报告和分支状态）

## 参考

- `smart/reference/auto-transition.md`
- `smart/reference/smart-yaml-fields.md`
- `smart/reference/context-recovery.md`
- `smart/reference/debug-gate.md`

## 环境变量

参见 `smart` 技能。
