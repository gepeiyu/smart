import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fileExists, readDir } from '../src/utils/file-system.js';

vi.mock('../src/utils/file-system.js', () => ({
  fileExists: vi.fn(),
  readDir: vi.fn(),
}));

vi.mock('child_process', () => ({
  execFileSync: vi.fn(),
  execSync: vi.fn(),
}));

import { execFileSync } from 'child_process';
import { hasCodegraphProjectIndex, resolveCodegraphCommand, resolvePnpmGlobalCommand } from '../src/core/codegraph.js';

describe('codegraph', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('hasCodegraphProjectIndex', () => {
    it('returns false when .codegraph dir does not exist', async () => {
      vi.mocked(fileExists).mockResolvedValue(false);
      const result = await hasCodegraphProjectIndex('/project');
      expect(result).toBe(false);
    });

    it('returns false when .codegraph dir is empty', async () => {
      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readDir).mockResolvedValue([]);
      const result = await hasCodegraphProjectIndex('/project');
      expect(result).toBe(false);
    });

    it('returns true when .codegraph has entries', async () => {
      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readDir).mockResolvedValue(['index.json']);
      const result = await hasCodegraphProjectIndex('/project');
      expect(result).toBe(true);
    });
  });

  describe('resolveCodegraphCommand', () => {
    it('returns codegraph when available', () => {
      vi.mocked(execFileSync).mockImplementationOnce(() => '1.0.0' as unknown as void);
      const result = resolveCodegraphCommand();
      expect(result).toBe('codegraph');
    });

    it('returns empty string when not available', () => {
      vi.mocked(execFileSync).mockImplementation(() => { throw new Error('not found'); });
      const result = resolveCodegraphCommand();
      expect(result).toBe('');
    });
  });

  describe('resolvePnpmGlobalCommand', () => {
    it('returns pnpm when available', () => {
      vi.mocked(execFileSync).mockImplementationOnce(() => '9.0.0' as unknown as void);
      expect(resolvePnpmGlobalCommand()).toBe('pnpm');
    });

    it('returns empty when pnpm not available', () => {
      vi.mocked(execFileSync).mockImplementation(() => { throw new Error('not found'); });
      expect(resolvePnpmGlobalCommand()).toBe('');
    });
  });
});
