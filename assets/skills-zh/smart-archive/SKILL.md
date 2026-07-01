---
name: smart-archive
description: Smart Archive 阶段 — Delta 合并、注释、归档
---

# Smart Archive 阶段

## 职责

本阶段由 OpenSpec 负责，完成变更归档。

## 工作流

1. **用户确认门禁** — 用户确认归档操作
2. **`smart-archive.sh` 执行**:
   - 验证入口状态
   - Delta → Main Spec 合并（OpenSpec delta 语义）
   - 注释 Design Doc 和 Plan frontmatter
   - 移动变更到归档目录
   - 更新 `archived: true`

## 产物

| 产物 | 说明 |
|------|------|
| 归档的变更目录 | 移动到归档目录的完整变更 |
| 更新的 Main Spec | Delta 合并后的主规范 |
| 注释的 Design Doc | 已添加归档注释的设计文档 |
| `.smart.yaml` | Smart 状态文件（archived=true）|

## 守卫条件

`archived` 转换要求：
- `verify_result=pass`

`archive-reopen` 转换：
- 用户拒绝归档确认时退回 `/smart-verify`

## 用户决策点

1. 归档确认（确认 → 归档完成；拒绝 → 返回 Verify）

## 参考

- `smart/reference/smart-yaml-fields.md`
- `smart/reference/file-structure.md`
- `smart/reference/debug-gate.md`

## 环境变量

参见 `smart` 技能。
