import { describe, it, expect, vi, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { statusCommand } from '../src/commands/status.js';

function makeProject() {
  return mkdtempSync(path.join(tmpdir(), 'smart-status-'));
}

function writeState(
  project: string,
  change: string,
  stateRoot: 'smartdocs' | 'openspec',
  overrides: string[] = [],
) {
  const stateDir =
    stateRoot === 'smartdocs'
      ? path.join(project, 'smartdocs', 'changes', change)
      : path.join(project, 'openspec', 'changes', change);
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(
    path.join(stateDir, '.smart.yaml'),
    [
      'version: 1',
      `change: ${change}`,
      'workflow_source: official/full',
      'workflow_digest: old-digest',
      'support_level: official-certified',
      'route: standard',
      'status: active',
      'current_stage: design',
      'ready_stages:',
      '  - design',
      'completed_stages:',
      '  - issue',
      'evidence:',
      '  user-request: provided',
      'failure: null',
      'created_at: 2026-07-21T00:00:00.000Z',
      'updated_at: 2026-07-21T01:00:00.000Z',
      ...overrides,
    ].join('\n'),
  );
}

describe('statusCommand state paths', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads active change state from smartdocs', async () => {
    const project = makeProject();
    try {
      writeState(project, 'change-one', 'smartdocs');
      let output = '';
      vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
        output += chunk.toString();
        return true;
      });

      await statusCommand(project, { json: true });

      const parsed = JSON.parse(output);
      expect(parsed.runs).toHaveLength(1);
      expect(parsed.runs[0]).toMatchObject({
        name: 'change-one',
        currentStage: 'design',
        workflowSource: 'official/full',
        status: 'active',
      });
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });

  it('ignores Smart state inside openspec change directories', async () => {
    const project = makeProject();
    try {
      writeState(project, 'old-path-change', 'openspec');
      mkdirSync(path.join(project, 'smartdocs', 'changes'), { recursive: true });
      let output = '';
      vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
        output += chunk.toString();
        return true;
      });

      await statusCommand(project, { json: true });

      const parsed = JSON.parse(output);
      expect(parsed.runs).toHaveLength(0);
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });

  it('reports malformed Smart state instead of silently dropping it', async () => {
    const project = makeProject();
    try {
      const stateDir = path.join(project, 'smartdocs', 'changes', 'broken-change');
      mkdirSync(stateDir, { recursive: true });
      writeFileSync(path.join(stateDir, '.smart.yaml'), 'status: definitely-not-valid\n');
      let output = '';
      vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
        output += chunk.toString();
        return true;
      });

      await statusCommand(project, { json: true });

      const parsed = JSON.parse(output);
      expect(parsed.runs).toHaveLength(1);
      expect(parsed.runs[0]).toMatchObject({ name: 'broken-change', status: 'invalid' });
      expect(parsed.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'run.broken-change.invalid', status: 'fail' }),
        ]),
      );
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });

  it('renders status in the language selected during initialization', async () => {
    const project = makeProject();
    try {
      mkdirSync(path.join(project, '.smart'), { recursive: true });
      writeFileSync(
        path.join(project, '.smart', 'config.yaml'),
        'smart_language: zh\nauto_transition: true\n',
      );
      const lines: string[] = [];
      vi.spyOn(console, 'log').mockImplementation((...values: unknown[]) => {
        lines.push(values.join(' '));
      });

      await statusCommand(project);

      expect(lines.join('\n')).toContain('Smart 状态');
      expect(lines.join('\n')).toContain('当前变更');
      expect(lines.join('\n')).toContain('诊断');
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });
});
