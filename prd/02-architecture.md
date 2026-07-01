# 系统架构

## 2.1 分层架构

```
User Request
    │
    ▼
┌──────────────────────────────────────┐
│  CLI Layer (Commander)               │
│  init · status · dashboard · doctor  │
│  update · uninstall                  │
└──────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────┐
│  Core Layer                          │
│  State Machine · Guard Engine        │
│  Context Handoff · Adapter Registry  │
└──────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────┐
│  Skill Layer (SKILL.md)              │
│  /smart → /smart-issue → /smart-     │
│  design → /smart-build → /smart-     │
│  verify → /smart-archive             │
│  + /smart-hotfix, /smart-tweak       │
└──────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────┐
│  Script Layer (Shell)                │
│  smart-state · smart-guard · smart-  │
│  handoff · smart-archive · smart-    │
│  yaml-validate · smart-hook-guard    │
│  smart-env                           │
└──────────────────────────────────────┘
    │
    ├─────────────────────┬────────────┘
    │                     │
    ▼                     ▼
┌──────────────┐  ┌──────────────────┐  ┌──────────────┐
│  OpenSpec    │  │  Superpowers     │  │  CodeGraph   │
│  (原生 CLI)   │  │  (原生 Skill)    │  │  (原生 CLI)   │
│  不可侵入修改  │  │  不可侵入修改     │  │  不可侵入修改  │
└──────────────┘  └──────────────────┘  └──────────────┘
```

**关键约束**: OpenSpec、Superpowers、CodeGraph 都是原生外部工具，Smart **不能侵入式修改**它们。Smart 只能通过以下方式与它们交互：

| 交互方式 | 说明 |
|---------|------|
| CLI 调用 | `openspec new change`、`codegraph install` 等 |
| 文件读写 | 读写 `.openspec.yaml`、proposal.md 等 |
| Skill 加载 | 在 SKILL.md 中通过 "use the Skill tool to load..." 引用 |
| 环境变量 | 传递配置参数 |

## 2.2 模块职责

| 模块 | 目录 | 职责 |
|------|------|------|
| CLI 入口 | `src/cli/index.ts` | Commander 命令注册 |
| 初始化 | `src/commands/init.ts` | 平台检测、依赖安装、技能部署 |
| 状态 | `src/commands/status.ts` | 活跃变更展示 |
| 仪表盘 | `src/commands/dashboard.ts` | HTTP 服务启动/JSON 快照 |
| 诊断 | `src/commands/doctor.ts` | 安装健康检查 |
| 更新 | `src/commands/update.ts` | npm 包 + 技能文件更新 |
| 卸载 | `src/commands/uninstall.ts` | 安全移除 |
| 国际化 | `src/commands/i18n.ts` | 中英文翻译表 |
| 平台定义 | `src/core/platforms.ts` | 29 平台定义 |
| 技能部署 | `src/core/skills.ts` | SKILL.md 部署逻辑 |
| Dashboard | `src/dashboard/` | HTTP 服务 + 收集器 + 前端 |

## 2.3 外部工具集成模式

所有外部工具都通过**同一套非侵入模式**集成：

```typescript
// 所有外部工具集成采用统一模式：
// CLI 调用 + 文件读取 → Smart 内部处理 → CLI 调用 + 文件写入
// 绝不：修改依赖源码、调用内部 API、打补丁

class ExternalToolAdapter {
  // 1. 通过 CLI 调用
  async execCLI(command: string): Promise<CLIResult> { /* ... */ }
  
  // 2. 通过文件系统读取状态
  async readState(path: string): Promise<State> { /* ... */ }
  
  // 3. 通过文件系统写入状态
  async writeState(path: string, state: State): Promise<void> { /* ... */ }
}
```

## 2.4 状态管理架构

Smart 使用**解耦状态架构**：

```
openspec/changes/<name>/
├── .openspec.yaml    # OpenSpec 管理（规范生命周期）— Smart 只读
├── .smart.yaml       # Smart 管理（工作流阶段、模式、结果）— Smart 读写
├── proposal.md       # OpenSpec 生成 — Smart 校验存在性
├── design.md
├── specs/*/spec.md
└── tasks.md
```

**状态归属原则**: 谁产生谁管理，Smart 只校验不篡改。

## 2.5 设计决策

| 决策 | 理由 |
|------|------|
| 非侵入集成 | 外部工具不可修改，只能通过 CLI+文件交互 |
| 脚本状态机 | 比纯 Prompt 更可靠，可用 Bats 测试 |
| Shell 脚本无外部依赖 | 不需要 yq/jq，开箱即用 |
| 渐进式加载参考文档 | 节省 ~4100 tokens/全工作流 |
| 软+硬双层防护 | Rule（每轮提醒）+ Hook（硬阻断）纵深防御 |
| 29 平台 | 一次定义，数据驱动 |
| 从设计之初双语 | 中文社区是核心用户群 |
