# 测试与质量

## 12.1 测试分层

| 层 | 框架 | 数量 | 覆盖 |
|----|------|------|------|
| TypeScript 单元测试 | Vitest v4 | 26 文件 | CLI、Dashboard、Core |
| Shell 脚本测试 | Bats | 1 文件 | state 操作、转换 |
| 端到端测试 | Vitest | 1 文件 | 全平台 init |
| 静态分析 | ESLint v10 + ShellCheck | — | src/ + scripts/ |
| 格式化 | Prettier v3 | — | src/ |

## 12.2 覆盖率阈值

| 指标 | 阈值 |
|------|------|
| Branches | 70% |
| Functions | 80% |
| Lines | 80% |
| Statements | 80% |

排除：CLI 命令模块（通过 E2E 测试）、Benchmark 测试。

## 12.3 CI 流水线

GitHub Actions 4 个 Workflow：

| Workflow | Runner | 步骤 |
|----------|--------|------|
| `ci.yml` | ubuntu | 构建 → lint → format:check → 测试 → 覆盖率 |
| `ci.yml` | ubuntu | ShellCheck |
| `ci.yml` | ubuntu | Bats 测试 |
| `ci.yml` | ubuntu/macos/windows | 脚本冒烟测试 |
| `ci.yml` | ubuntu/macos/windows | 端到端 init 测试（Node 20/22）|
| `pr-title-lint.yml` | ubuntu | PR 标题语义检查 |
| `greeting-guideline-pr.yml` | ubuntu | 首次贡献者欢迎 |
| `stale-prs.yml` | ubuntu | 90 天休眠 PR 关闭 |

## 12.4 预提交钩子

Husky v9 + lint-staged v17：
- `git commit` 时自动对 `src/` 下暂存文件执行 `prettier --write`
- 编辑器无关，所有贡献者统一

## 12.5 npm Scripts

| 命令 | 说明 |
|------|------|
| `pnpm test` | 运行 Vitest |
| `pnpm test:coverage` | 带覆盖率运行 |
| `pnpm test:shell` | 运行 Bats |
| `pnpm lint` | ESLint |
| `pnpm format:check` | Prettier 检查 |
