# 异常调试协议

## 概述

当工作流中的阶段执行出现异常时，使用调试协议排查和恢复。

## 调试检查清单

1. **状态检查** — 运行 `smart status --json` 查看当前阶段和状态
2. **产物检查** — 确认所需产物文件是否存在
3. **YAML 校验** — 检查 `.smart.yaml` 字段完整性
4. **守卫日志** — 查看守卫拒绝的具体原因
5. **Handoff 检查** — 验证 handoff_hash 匹配（Design → Build 后）

## 常见问题

| 问题 | 原因 | 修复 |
|------|------|------|
| 守卫拒绝 `issue-complete` | proposal.md 或 tasks.md 缺失 | 重新生成缺失产物 |
| 守卫拒绝 `design-complete` | design_doc 字段未设置或文件缺失 | 完成 Design Doc 并设置路径 |
| 守卫拒绝 `build-complete` | 任务未全部勾选 | 完成并勾选所有任务 |
| 守卫拒绝 `verify-pass` | verification_report 不存在 | 生成验证报告 |
| 自动转换未触发 | auto_transition=false 或环境变量覆盖 | 手动运行下一阶段命令 |
| 规范漂移 | handoff_hash 不匹配 | 完全重读 tasks.md |

## 逃生口

```bash
# 强制设置阶段（仅在调试时使用）
SMART_FORCE_PHASE=1 smart-state set <change-name> phase <target-phase>
```

## 诊断命令

```bash
smart doctor            # 诊断安装健康状态
smart status --json     # 查看当前状态
```
