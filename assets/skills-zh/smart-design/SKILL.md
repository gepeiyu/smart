---
name: smart-design
description: Smart Design 阶段 — 设计方法 Brainstorm、Design Doc、上下文 Handoff
---

# Smart Design 阶段

## 职责

本阶段由 Superpowers 负责，产生 Design Doc 和 Delta Spec。

## 工作流

1. **加载 Brainstorming 技能** — 加载 Superpowers 的设计方法 brainstorming 技能
2. **设计方法 Brainstorm** — 增量写入 brainstorm-summary.md
3. **用户确认设计方案** — 用户确认后继续
4. **主动上下文压缩门禁** — 提示用户是否启用上下文压缩
5. **创建 Design Doc** — 主线会话中完成 Design Doc 编写
6. **生成 Delta Spec** — 执行 `openspec sync` 同步规范
7. **上下文 Handoff** — `smart-handoff.sh` 生成上下文包 + SHA256 哈希
8. **守卫验证** — 验证 design_doc 存在，执行 `guard --apply design-complete`

创建 `docs/superpowers/` 下的文档前，优先读取 `.smart/config.yaml` 中的 `smart_language`：`zh` 使用中文，`en` 使用英文；字段不存在时，回退为触发本次工作流的用户请求语言。

## 产物

| 产物 | 说明 |
|------|------|
| `brainstorm-summary.md` | 设计方法 Brainstorm 摘要 |
| `design.md` / Design Doc | 设计文档 |
| Delta Spec | 通过 `openspec sync` 生成的增量规范 |
| `handoff-context.json` | 上下文 Handoff 包 |
| `.smart.yaml` | Smart 状态文件（phase=design）|

## 守卫条件

`design-complete` 转换要求：
- `design_doc` 字段已设置
- `design_doc` 文件存在

## 用户决策点

1. 设计方案确认
2. 上下文压缩选择

## 下一阶段

守卫通过后，自动进入 `/smart-build`（Build 阶段）。

## 参考

- `smart/reference/auto-transition.md`
- `smart/reference/context-recovery.md`
- `smart/reference/smart-yaml-fields.md`
- `smart/reference/debug-gate.md`

## 环境变量

参见 `smart` 技能。
