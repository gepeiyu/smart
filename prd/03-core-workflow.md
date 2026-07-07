# 核心工作流

## 3.1 5 阶段管线

```
/smart-issue ──→ /smart-design ──→ /smart-build ──→ /smart-verify ──→ /smart-archive
(OpenSpec)       (Superpowers)     (Superpowers)     (Both)           (OpenSpec)

/smart-bugfix:  根因分析（优先 CodeGraph）──→ Build ──→ Verify ──→ Archive
/smart-quick:   issue ──→ quick build ──→ quick verify ──→ archive（跳过 Brainstorming 和 Plan，直接进行快捷的Build和Verify）
```

## 3.2 各阶段详解

### Phase 1: Issue（`/smart-issue`）

**负责人**: OpenSpec | **产物**: proposal.md, design.md, tasks.md

1. 需求澄清（用户确认门禁）
2. 变更名称确认（2-3 个 kebab-case 候选，ASCII 校验）
3. PRD 拆分预检（大 PRD 分流）
4. `openspec new change` → 创建变更目录
5. 生成 proposal.md / design.md / tasks.md（使用 OpenSpec 逐 artifact JSON 指令）
6. Guard：验证 artifacts 存在 → `guard --apply issue-complete`

### Phase 2: Design（`/smart-design`）

**负责人**: Superpowers | **产物**: Design Doc, delta spec

1. 加载 Superpowers brainstorming 技能
2. 设计方法 Brainstorm（增量写入 brainstorm-summary.md）
3. 用户确认设计方案
4. 主动上下文压缩门禁
5. 创建 Design Doc（主线会话中完成）
6. 生成 delta spec（`openspec sync`）
7. `smart-handoff.sh` → 生成上下文包 + SHA256 哈希
8. Guard：验证 design_doc 存在 → `guard --apply design-complete`

### Phase 3: Build（`/smart-build`）

**负责人**: Superpowers | **产物**: 实现计划、代码提交

1. 选择 build_mode（`subagent-driven-development` / `executing-plans` / `direct`）
2. 选择 isolation（`branch` / `worktree`）
3. 选择 tdd_mode（`tdd` / `direct`）
4. 选择 review_mode（`off` / `standard` / `thorough`）
5. 加载计划编写技能（子代理卸载创建计划）
6. 逐任务实现（TDD 模式 / 子代理调度）
7. 代码审查（review_mode != off 时）
8. 逐任务提交
9. Guard：验证所有任务完成 + 审查通过 → `guard --apply build-complete`

### Phase 4: Verify（`/smart-verify`）

**负责人**: OpenSpec + Superpowers | **产物**: 验证报告、分支处理

1. 加载 Superpowers verification-before-completion 技能
2. 检查 handoff hash 检测规范漂移
3. 选择验证规模（`light` / `full`）
   - Light：6 项检查清单（模式流程）
   - Full：需求满足度 + 设计一致性 + 实现验证
4. 分支处理（合并/清理）
5. 生成验证报告
6. Guard：验证报告存在 + branch_status=handled → `guard --apply verify-pass`

### Phase 5: Archive（`/smart-archive`）

**负责人**: OpenSpec | **产物**: 归档变更

1. 用户确认门禁
2. `smart-archive.sh`：
   - 验证入口状态
   - Delta → main spec 合并（OpenSpec delta 语义）
   - 注释 design doc 和 plan frontmatter
   - 移动变更到归档目录
   - 更新 `archived: true`

## 3.3 状态机

### .smart.yaml 字段

```yaml
# 核心
workflow: full                    # full | bugfix | quick
phase: build                      # issue | design | build | verify | archive
auto_transition: true             # true | false

# 执行模式
build_mode: subagent-driven-development  # subagent-driven-development | executing-plans | direct
build_pause: null                 # null | plan-ready
isolation: branch                 # branch | worktree
tdd_mode: null                    # null | tdd | direct
subagent_dispatch: null           # null | confirmed

# 审查与验证
review_mode: standard             # off | standard | thorough
verify_mode: null                 # null | light | full
verify_result: pending            # pending | pass | fail
verification_report: null         # 路径或 null
branch_status: pending            # pending | handled

# 产物路径
design_doc: docs/superpowers/specs/YYYY-MM-DD-topic-design.md
plan: docs/superpowers/plans/YYYY-MM-DD-feature.md
handoff_context: openspec/changes/<name>/.smart/handoff/design-context.json
handoff_hash: <sha256 hex>

# 命令（可选）
build_command: null
verify_command: null
direct_override: false

# 状态
archived: false
```

### 状态转换

```
issue ──issue-complete──→ design ──design-complete──→ build ──build-complete──→ verify
                                                        │                        │
                                                   verify-fail ←──────── verify-pass
                                                                                │
                                                                                ▼
                                                                         archive ──archived──→ [done]
                                                                              │
                                                                         archive-reopen
                                                                              │
                                                                              ▼
                                                                          (back to verify)
```

| 转换 | 前置条件 |
|------|---------|
| issue → design | proposal.md + tasks.md 存在 |
| design → build | design_doc 字段已设置且文件存在 |
| build → verify | 所有任务完成，审查通过 |
| verify → archive | verification_report 存在，branch_status=handled |
| verify → build | —（保留报告和分支状态）|
| archive → done | archived=true |
| archive → verify | 用户拒绝归档确认 |

### 三层配置优先级

1. **环境变量**（最高）：`SMART_AUTO_TRANSITION`、`SMART_CONTEXT_COMPRESSION`
2. **项目配置**：`.smart/config.yaml`
3. **变更配置**（最低）：`openspec/changes/<name>/.smart.yaml`

### 下一步解析器

`smart-state next <change-name>` 根据当前状态决定下一步：

| 阶段 | auto_transition | 结果 | 下一技能 |
|------|----------------|------|---------|
| issue | true | auto | smart-design / smart-build |
| issue | false | manual | — |
| design | true | auto | smart-build |
| design | false | manual | — |
| build | true | auto | smart-verify |
| verify (pass) | true | auto | smart-archive |
| verify (fail) | true | auto | smart-build |
| archive (done) | any | done | — |

## 3.4 防漂移保护

两层防御：

| 层 | 机制 | 效果 |
|----|------|------|
| **软**：Phase Guard Rule | 每轮对话注入 | 提醒 Agent 当前阶段、所需产物 |
| **硬**：Hook Guard | PreToolUse 拦截 | 错误阶段禁止写源码 |

Hook Guard 白名单：`openspec/*`、`docs/superpowers/*`、`.smart/*`、`.claude/*`

## 3.5 9 个用户决策点

1. 需求澄清（issue）
2. 变更名称确认（issue）
3. PRD 拆分决策（issue）
4. 设计方案确认（design）
5. 构建模式选择（build）
6. 隔离模式选择（build）
7. 审查模式选择（build）
8. 验证通过/失败确认（verify）
9. 归档确认（archive）
