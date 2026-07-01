# 上下文压缩

## 9.1 概述

Beta 功能（v0.3.7），在 Design → Build 交接时压缩上下文，减少 **25-30%** Build 阶段输入 token。不影响实现正确性（100% 测试通过率）。

## 9.2 模式

| 模式 | 行为 | Token 节省 | 规范覆盖率 |
|------|------|-----------|-----------|
| `off` | 完整 spec 摘要 | 基线 | 100% |
| `beta` | Design Doc + SHA256 哈希引用 | ~25-30% | ~95% |

## 9.3 流程

```
Design 阶段完成
  → smart-handoff.sh --compressed
  → 生成 design-context.json + spec-context.json + spec-context.md
  → SHA256 哈希写入 .smart.yaml
```

## 9.4 验证阶段哈希检查

`/smart-verify` 检查 `handoff_hash`：
- **哈希匹配**: 跳过 tasks.md 重读（proposal.md 和 design.md 仍读）
- **哈希不匹配**: 完全重读（检测到规范漂移）

## 9.5 Benchmark

| 规模 | off | beta | 节省 |
|------|-----|------|------|
| Small | ~15K tokens | ~11K tokens | ~27% |
| Medium | ~35K tokens | ~25K tokens | ~29% |
| Large | ~55K tokens | ~40K tokens | ~27% |

- 测试通过率：100%
- 最大绝对节省：15,000 tokens（Large）

## 9.6 配置

```yaml
# .smart/config.yaml
context_compression: beta    # off | beta
```

三层优先级：环境变量 > 项目配置 > 变更配置。
