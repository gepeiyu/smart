import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    copyFileSync: vi.fn(),
    readdirSync: vi.fn(),
    rmdirSync: vi.fn(),
    cpSync: vi.fn(),
    rmSync: vi.fn(),
    unlinkSync: vi.fn(),
    mkdtempSync: vi.fn(),
  },
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  copyFileSync: vi.fn(),
  readdirSync: vi.fn(),
  rmdirSync: vi.fn(),
  cpSync: vi.fn(),
  rmSync: vi.fn(),
  unlinkSync: vi.fn(),
  mkdtempSync: vi.fn(),
}));

vi.mock('child_process', () => ({
  execFileSync: vi.fn(),
}));

import { execFileSync } from 'child_process';
import { existsSync, writeFileSync, copyFileSync, unlinkSync, readdirSync, rmdirSync, cpSync, rmSync, mkdirSync, mkdtempSync } from 'fs';
import { getNpmExecutable, buildOpenSpecInitInvocation, isCommandAvailable, installOpenSpec } from '../src/core/openspec.js';
import type { InstallScope } from '../src/core/types.js';

describe('openspec', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getNpmExecutable', () => {
    it('returns npm on non-Windows', () => {
      expect(getNpmExecutable('linux')).toBe('npm');
    });

    it('returns npm.cmd on Windows', () => {
      expect(getNpmExecutable('win32')).toBe('npm.cmd');
    });
  });

  describe('buildOpenSpecInitInvocation', () => {
    const toolIds = ['claude', 'cursor'];

    it('builds correct args for project scope', () => {
      const result = buildOpenSpecInitInvocation('/project', toolIds, 'project', '/home/user');
      expect(result.command).toBe('openspec');
      expect(result.args).toContain('init');
      expect(result.args).toContain('/project');
      expect(result.args).toContain('--tools');
      expect(result.args).toContain('claude,cursor');
      expect(result.args).toContain('--profile');
      expect(result.args).toContain('custom');
    });

    it('builds correct args for global scope', () => {
      const result = buildOpenSpecInitInvocation('/project', toolIds, 'global', '/home/user');
      expect(result.args).toContain('/home/user');
    });

    it('omits profile flag when includeProfileFlag is false', () => {
      const result = buildOpenSpecInitInvocation('/project', toolIds, 'project', '/home/user', false);
      expect(result.args).not.toContain('--profile');
    });
  });

  describe('isCommandAvailable', () => {
    it('returns true when command exists', () => {
      vi.mocked(execFileSync).mockImplementation(() => undefined);
      expect(isCommandAvailable('openspec')).toBe(true);
      expect(execFileSync).toHaveBeenCalled();
    });

    it('returns false when command not found', () => {
      vi.mocked(execFileSync).mockImplementation(() => { throw new Error('not found'); });
      expect(isCommandAvailable('openspec')).toBe(false);
    });
  });

  describe('installOpenSpec', () => {
    it('returns skipped when shouldInstallCli is false and CLI missing', async () => {
      vi.mocked(execFileSync).mockImplementation(() => { throw new Error('not found'); });
      const result = await installOpenSpec('/project', ['claude'], 'project', false);
      expect(result).toBe('skipped');
    });

    it('returns failed when CLI install fails', async () => {
      vi.mocked(execFileSync).mockImplementation(() => { throw new Error('not found'); });
      vi.mocked(mkdtempSync).mockReturnValue('/tmp/smart-openspec-profile-xxx');
      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(rmSync).mockImplementation(() => undefined);

      const result = await installOpenSpec('/project', ['claude'], 'project', true);
      expect(result).toBe('failed');
    });
  });

  it('validates all PLATFORMS have openspecToolId', async () => {
    const { PLATFORMS } = await import('../src/core/platforms.js');
    for (const p of PLATFORMS) {
      expect(p.openspecToolId).toBeTruthy();
    }
  });
});
