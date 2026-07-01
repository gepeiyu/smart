# 9 个用户决策点

## 概述

Smart 工作流在 5 个阶段中共有 9 个用户决策点，需要用户确认或选择才能继续。

## 决策点清单

| # | 阶段 | 决策 | 说明 |
|---|------|------|------|
| 1 | Issue | 需求澄清确认 | 用户确认需求范围是否正确 |
| 2 | Issue | 变更名称确认 | 从 2-3 个 kebab-case 候选中选择 |
| 3 | Issue | PRD 拆分决策 | 大 PRD 是否拆分为多个变更 |
| 4 | Design | 设计方案确认 | 用户确认选择的方案 |
| 5 | Build | 构建模式选择 | subagent-driven / executing-plans / direct |
| 6 | Build | 隔离模式选择 | branch / worktree |
| 7 | Build | 审查模式选择 | off / standard / thorough |
| 8 | Verify | 验证通过/失败确认 | 用户确认验证结果 |
| 9 | Archive | 归档确认 | 确认归档或退回 Verify |

## 决策流程

每个决策点：
1. Agent 呈现选项和影响
2. 用户做出选择
3. Agent 根据选择继续执行
4. 选择写入 `.smart.yaml`（如适用）

## 自动化

`auto_transition: true` 时，部分决策点可跳过（如构建模式使用默认值）。
