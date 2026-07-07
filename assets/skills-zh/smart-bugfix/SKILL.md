---
name: smart-bugfix
description: Smart Bug修复模式 - 根因分析 → Build → Verify → Archive
---

# Smart Bug修复模式

## 概述

Bug修复模式用于缺陷修复，先优先使用 CodeGraph 完成根因分析，再进入 Build、Verify 和 Archive。

```
/smart-bugfix: 根因分析 → Build → Verify → Archive
```

## 差异

| 方面 | 完整工作流 | Bug修复模式 |
|------|-----------|--------|
| 根因分析 | Design 阶段完成完整问题建模 | 定位缺陷根因和修复范围 |
| Design 阶段 | Brainstorm + Design Doc | **跳过** |
| Build 阶段 | 完整构建流程 | 完整 |
| Verify 阶段 | 完整验证 | 完整 |
| Archive 阶段 | 完整归档 | 完整 |

## 工作流

1. **根因分析** — 明确缺陷表现、复现路径、影响范围和根因；涉及源码行为时优先使用 CodeGraph 定位入口、调用链和影响面
2. **Build** — 实现修复
3. **Verify** — 验证修复结果
4. **Archive** — 完整归档流程

## 根因结论

进入 Build 前记录最小根因结论：

```md
Root cause:
- Symptom:
- Reproduction:
- Entry point:
- Root cause:
- Fix scope:
- Verification:
```

## 配置

```yaml
# .smart.yaml
workflow: bugfix
phase: issue
auto_transition: true
```

## 状态转换

```
root cause ──analysis-complete──→ build ──build-complete──→ verify ──verify-pass──→ archive
```

## 参考

- `smart` 主技能
- `smart/reference/smart-yaml-fields.md`
