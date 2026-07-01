# 外部工具集成

## 8.1 设计理念

Smart 是**上层编排层**，OpenSpec、Superpowers、CodeGraph 是**原生外部工具**。

```
┌─────────────────────────────────────────┐
│  Smart 编排层（上层）                     │
│  状态机 · 守卫 · 仪表盘 · 上下文压缩       │
│  CLI 调用 · 文件读取 · 结果校验             │
├─────────────────────────────────────────┤
│  ─── CLI 调用 ───    ─── 文件读写 ───     │
├──────────────────┬──────────────────────┤
│  OpenSpec        │  Superpowers         │
│  (原生 CLI)       │  (原生 Skill)        │
│  ─ 提案/规范     │  ─ Brainstorm/TDD    │
│  ─ 生命周期      │  ─ 子代理/审查        │
│  ─ 归档          │  ─ 计划/执行          │
├──────────────────┴──────────────────────┤
│  CodeGraph (原生 CLI)                    │
│  ─ 代码图谱索引 · 语义搜索               │
└─────────────────────────────────────────┘
```

**核心约束**: 不能侵入式修改任何外部工具。Smart 只能通过 CLI 调用和文件读写交互。

## 8.2 集成清单

| 工具 | 集成方式 | Smart 对其做什么 | 不能做什么 |
|------|---------|-----------------|-----------|
| OpenSpec | CLI + 文件 | 调用 `openspec new change`、`openspec sync` 等；读取 `.openspec.yaml` | 不能修改 openspec 源码、不能注入 hook、不能改其技能文件 |
| Superpowers | Skill 加载 | 在 SKILL.md 中引用其 skill，通过文件传递上下文 | 不能修改 brainstorming/TDD skill、不能改其 Prompt |
| CodeGraph | CLI | 调用 `codegraph install`、`codegraph explore` 等 | 不能修改 codegraph 源码、不能改其索引格式 |

## 8.3 与非侵入式候选工具的集成

未来新增工具也遵循同样模式：

| 候选工具 | 集成方式 | 阶段 |
|---------|---------|------|
| CI/CD (GitHub Actions) | CLI + API 调用 | verify — 检查 CI 状态作为验证证据 |
| 项目管理 (Jira/GitHub Issues) | CLI + API 调用 | issue — 从 ticket 创建变更；archive — 更新 ticket |
| 安全扫描 (Snyk/SonarQube) | CLI + API 调用 | verify — 安全门禁 |
| 文档生成 (TypeDoc) | CLI 调用 | archive — 归档触发文档更新 |

所有候选都走同一模式：**CLI 调用 → 解析输出 → 纳入管线决策**。

## 8.4 Adapter 模式

```typescript
// 所有外部工具适配器继承同一接口
interface ExternalToolAdapter {
  readonly toolId: string;
  
  /** 检查工具是否可用 */
  isAvailable(): Promise<boolean>;
  
  /** 安装/初始化工具 */
  install?(ctx: InstallContext): Promise<void>;
  
  /** 阶段进入时调用 */
  onPhaseEnter?(phase: Phase, ctx: PhaseContext): Promise<void>;
  
  /** 阶段退出时调用（用于贡献守卫规则）*/
  onPhaseExit?(phase: Phase, ctx: PhaseContext): Promise<ExitResult | null>;
}
```

## 8.5 组合效应

多个工具的数据组合创造乘法价值，无需任何内部修改：

| 组合 | 实现方式 | 产生能力 |
|------|---------|---------|
| OS + SP + CI/CD | CI CLI 调用结果纳入 verify guard | verify 可自动化 |
| OS + SP + PM | PM API 读取 ticket → 写入 issue 阶段 | 从 ticket 到归档全链路 |
| OS + CodeGraph | CodeGraph 查询 → 补充 issue 阶段上下文 | spec → 代码影响分析 |
| SP + CodeGraph | CodeGraph 查询 → 子代理获取代码结构 | TDD 更精准 |

## 8.6 集成优先级

| 优先级 | 工具 | 收益 |
|--------|------|------|
| P0 | OpenSpec（已有）| 核心工作流必需 |
| P0 | Superpowers（已有）| 核心工作流必需 |
| P1 | CodeGraph（已有，可选）| 代码智能加速 |
| P2 | CI/CD | verify 门禁自动化 |
| P3 | 项目管理 | issue 到归档全自动 |

**对所有候选工具的原则**:
- 仅通过公开 CLI / API 交互
- 不要求工具方做任何修改
- 工具不可用时 Smart 核心管线降级而非崩溃
