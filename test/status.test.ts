import { describe, it, expect, vi, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { statusCommand } from '../src/commands/status.js';

function makeProject() {
  return mkdtempSync(path.join(tmpdir(), 'smart-status-'));
}

function writeState(project: string, change: string, stateRoot: 'smartdocs' | 'openspec') {
  const stateDir =
    stateRoot === 'smartdocs'
      ? path.join(project, 'smartdocs', 'changes', change)
      : path.join(project, 'openspec', 'changes', change);
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(
    path.join(stateDir, '.smart.yaml'),
    [
      'version: 1',
      'workflow_source: official/full',
      'support_level: official-certified',
      'route: standard',
      'status: active',
      'current_stage: design',
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
      expect(parsed.changes).toHaveLength(1);
      expect(parsed.changes[0]).toMatchObject({
        name: 'change-one',
        currentStage: 'design',
        workflowSource: 'official/full',
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
      expect(parsed.changes).toHaveLength(0);
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });
});
