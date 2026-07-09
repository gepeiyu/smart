import { describe, it, expect, vi, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { statusCommand } from '../src/commands/status.js';

function makeProject() {
  return mkdtempSync(path.join(tmpdir(), 'smart-status-'));
}

function writeState(project: string, change: string, stateRoot: 'smartdocs' | 'openspec') {
  const openspecChangeDir = path.join(project, 'openspec', 'changes', change);
  mkdirSync(openspecChangeDir, { recursive: true });

  const stateDir = stateRoot === 'smartdocs'
    ? path.join(project, 'smartdocs', 'changes', change)
    : openspecChangeDir;
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(path.join(stateDir, '.smart.yaml'), [
    'workflow: full',
    'phase: design',
    'verify_result: pending',
    'archived: false',
  ].join('\n'));
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
        phase: 'design',
        workflow: 'full',
      });
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });

  it('ignores Smart state inside openspec change directories', async () => {
    const project = makeProject();
    try {
      writeState(project, 'old-path-change', 'openspec');
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
