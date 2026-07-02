# .smart.yaml 字段参考

## 核心字段

```yaml
workflow: full                    # full | hotfix | tweak
phase: issue                       # issue | design | build | verify | archive
auto_transition: true             # true | false
```

## 执行模式

```yaml
build_mode: subagent-driven-development  # subagent-driven-development | executing-plans | direct
build_pause: null                 # null | plan-ready
isolation: branch                 # branch | worktree
tdd_mode: null                    # null | tdd | direct
subagent_dispatch: null           # null | confirmed
```

## 审查与验证

```yaml
review_mode: standard             # off | standard | thorough
verify_mode: null                 # null | light | full
verify_result: pending            # pending | pass | fail
verification_report: null         # 路径或 null
branch_status: pending            # pending | handled
```

## 产物路径

```yaml
design_doc: docs/superpowers/specs/YYYY-MM-DD-topic-design.md
plan: docs/superpowers/plans/YYYY-MM-DD-feature.md
handoff_context: openspec/changes/<name>/.smart/handoff/design-context.json
handoff_hash: <sha256 hex>
```

## 命令

```yaml
build_command: null
verify_command: null
direct_override: false
```

## 状态

```yaml
archived: false
```

## 配置优先级

1. **环境变量**（最高）：`SMART_AUTO_TRANSITION`、`SMART_CONTEXT_COMPRESSION`
2. **项目配置**：`.smart/config.yaml`
3. **变更配置**（最低）：`openspec/changes/<name>/.smart.yaml`

## 状态转换

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
