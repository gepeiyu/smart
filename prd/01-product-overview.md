# 产品概述

## 1.1 产品定位

Smart 是一个 **AI 工作流编排引擎**，通过状态机驱动的 5 阶段管线（Issue → Design → Build → Verify → Archive），将 AI 编码 Agent 的开发流程从"人工提醒"升级为"自动推进"。

## 1.2 核心价值

| 问题 | Smart 方案 |
|------|-----------|
| Agent 中断后丢失进度 | 一次 `/smart` 自动检测当前阶段并恢复 |
| 阶段跳过的"我好了"陷阱 | Guard 脚本硬校验前置条件，不满足不放行 |
| 手动同步文档（设计文档/规范/任务清单）| Handoff 自动生成上下文包 + SHA256 完整性 |
| 错误阶段写入源码 | Hook Guard 在 PreToolUse 时硬阻断 |
| 跨平台技能部署 | `smart init` 一次安装到 29 个 AI 平台 |

## 1.3 核心理念

```
OpenSpec (WHAT)  +  Superpowers (HOW)  =  Smart (ORCHESTRATION OS)
  需求 · 规范         TDD · 子代理         状态机 · 守卫 · 仪表盘
```

Smart 站在 OpenSpec 和 Superpowers 的**更上层**，像操作系统管理应用程序一样管理它们。

## 1.4 系统要求

| 要求 | 说明 |
|------|------|
| Node.js | >= 20 |
| Git | 必需 |
| Shell | Bash 兼容（Windows 用 Git Bash）|
| AI 平台 | 29 个支持平台之一（CLI 可独立使用）|

## 1.5 快速开始

```bash
npm install -g @gepeiyu/smart
cd your-project
smart init
```

之后在 AI Agent 中运行 `/smart` 启动工作流。
