# 升级进化方案

## 14.1 核心目标

从"编排 OpenSpec + Superpowers 的胶水层"进化为"AI 工作流操作系统"。

```
当前: Smart = OpenSpec(WHAT) + Superpowers(HOW) 的编排器
目标: Smart = 上层编排层，OpenSpec/Superpowers/CodeGraph 是原生工具
```

**关键约束**: 所有外部工具（OpenSpec、Superpowers、CodeGraph）不可侵入式修改。Smart 只通过 CLI 调用和文件读写与其交互。

## 14.2 路线图

| 版本 | 聚焦 | 交付物 | 用户感知 |
|------|------|--------|---------|
| v0.4 | Adapter 重构 | 统一 ExternalToolAdapter 接口 · OS/SP/CG 适配器化 | 无（内部重构）|
| v0.5 | Shell→TS 迁移 | smart-state.ts · smart-guard.ts | 更快更稳 |
| v0.6 | 状态管理升级 | SQLite 存储 · YAML 兼容层 | 并发安全 |
| v0.7 | 上下文压缩 GA | 默认开启 · Dashboard 集成基准数据 | 默认省 token |
| v0.8 | 守护进程 MVP | smart daemon · 文件监听 · 通知框架 | 可选增值 |
| v0.9 | Dashboard Pro | 多项目 · 历史趋势 · UI 状态操作 | 可选增值 |
| v1.0 | 稳定版 | API 稳定 · 迁移工具 · 完整文档 | 全量发布 |

## 14.3 Phase 1: Adapter 重构（v0.4.x）

**不做**: 插件化（"插件"暗示侵入式修改）。
**做**: Smart 内部用统一 Adapter 接口封装与各外部工具的交互。

```typescript
// 统一适配器模式
interface ExternalToolAdapter {
  readonly toolId: string;
  isAvailable(): Promise<boolean>;
  install?(ctx: InstallContext): Promise<void>;
  onPhaseEnter?(phase: Phase, ctx: PhaseContext): Promise<void>;
  onPhaseExit?(phase: Phase, ctx: PhaseContext): Promise<ExitResult | null>;
}
```

所有工具适配器**默认激活**，开箱即用。用户零感知。

## 14.4 Phase 2: Shell → TypeScript（v0.5.x → v0.7.x）

| 脚本 | 策略 |
|------|------|
| `smart-state.sh` (1338行) | TypeScript 重写 |
| `smart-guard.sh` (778行) | TypeScript 重写 |
| `smart-handoff.sh` (390行) | TypeScript 重写 |
| `smart-archive.sh` (311行) | TypeScript 重写 |
| `smart-yaml-validate.sh` | 合并到 TS 验证器 |
| `smart-hook-guard.sh` (~100行) | **保留 Shell**（PreToolUse 原生需求）|
| `smart-env.sh` (~110行) | **保留 Shell**（source 命令原生需求）|

迁移后 Shell 代码从 ~3100 行减到 ~200 行。

## 14.5 Phase 3: 增值服务（v0.8.x → v1.0）

### Smart Daemon（可选）

```bash
smart daemon start    # 后台常驻
```

能力：文件监听、Git Hook 集成、定时任务。
不对外部工具做任何侵入式修改。

### 通知系统（可选）

```bash
smart notify add slack --webhook https://...
```

事件：verify-fail、archive-done、change-stale。
仅通过公开 API / Webhook 集成。

### Dashboard Pro（可选）

只读模式永远免费。Pro 增值：UI 状态操作、多项目、历史趋势。
Dashboard 只读取外部工具生成的文件，从不修改。

### 工具集成扩展

未来新增 CI/CD、Jira、安全扫描等工具时，遵守同一原则：
- 仅通过公开 CLI / API 交互
- 不要求工具方做任何修改
- 外部工具不可用时管线降级而非崩溃

## 14.6 关键原则

1. **不侵入修改任何外部工具** — 只通过 CLI + 文件交互
2. Adapter 是内部架构重构，不是外部 API
3. 只迁移 70% 的 Shell 脚本（hook-guard 和 env 必须保留）
4. 所有增值功能都是可选的
5. 旧 `.smart.yaml` 永远可读

## 14.7 成功指标

| 指标 | 当前 | v0.7 | v1.0 |
|------|------|------|------|
| Shell 代码行数 | ~3100 | ~200 | ~200 |
| 测试覆盖率 | 80% | 88% | 92%+ |
| 全工作流 token 消耗 | 100% | 90% | 85% |
| 外部工具适配器数量 | 3 | 3 | 5+ |
