---
name: smart-issue
description: Smart Issue 阶段 — 需求澄清、PRD 拆分、变更创建
---

# Smart Issue 阶段

## 职责

本阶段由 OpenSpec 负责，产生提案、设计和任务文档。

## 工作流

1. **需求澄清** — 用户确认门禁，澄清需求范围
2. **变更名称确认** — 2-3 个 kebab-case 候选名称，ASCII 校验
3. **PRD 拆分预检** — 大 PRD 自动分流为多个变更
4. **变更创建** — 执行 `openspec new change` 创建变更目录
5. **产物生成** — 使用 OpenSpec 逐 artifact JSON 指令生成 proposal.md / design.md / tasks.md
6. **守卫验证** — 验证 artifacts 存在，执行 `guard --apply issue-complete`

生成产物前，优先读取 `.smart/config.yaml` 中的 `smart_language`：`zh` 使用中文，`en` 使用英文；字段不存在时，回退为触发本次工作流的用户请求语言。

## 产物

| 产物 | 说明 |
|------|------|
| `proposal.md` | 变更提案文档 |
| `design.md` | 设计方案文档 |
| `tasks.md` | 任务清单 |
| `.smart.yaml` | Smart 状态文件（phase=issue）|

## 守卫条件

`issue-complete` 转换要求：
- `proposal.md` 存在
- `tasks.md` 存在

## 用户决策点

1. 需求澄清确认
2. 变更名称确认
3. PRD 拆分决策

## 下一阶段

守卫通过后，自动进入 `/smart-design`（Design 阶段）。

## 参考

- `smart/reference/smart-yaml-fields.md`
- `smart/reference/decision-point.md`
- `smart/reference/file-structure.md`

## 环境变量

参见 `smart` 技能。
