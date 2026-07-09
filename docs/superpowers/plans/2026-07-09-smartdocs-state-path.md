# Smartdocs State Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Move Smart-owned change state from `openspec/changes/<change>/.smart.yaml` to `smartdocs/changes/<change>/.smart.yaml` while keeping OpenSpec and Superpowers on their default directories.

**Architecture:** Add a small shared path helper for Smart-owned paths, update TypeScript commands to read state only from `smartdocs`, and update bundled shell scripts/skill guidance to write new state there. OpenSpec artifacts remain under `openspec/`; Superpowers specs/plans remain under `docs/superpowers/`.

**Tech Stack:** TypeScript CLI, Bash skill scripts, Vitest, Bats.

---

### Task 1: Lock In Directory Creation

**Files:**
- Modify: `test/skills.test.ts`
- Modify: `src/core/skills.ts`

- [x] Write a failing test that `createWorkingDirs()` creates `smartdocs/changes` in addition to `.smart` and Superpowers default directories.
- [x] Run `npm test -- test/skills.test.ts` and confirm the new assertion fails.
- [x] Update `createWorkingDirs()` to create `smartdocs/changes`.
- [x] Run `npm test -- test/skills.test.ts` and confirm it passes.

### Task 2: Centralize Smart Path Resolution

**Files:**
- Create: `src/core/smart-paths.ts`
- Modify: `src/commands/status.ts`
- Modify: `src/commands/doctor.ts`
- Modify: `src/dashboard/yaml.ts`

- [x] Add `smartdocsChangesDir(projectPath)`, `smartChangeDir(projectPath, changeName)`, and `smartYamlPath(projectPath, changeName)` helpers.
- [x] Do not read Smart state from `openspec/changes/<change>/.smart.yaml`.
- [x] Update `status`, `doctor`, and dashboard YAML reads to use the helper.
- [x] Add focused tests for new state discovery and old-path ignore behavior.

### Task 3: Update Runtime Scripts

**Files:**
- Modify: `assets/skills/smart/scripts/smart-state.sh`
- Modify: `assets/skills/smart/scripts/smart-guard.sh`
- Modify: `assets/skills/smart/scripts/smart-hook-guard.sh`
- Modify: `assets/skills/smart/scripts/smart-handoff.sh`
- Modify: `assets/skills/smart/scripts/smart-yaml-validate.sh`
- Modify: `assets/skills/smart/scripts/smart-archive.sh`
- Modify: `test/smart-state.test.ts`
- Modify: `test/shell/*.bats`

- [x] Update scripts so new writes go to `smartdocs/changes/<change>/.smart.yaml`.
- [x] Remove old-path read fallback.
- [x] Move handoff output to `smartdocs/changes/<change>/handoff/`.
- [x] Run shell-focused tests and fix failures.

### Task 4: Update Skill Documentation

**Files:**
- Modify: `assets/skills/smart/**/*.md`
- Modify: `assets/skills-zh/smart/**/*.md`
- Modify: `src/commands/i18n.ts`

- [x] Replace Smart state location references with `smartdocs/changes/<change>/.smart.yaml`.
- [x] Keep `docs/superpowers/` references unchanged.
- [x] Add `smartdocs/*` to allowed Smart-owned paths in rules and hook wording.

### Task 5: Verify

**Files:**
- Existing test suite

- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Report any skipped shell coverage or known migration caveats.
