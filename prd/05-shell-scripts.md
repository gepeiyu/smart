# Shell 脚本

## 5.1 总览

7 个脚本，跨平台兼容（macOS / Linux / Windows Git Bash）。不依赖 yq/jq 等外部工具。

## 5.2 依赖关系

```
smart-state.sh ←── smart-guard.sh
              ←── smart-handoff.sh
              ←── smart-archive.sh
              ←── smart-yaml-validate.sh

smart-guard.sh ←── smart-yaml-validate.sh（前置校验）

smart-handoff.sh → 写入 handoff_context / handoff_hash

smart-hook-guard.sh（独立，PreToolUse 调用）

smart-env.sh（被所有脚本 source 加载）
```

## 5.3 脚本详情

| 脚本 | 行数 | 职责 |
|------|------|------|
| `smart-env.sh` | 110 | 导出脚本路径变量 |
| `smart-state.sh` | 1338 | 统一状态管理（init/set/get/check/transition/next）|
| `smart-guard.sh` | 778 | 阶段转换守卫（`--check` 验证 / `--apply` 更新）|
| `smart-handoff.sh` | 390 | 设计→构建上下文传递（SHA256 完整性）|
| `smart-archive.sh` | 311 | 归档自动化（delta 合并、注释、移动）|
| `smart-yaml-validate.sh` | ~100 | `.smart.yaml` Schema 校验 |
| `smart-hook-guard.sh` | ~100 | PreToolUse 写保护钩子 |

### smart-state.sh 子命令

| 子命令 | 参数 | 说明 |
|--------|------|------|
| `init` | `<change-name>` | 创建 `.smart.yaml` |
| `get` | `<change-name> [field]` | 读取状态 |
| `set` | `<change-name> <field> <value>` | 写入字段（`phase` 被保护）|
| `check` | `<change-name>` | 校验状态一致性 |
| `transition` | `<change-name> <transition>` | 执行命名转换（白名单）|
| `scale` | `<change-name> <scale>` | 设置验证规模 |
| `task-checkoff` | `<file> <task-text>` | 验证任务已勾选 |
| `next` | `<change-name>` | 解析下一步动作 |

### smart-guard.sh 校验项

| 转换 | 校验条件 |
|------|---------|
| issue-complete | proposal.md + tasks.md 存在 |
| design-complete | design_doc 字段已设且文件存在 |
| build-complete | build_mode 已选、isolation 已选、审查完成 |
| verify-pass | verification_report 存在 + branch_status=handled |
| verify-fail | 保留 verification_report 和 branch_status |
| archived | verify_result=pass |

## 5.4 跨平台规范

| 规则 | 说明 |
|------|------|
| 禁止 `sed -i` | 使用 awk 做字段替换 |
| SHA256 兼容 | 同时支持 sha256sum 和 shasum -a 256 |
| 可选 grep | 所有可选结果加 `|| true` |
| 路径解析 | `$(cd "$(dirname "$0")" && pwd -P)` |
| 临时文件 | `mktemp` + `chmod 600` |

## 5.5 安全

- 命令行注入防护（禁止 `;` `|` `&` `$` 反引号）
- 路径穿越防护（禁止 `..`）
- 符号链接安全操作
