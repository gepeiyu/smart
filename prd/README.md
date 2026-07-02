# Smart 设计文档

## 文档结构

```
prd/
├── README.md                       # ← 本文档：索引导航
│
├── 01-product-overview.md          # 产品概述
│   └── 定位 · 核心概念 · 目标用户 · 系统要求
│
├── 02-architecture.md              # 系统架构
│   └── 分层架构 · 模块职责 · 数据流 · 设计决策
│
├── 03-core-workflow.md             # 核心工作流
│   └── 5 阶段管线 · 状态机 · 转换规则 · 守卫机制 · 预设流程
│
├── 04-cli-module.md                # CLI 模块
│   └── 命令设计 · 选项 · 交互流程 · JSON 输出
│
├── 05-shell-scripts.md             # Shell 脚本
│   └── 7 个脚本详解 · 依赖关系 · 跨平台规范
│
├── 06-platform-support.md          # 平台支持
│   └── 29 平台定义 · 目录格式 · Hook 格式 · 检测机制
│
├── 07-dashboard.md                 # Dashboard 模块
│   └── HTTP 服务 · 收集器 · 前端 · JSON 快照
│
├── 08-adapter-integration.md                   # 插件生态
│   └── 插件架构 · 官方插件 · 社区插件 · 组合矩阵
│
├── 09-context-compression.md       # 上下文压缩
│   └── Beta 功能 · 压缩模式 · Benchmark · 配置
│
├── 10-internationalization.md      # 国际化
│   └── 双语架构 · CLI i18n · 翻译规范
│
├── 11-security.md                  # 安全模型
│   └── 威胁模型 · 防护措施 · 安全策略总览
│
├── 12-testing-quality.md           # 测试与质量
│   └── 测试分层 · CI 流水线 · 覆盖率阈值
│
├── 13-build-deployment.md          # 构建与部署
│   └── 构建系统 · npm 发布 · 版本方案 · CI/CD
│
└── 14-evolution-plan.md            # 升级进化方案
    └── 路线图 · 插件化 · 守护进程 · 生态平台
```

## 阅读路径

| 读者 | 建议路径 |
|------|---------|
| **新用户** | 01 → 03 → 04 → 06 |
| **架构师** | 02 → 03 → 11 → 08 |
| **贡献者** | 12 → 13 → 05 → 10 |
| **战略规划** | 14 → 08 → 09 |

## 核心概念速查

| 概念 | 定义位置 | 一句话 |
|------|---------|--------|
| Phase | 03 | 5 个阶段：issue → design → build → verify → archive |
| State Machine | 03 | `.smart.yaml` 驱动的状态转换，守卫验证通过才允许 |
| Guard | 03/05 | 阶段退出的硬校验条件（文件存在、状态正确）|
| Handoff | 03/05 | 阶段间上下文传递（设计→构建的 SHA256 完整性包）|
| Hook Guard | 05/11 | PreToolUse 钩子，错误阶段禁止源码写入 |
| Auto Transition | 03 | 阶段完成后自动/手动调用下一技能 |
| Context Compression | 09 | 设计→构建时压缩上下文，节省 25-30% token |
| Plugin | 08 | OpenSpec/Superpowers/CodeGraph 作为 Smart 插件 |
