# 脏工作树处理

## 概述

当 Git 工作树存在未提交变更时进入 Build 阶段，Smart 提供隔离机制保护正在进行的开发。

## 隔离模式

| 模式 | 说明 | 适用场景 |
|------|------|---------|
| `branch` | 从当前分支创建新功能分支 | 单人开发，简单隔离 |
| `worktree` | 使用 `git worktree add` 创建独立工作树 | 并行开发，完全隔离 |

## 脏工作树检测

`/smart-build` 进入时自动检测：
- 运行 `git status --porcelain`
- 如有未提交变更，提示用户选择隔离模式
- 写入 `.smart.yaml` 的 `isolation` 字段

## Worktree 模式流程

```bash
# 自动创建独立工作树
git worktree add ../<change-name>-worktree <base-branch>
cd ../<change-name>-worktree
# 在独立工作树中开发
```

## Branch 模式流程

```bash
# 从当前分支创建功能分支
git checkout -b feat/<change-name>
# 在功能分支上开发
```

## 提交策略

- 每完成一个任务提交一次
- 提交信息包含变更引用
- 审查通过后合并回主分支

## Verify 阶段分支处理

Verify 阶段结束时：
- 合并分支到目标分支
- 清理工作树（如适用）
- 设置 `branch_status: handled`
