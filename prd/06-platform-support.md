# 平台支持

## 6.1 平台列表

Smart 支持 **29 个 AI 编码平台**。定义在 `src/core/platforms.ts` 中。

| 平台 | 项目目录 | 全局目录 | 规则格式 | Hook |
|------|---------|---------|---------|------|
| Claude Code | `.claude/` | `.claude/` | md | ✓ |
| Cursor | `.cursor/` | `.cursor/` | mdc | ✗ |
| Codex | `.codex/` | `.codex/` | md | ✓ |
| OpenCode | `.opencode/` | `.config/opencode/` | md | ✗ |
| Windsurf | `.windsurf/` | `.windsurf/` | md | ✓ |
| Cline | `.cline/` | `.cline/` | md | ✗ |
| RooCode | `.roo/` | `.roo/` | md | ✗ |
| Continue | `.continue/` | `.continue/` | md | ✗ |
| GitHub Copilot | `.github/` | `.github/` | copilot | ✓ |
| Gemini CLI | `.gemini/` | `.gemini/` | — | ✓ |
| Amazon Q | `.amazonq/` | `.amazonq/` | md | ✓ |
| Qwen Code | `.qwen/` | `.qwen/` | md | ✓ |
| Kilo Code | `.kilocode/` | `.kilocode/` | md | ✗ |
| Auggie | `.augment/` | `.augment/` | md | ✗ |
| Kiro | `.kiro/` | `.kiro/` | md | ✓ |
| Kimi Code | `.kimi-code/` | `.kimi-code/` | — | ✗ |
| Lingma | `.lingma/` | `.lingma/` | md | ✗ |
| Junie | `.junie/` | `.junie/` | — | ✗ |
| CodeBuddy | `.codebuddy/` | `.codebuddy/` | — | ✗ |
| CoStrict | `.cospec/` | `.cospec/` | — | ✗ |
| Crush | `.crush/` | `.crush/` | — | ✗ |
| Factory Droid | `.factory/` | `.factory/` | — | ✗ |
| iFlow | `.iflow/` | `.iflow/` | — | ✗ |
| Pi | `.pi/` | `.pi/agent/` | — | ✗ |
| Qoder | `.qoder/` | `.qoder/` | md | ✓ |
| Antigravity | `.agents/` | `.gemini/antigravity/` | — | ✗ |
| Bob Shell | `.bob/` | `.bob/` | — | ✗ |
| ForgeCode | `.forge/` | `.forge/` | — | ✗ |
| Trae | `.trae/` | `.trae/` | md | ✗ |

## 6.2 平台差异

| 差异 | 说明 |
|------|------|
| **全局目录不同** | OpenCode（`.config/opencode/`）、Pi（`.pi/agent/`）、Antigravity（`.gemini/antigravity/`）|
| **规则格式** | md（通用）、mdc（Cursor）、copilot（GitHub Copilot instructions）|
| **规则位置特殊** | Cline → `.clinerules/`（项目根）、Kiro → `steering/`、Gemini → GEMINI.md |
| **Hook 格式** | 7 种：claude-code / gemini / windsurf / copilot / qwen / kiro / qoder |

## 6.3 发现机制

- 检查平台特定配置目录/文件
- GitHub Copilot 检查多个 `detectionPaths`
- 通过 `.openspec.yaml` 发现 OpenSpec 已配置的工具

## 6.4 Manifest 驱动部署

`assets/manifest.json` 控制技能部署：
- **skills**: 27 个技能文件路径
- **rules**: 1 个守卫规则文件
- **hooks**: 1 个 Hook 守卫脚本
- **languages**: 中英文语言变体
