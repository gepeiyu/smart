# 文件结构

## 项目层级

```
project-root/
├── .smart/                     # Smart 项目配置
│   └── config.yaml             # 项目级 Smart 配置
├── smartdocs/                  # Smart 工作流状态与执行证据
│   └── changes/
│       └── <change-name>/
│           ├── .smart.yaml     # 变更级 Smart 配置（工作流阶段、模式、结果）
│           └── handoff/        # Handoff 上下文
├── openspec/
│   └── changes/
│       └── <change-name>/      # 单个变更目录
│           ├── .openspec.yaml  # OpenSpec 管理（只读）
│           ├── proposal.md     # 提案文档
│           ├── design.md       # 设计文档
│           ├── specs/
│           │   └── */spec.md   # 规范文档
│           └── tasks.md        # 任务清单
├── docs/
│   └── superpowers/
│       ├── specs/              # Design Doc 路径
│       └── plans/              # 实现计划路径
├── src/                        # 源码目录
├── tests/                      # 测试目录
└── lib/                        # 构建输出
```

## 关键文件说明

| 文件 | 管理者 | 阶段 | 说明 |
|------|--------|------|------|
| `smartdocs/changes/<change-name>/.smart.yaml` | Smart | 全部 | 工作流状态，Smart 读写 |
| `.smart/config.yaml` | Smart | 全部 | 项目级配置 |
| `proposal.md` | OpenSpec | Issue | 变更提案 |
| `design.md` | OpenSpec | Issue | 设计方案 |
| `tasks.md` | OpenSpec | Issue | 任务清单 |
| Design Doc | Superpowers | Design | 详细设计文档 |
| Delta Spec | OpenSpec | Design | 增量规范 |
| 源码 | Superpowers | Build | 实现代码 |
| `verification-report.md` | Both | Verify | 验证报告 |
| 归档变更 | OpenSpec | Archive | 归档的变更目录 |
