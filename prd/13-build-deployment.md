# 构建与部署

## 13.1 构建

**构建脚本**: `build.js`（自定义，非直接 tsc）

**步骤**:
1. 清理 `dist/`
2. 运行 `tsc`
3. 复制非 TS 资产：Dashboard 前端文件 → `dist/dashboard/web/`

**TypeScript 配置**:

| 设置 | 值 |
|------|-----|
| Target | ES2022 |
| Module | NodeNext |
| Strict | true |
| Declaration | true |
| Source Map | true |

## 13.2 包管理

| 环境 | 工具 |
|------|------|
| 开发 | pnpm 10.18.3 |
| 用户安装 | npm |

## 13.3 依赖

**生产依赖**: Commander v14、@inquirer/prompts v8
**开发依赖**: TypeScript 5.9、Vitest 4、ESLint 10、Prettier 3、Husky 9

## 13.4 发布流程

1. 更新 `package.json` 版本号
2. 更新 `CHANGELOG.md`
3. 更新 `assets/manifest.json` 版本
4. 全量测试：`pnpm test:coverage && pnpm test:shell`
5. Lint + Format：`pnpm lint && pnpm format:check`
6. 构建：`pnpm build`
7. 发布：`npm publish`
8. Git tag + GitHub Release

## 13.5 版本方案

| 版本 | 含义 |
|------|------|
| 0.x.y | 预稳定版，minor 可能 break |
| 0.x.0 | 新功能 |
| 0.0.x | 缺陷修复 |
