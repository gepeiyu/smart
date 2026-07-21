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

vi.mock('fs', () => ({
  existsSync: vi.fn(),
}));

import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import {
  hasCodegraphProjectIndex,
  initializeCodegraph,
  resolveCodegraphCommand,
  resolvePnpmGlobalCommand,
} from '../src/core/codegraph.js';

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
    it('returns local codegraph when project bin is available', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(execFileSync).mockImplementationOnce(() => '1.0.0' as unknown as void);
      const result = resolveCodegraphCommand('/project');
      expect(result).toEqual({
        command: '/project/node_modules/.bin/codegraph',
        location: 'local',
      });
    });

    it('returns global codegraph when available', () => {
      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(execFileSync).mockImplementationOnce(() => '1.0.0' as unknown as void);
      const result = resolveCodegraphCommand();
      expect(result).toEqual({ command: 'codegraph', location: 'global' });
    });

    it('returns null when not available', () => {
      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(execFileSync).mockImplementation(() => {
        throw new Error('not found');
      });
      const result = resolveCodegraphCommand();
      expect(result).toBeNull();
    });
  });

  describe('resolvePnpmGlobalCommand', () => {
    it('returns pnpm when available', () => {
      vi.mocked(execFileSync).mockImplementationOnce(() => '9.0.0' as unknown as void);
      expect(resolvePnpmGlobalCommand()).toBe('pnpm');
    });

    it('returns empty when pnpm not available', () => {
      vi.mocked(execFileSync).mockImplementation(() => {
        throw new Error('not found');
      });
      expect(resolvePnpmGlobalCommand()).toBe('');
    });
  });

  describe('initializeCodegraph', () => {
    it('runs project initialization through a local command', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(execFileSync)
        .mockImplementationOnce(() => '1.0.0' as unknown as void)
        .mockImplementationOnce(() => undefined);

      expect(initializeCodegraph('/project')).toBe(true);
      expect(execFileSync).toHaveBeenLastCalledWith(
        '/project/node_modules/.bin/codegraph',
        ['init', '-i'],
        expect.objectContaining({ cwd: '/project' }),
      );
    });
  });
});
