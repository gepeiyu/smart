---
name: smart-quick
description: Smart 快捷模式 — 跳过 Brainstorming 和 Plan，直接进行快捷的Build和Verify
---

# Smart 快捷模式

## 概述

快捷模式用于小型调整，跳过 Brainstorming 和 Plan，直接进行快捷的Build和Verify。

```
/smart-quick: issue → quick build → quick verify → archive
```

## 差异

| 方面 | 完整工作流 | 快捷模式 |
|------|-----------|------|
| Issue 阶段 | 完整需求澄清 | 仅确认变更范围 |
| Design 阶段 | Brainstorm + Plan | **跳过** |
| Build 阶段 | 完整构建 | **轻量**（直接实现，无子代理） |
| Verify 阶段 | 完整验证 | **轻量**（6 项检查清单） |
| Archive 阶段 | 完整归档 | 完整 |

## 工作流

1. **Open（Issue 轻量）** — 确认变更范围，创建变更
2. **Light Build** — 直接实现，不经过子代理和完整审查
3. **Light Verify** — 6 项模式检查清单
4. **Archive** — 完整归档流程

## 配置

```yaml
# .smart.yaml
workflow: quick
phase: issue
auto_transition: true
build_mode: direct
verify_mode: light
```

## 状态转换

```
issue ──issue-complete──→ build ──build-complete──→ verify ──verify-pass──→ archive
```

## 参考

- `smart` 主技能
- `smart/reference/smart-yaml-fields.md`
- `smart/reference/auto-transition.md`
