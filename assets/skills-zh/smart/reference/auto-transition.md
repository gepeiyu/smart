# 自动转换

## 概述

`auto_transition: true` 时，守卫通过后 Smart 自动进入下一阶段，无需用户手动输入命令。

## 配置

```yaml
# .smart.yaml
auto_transition: true   # true | false
```

## 转换表

| 阶段 | auto_transition | 结果 | 下一技能 |
|------|----------------|------|---------|
| `issue` | true | auto | smart-design / smart-build |
| `issue` | false | manual | — |
| `design` | true | auto | smart-build |
| `design` | false | manual | — |
| `build` | true | auto | smart-verify |
| `verify` (pass) | true | auto | smart-archive |
| `verify` (fail) | true | auto | smart-build |
| `archive` (done) | any | done | — |

## 优先级

自动转换受环境变量影响：

```bash
SMART_AUTO_TRANSITION=false   # 强制手动模式
```

三层优先级：环境变量 > 项目配置（`.smart/config.yaml`）> 变更配置（`.smart.yaml`）。

## 手动模式

`auto_transition: false` 时，守卫通过后 Agent 应等待用户输入下一命令。
