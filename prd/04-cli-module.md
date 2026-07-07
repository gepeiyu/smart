# CLI 模块

## 4.1 命令总览

| 命令 | 功能 |
|------|------|
| `smart init [path]` | 初始化工作流（检测平台、安装依赖、部署技能）|
| `smart status [path]` | 查看活跃变更和下一命令 |
| `smart dashboard [path]` | 启动本地 HTTP 仪表盘 |
| `smart doctor [path]` | 诊断安装健康状态 |
| `smart update [path]` | 更新 npm 包 + 技能文件 |
| `smart uninstall [path]` | 安全移除 Smart 组件 |
| `smart --help` | 帮助信息 |
| `smart --version` | 版本号 |

所有命令均支持 `--json` 输出。

## 4.2 命令详情

### smart init

| 选项 | 类型 | 说明 |
|------|------|------|
| `--yes` | boolean | 非交互模式，自动选择检测到的平台 |
| `--scope` | project \| global | 安装范围 |
| `--language`, `--lang` | en \| zh | 技能语言 |
| `--skip-existing` | boolean | 跳过已有组件 |
| `--overwrite` | boolean | 覆盖已有组件 |
| `--no-deps` | boolean | 跳过依赖安装 |
| `--json` | boolean | JSON 输出 |

### smart status

| 选项 | 说明 |
|------|------|
| `--json` | 输出活跃变更 + nextCommand |

### smart dashboard

| 选项 | 说明 |
|------|------|
| `--port` | HTTP 端口（默认自动选择）|
| `--no-open` | 不自动打开浏览器 |
| `--json` | 输出 JSON 快照后退出 |

### smart doctor

| 选项 | 说明 |
|------|------|
| `--fix` | 尝试自动修复问题 |
| `--json` | JSON 诊断结果 |

### smart update

| 选项 | 说明 |
|------|------|
| `--yes` | 跳过确认 |
| `--json` | JSON 输出 |
| `--language`, `--lang` | en / zh |
| `--scope` | project / global |
| `--skip-npm` | 只更新技能文件，跳过 npm 包更新 |

### smart uninstall

| 选项 | 说明 |
|------|------|
| `--force` | 跳过确认 |
| `--scope` | project / global |
| `--json` | JSON 输出 |

## 4.3 JSON 输出约定

- 标准 JSON（stdout），无日志混入
- 错误状态：`"status": "error"` 或 `"failed": true`
- 退出码：成功 0，失败非 0

## 4.4 错误处理

- `ExitPromptError`：Ctrl+C 清理退出
- 网络超时：版本检查 / npm 更新优雅降级
- 输入校验：`--port` 数字校验、`--scope` 枚举校验
