---
name: smart-build
description: Smart Build 阶段 — 子代理调度、TDD 实现、代码审查、提交
---

# Smart Build 阶段

## 职责

本阶段由 Superpowers 负责，产生实现计划和代码提交。

## 产物语言

创建或更新产物前，读取已有的 `.smart/config.yaml`。`smart_language: zh` 使用中文，`smart_language: en` 使用英文；字段不存在时，使用触发本次工作流的用户请求语言。恢复已有变更时，如果现有产物已有明确主导语言，应保持该语言，除非用户明确要求切换。

将解析后的语言用于 `docs/superpowers/plans/` 和 `tasks.md` 的正文。路径、文件名、元数据键、命令、标识符和机器可读值保持不变。

## 工作流

1. **选择构建模式** — `subagent-driven-development` / `executing-plans` / `direct`
2. **选择隔离模式** — `branch`（分支） / `worktree`（工作树）
3. **选择 TDD 模式** — `tdd` / `direct`（直接实现）
4. **选择审查模式** — `off`（关闭） / `standard`（标准） / `thorough`（全面）
5. **加载计划编写技能** — 子代理卸载创建实现计划
6. **逐任务实现** — 按 TDD 模式或子代理调度逐项实现
7. **代码审查** — review_mode 非 off 时执行审查
8. **逐任务提交** — 按任务粒度提交代码
9. **守卫验证** — 验证所有任务完成 + 审查通过，执行 `guard --apply build-complete`

## 产物

| 产物 | 说明 |
|------|------|
| 实现计划 | 子代理生成的计划文档 |
| 代码提交 | 逐任务的 Git 提交 |
| `.smart.yaml` | Smart 状态文件（phase=build）|

## 守卫条件

`build-complete` 转换要求：
- `build_mode` 已选择
- `isolation` 已选择
- 所有任务完成并勾选
- 审查通过（review_mode 非 off 时）

## 执行模式

| 模式 | 说明 |
|------|------|
| `subagent-driven-development` | 子代理驱动开发，每任务使用独立子代理 |
| `executing-plans` | 按预定义计划执行 |
| `direct` | 直接实现，不经过子代理 |

## 用户决策点

1. 构建模式选择
2. 隔离模式选择
3. 审查模式选择

## 下一阶段

守卫通过后，自动进入 `/smart-verify`（Verify 阶段）。

## 参考

- `smart/reference/subagent-dispatch.md`
- `smart/reference/dirty-worktree.md`
- `smart/reference/smart-yaml-fields.md`
- `smart/reference/debug-gate.md`

## 环境变量

参见 `smart` 技能。
