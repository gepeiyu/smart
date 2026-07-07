import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const smartState = path.join(repoRoot, 'assets', 'skills', 'smart', 'scripts', 'smart-state.sh');

function withChange(workflow: 'full' | 'bugfix' | 'quick', phase = 'issue') {
  const dir = mkdtempSync(path.join(tmpdir(), 'smart-state-'));
  const changeDir = path.join(dir, 'openspec', 'changes', 'change');
  mkdirSync(changeDir, { recursive: true });
  writeFileSync(path.join(changeDir, '.smart.yaml'), [
    `workflow: ${workflow}`,
    `phase: ${phase}`,
    'auto_transition: true',
    'verify_result: pending',
    'archived: false',
  ].join('\n'));
  return { dir, smartFile: path.join(changeDir, '.smart.yaml') };
}

function runSmartState(cwd: string, ...args: string[]) {
  return execFileSync('bash', [smartState, ...args], { cwd, encoding: 'utf8' }).trim();
}

describe('smart-state workflow routing', () => {
  it('routes full workflow issue completion to design', () => {
    const change = withChange('full');
    try {
      const output = runSmartState(change.dir, 'transition', 'change', 'issue-complete');
      expect(output).toContain('TRANSITION: issue → design');
      expect(readFileSync(change.smartFile, 'utf8')).toContain('phase: design');
    } finally {
      rmSync(change.dir, { recursive: true, force: true });
    }
  });

  it('routes bugfix workflow issue completion to build', () => {
    const change = withChange('bugfix');
    try {
      const output = runSmartState(change.dir, 'transition', 'change', 'issue-complete');
      expect(output).toContain('TRANSITION: issue → build');
      expect(readFileSync(change.smartFile, 'utf8')).toContain('phase: build');
    } finally {
      rmSync(change.dir, { recursive: true, force: true });
    }
  });

  it('routes quick workflow issue completion to build', () => {
    const change = withChange('quick');
    try {
      const output = runSmartState(change.dir, 'transition', 'change', 'issue-complete');
      expect(output).toContain('TRANSITION: issue → build');
      expect(readFileSync(change.smartFile, 'utf8')).toContain('phase: build');
    } finally {
      rmSync(change.dir, { recursive: true, force: true });
    }
  });

  it('resolves mode next actions by workflow', () => {
    const bugfix = withChange('bugfix', 'build');
    const quick = withChange('quick', 'build');
    try {
      expect(runSmartState(bugfix.dir, 'next', 'change')).toBe('auto:smart-bugfix');
      expect(runSmartState(quick.dir, 'next', 'change')).toBe('auto:smart-quick');
    } finally {
      rmSync(bugfix.dir, { recursive: true, force: true });
      rmSync(quick.dir, { recursive: true, force: true });
    }
  });
});
