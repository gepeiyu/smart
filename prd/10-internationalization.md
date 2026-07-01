# 国际化

## 10.1 覆盖范围

| 面 | 语言 | 说明 |
|----|------|------|
| SKILL.md | en / zh | 完整双语变体 |
| 参考文档 | en / zh | 8 份渐进式加载文档 |
| CLI 输出 | en / zh | `src/commands/i18n.ts` 共享翻译表 |
| Shell 脚本 | en | 仅英文（错误信息、帮助文本）|
| Hook Guard | en | 仅英文 |

## 10.2 资产结构

```
assets/
├── skills/          # 英文
│   ├── comet/SKILL.md
│   ├── comet/reference/*.md
│   └── comet-*/SKILL.md
├── skills-zh/       # 中文（镜像 skills/ 结构）
└── comet/scripts/   # 共享（非语言相关）
```

Shell 脚本是共享的。

## 10.3 语言选择

```bash
smart init                   # 交互式选择
smart init --language zh     # 跳过提示
```

## 10.4 翻译规范

| 英文 | 中文规则 |
|------|---------|
| `gate` | 不用"门"，用"协议/阶段/检查/阻塞点" |
| `debug gate` | "异常调试协议" |
| `proactive context compression` | "主动式上下文压缩" |

**开发顺序**: 先写中文 → 用户确认 → 同步英文。

## 10.5 CLI i18n 模块

`src/commands/i18n.ts` — 77 个翻译键，类型安全：

```typescript
import { t } from './i18n.js';
console.log(t(language, 'setupComplete'));
// "Smart setup complete!" (en)
// "Smart 设置完成！" (zh)
```

## 10.6 工作流输出语言

Smart 将触发请求的语言传播到 OpenSpec 和 Superpowers 步骤，保持生成的文档语言一致。恢复现有变更时保留已有文档的语言。
