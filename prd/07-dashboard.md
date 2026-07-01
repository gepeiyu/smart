# Dashboard 模块

## 7.1 功能

本地只读 HTTP 服务器（v0.3.11 引入），可视化查看所有 Smart 变更的状态。

| 选项 | 说明 |
|------|------|
| `--port` | 端口（默认自动选择）|
| `--no-open` | 不自动打开浏览器 |
| `--json` | 输出 JSON 快照后退出 |

## 7.2 架构

```
server.ts → GET /api/dashboard → DashboardSnapshot
          → GET /              → 静态页面
          → GET /styles.css /app.js /state.js /utils.js
```

## 7.3 后端组件

| 组件 | 职责 |
|------|------|
| `collector.ts` | 扫描 `openspec/changes/`，收集变更信息 |
| `yaml.ts` | 解析 `.smart.yaml` / `.openspec.yaml` |
| `task-parser.ts` | 解析 tasks.md，计算完成率 |
| `git.ts` | 最近提交、脏文件、当前分支 |
| `next-action.ts` | 推荐下一 `/smart*` 命令 |
| `risk.ts` | 规则驱动的风险列表 |

## 7.4 数据类型

```typescript
interface DashboardSnapshot {
  changes: ChangeInfo[];
  archived: ChangeInfo[];
  projectPath: string;
  git?: GitSnapshot;
  nextActions: NextAction[];
  risks: Risk[];
  generatedAt: string;
}
```

## 7.5 前端

单页应用（HTML + CSS + JS），包含：
- 变更列表 + 阶段徽章
- 产物检查清单
- 任务进度条
- 验证状态指示器
- 下一命令推荐
- Git 信息面板
- 风险列表

## 7.6 安全

- 路径遍历防护：`verification_report` 字段校验 `..` 和绝对路径
- 只读：不写磁盘
- 无认证：仅 localhost 绑定
