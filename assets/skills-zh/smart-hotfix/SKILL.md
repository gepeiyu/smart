---
name: smart-hotfix
description: Smart 热修复预设 — 跳过 Brainstorming，直接进入 Build → Verify → Archive
---

# Smart 热修复预设

## 概述

热修复（Hotfix）预设用于紧急缺陷修复，跳过 Brainstorming 阶段。

```
/smart-hotfix: open → build → verify → archive
```

## 差异

| 方面 | 完整工作流 | 热修复 |
|------|-----------|--------|
| Issue 阶段 | 完整需求澄清 + PRD 拆分 | 仅确认变更名称和范围 |
| Design 阶段 | Brainstorm + Design Doc | **跳过** |
| Build 阶段 | 完整构建流程 | 完整 |
| Verify 阶段 | 完整验证 | 完整 |
| Archive 阶段 | 完整归档 | 完整 |

## 工作流

1. **Open（Issue 轻量）** — 确认变更名称和范围，创建变更
2. **Build** — 完整构建流程（选择模式、实现、审查、提交）
3. **Verify** — 完整验证流程
4. **Archive** — 完整归档流程

## 配置

```yaml
# .smart.yaml
workflow: hotfix
phase: open
auto_transition: true
```

## 状态转换

```
open ──open-complete──→ build ──build-complete──→ verify ──verify-pass──→ archive
```

## 参考

- `smart` 主技能
- `smart/reference/smart-yaml-fields.md`
