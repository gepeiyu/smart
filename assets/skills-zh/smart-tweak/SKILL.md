---
name: smart-tweak
description: Smart 微调预设 — 跳过 Brainstorming 和 Plan，轻量 Build + 轻量 Verify
---

# Smart 微调预设

## 概述

微调（Tweak）预设用于小型调整，跳过 Brainstorming 和 Plan 阶段，使用轻量验证。

```
/smart-tweak: open → light build → light verify → archive
```

## 差异

| 方面 | 完整工作流 | 微调 |
|------|-----------|------|
| Issue 阶段 | 完整需求澄清 | 仅确认变更范围 |
| Design 阶段 | Brainstorm + Plan | **跳过** |
| Build 阶段 | 完整构建 | **轻量**（直接实现，无子代理） |
| Verify 阶段 | 完整验证 | **轻量**（6 项检查清单） |
| Archive 阶段 | 完整归档 | 完整 |

## 工作流

1. **Open（Issue 轻量）** — 确认变更范围，创建变更
2. **Light Build** — 直接实现，不经过子代理和完整审查
3. **Light Verify** — 6 项预设检查清单
4. **Archive** — 完整归档流程

## 配置

```yaml
# .smart.yaml
workflow: tweak
phase: open
auto_transition: true
build_mode: direct
verify_mode: light
```

## 状态转换

```
open ──open-complete──→ build ──build-complete──→ verify ──verify-pass──→ archive
```

## 参考

- `smart` 主技能
- `smart/reference/smart-yaml-fields.md`
- `smart/reference/auto-transition.md`
