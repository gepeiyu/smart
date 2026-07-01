# 安全模型

## 11.1 威胁模型

| 威胁 | 场景 | 严重程度 |
|------|------|---------|
| 路径穿越 | 恶意仓库通过 `.smart.yaml` 读取任意文件 | 高 |
| 命令注入 | `build_command` / `verify_command` 注入 shell 命令 | 高 |
| 符号链接攻击 | 安装/卸载时误删目标目录 | 中 |
| Hook 覆盖 | Agent 尝试绕过阶段守卫 | 中 |
| 状态篡改 | 直接修改 `.smart.yaml` 跳过阶段 | 中 |
| 临时文件泄露 | 敏感上下文在 /tmp 泄露 | 低 |

## 11.2 防护措施

### 路径穿越防护

- `smart-state.sh cmd_set`：拒绝包含 `..` 的路径值
- Dashboard YAML 解析器：`verification_report` 做包含性检查，拒绝绝对路径和 `..`
- 失败时回退到默认 `.smart/verify-result.md`

### 命令注入防护

- `smart-guard.sh run_command_string()`：拒绝 shell 元字符（`;` `|` `&` `$` 反引号）

### 符号链接安全

- `file-system.ts` 的 `resolveSymlinkPath()`：跟随符号链接目标写入
- `removeFile` / `removeDir`：不解析符号链接，直接 unlink
- `isDirEmpty`：不将不可读目录报告为空

### Hook 合并安全

- 用户定义的 Hook 在安装/更新时被保留
- 已有 Smart 命令通过 manifest 脚本路径识别
- 损坏的 Hook 设置（非数组）被强制转换为空数组

### 阶段写入守卫

- **软**: `smart-phase-guard.md` 每轮注入提醒
- **硬**: `smart-hook-guard.sh` PreToolUse 阻止错误阶段的写操作
- 白名单路径：`openspec/*`、`docs/superpowers/*`、`.smart/*`、`.claude/*`
- 跨变更感知：每个变更由自己的 `.smart.yaml` 阶段控制

### 验证证据强制

- `verify-pass` 要求 `verification_report` 文件存在且 `branch_status=handled`
- Guard 在允许转换前检查两个前置条件

### 状态转换白名单

- `smart-state.sh` 仅允许白名单中的命名转换
- 直接 `set phase` 被阻止（`SMART_FORCE_PHASE=1` 逃生口）

### 临时文件安全

- 所有 `mktemp` 调用设置 `chmod 600`，防止世界可读

## 11.3 Dashboard 安全

- 路径遍历守卫：`verification_report` 校验 `..` 和绝对路径
- 只读：不写磁盘
- 无认证：仅 localhost 绑定
