import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/utils/file-system.js', () => ({
  fileExists: vi.fn(),
  readDir: vi.fn(),
}));

import { fileExists, readDir } from '../src/utils/file-system.js';
import { detectPlatforms, detectGlobalPlatforms, checkInstalledSkills, hasSkills, getBaseDir } from '../src/core/detect.js';
import { PLATFORMS } from '../src/core/platforms.js';

describe('detect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detectPlatforms', () => {
    it('returns empty array when no platforms detected', async () => {
      vi.mocked(fileExists).mockResolvedValue(false);
      const result = await detectPlatforms('/empty-project');
      expect(result).toEqual([]);
    });

    it('detects claude when .claude dir exists', async () => {
      vi.mocked(fileExists).mockImplementation(async (p: string) => p.includes('.claude'));
      const result = await detectPlatforms('/project');
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.some(p => p.id === 'claude')).toBe(true);
    });
  });

  describe('detectGlobalPlatforms', () => {
    it('returns empty when no home dir', async () => {
      const homeSave = process.env.HOME;
      process.env.HOME = '';
      vi.mocked(fileExists).mockResolvedValue(false);
      const result = await detectGlobalPlatforms();
      expect(result).toEqual([]);
      process.env.HOME = homeSave;
    });

    it('detects platforms with existing globalSkillsDir', async () => {
      vi.mocked(fileExists).mockImplementation(async (p: string) => p.includes('.claude'));
      const result = await detectGlobalPlatforms();
      expect(result.some(p => p.id === 'claude')).toBe(true);
    });
  });

  describe('checkInstalledSkills', () => {
    it('detects installed skill types from directory names', async () => {
      vi.mocked(readDir).mockResolvedValue(['openspec', 'superpowers', 'smart']);
      const result = await checkInstalledSkills(PLATFORMS[0], '/project');
      expect(result).toEqual({ openspec: true, superpowers: true, smart: true });
    });

    it('handles case-insensitive matching', async () => {
      vi.mocked(readDir).mockResolvedValue(['OpenSpec', 'SUPERPOWERS', 'SMART']);
      const result = await checkInstalledSkills(PLATFORMS[0], '/project');
      expect(result).toEqual({ openspec: true, superpowers: true, smart: true });
    });
  });

  describe('hasSkills', () => {
    it('returns true when smart skills exist', async () => {
      vi.mocked(readDir).mockResolvedValue(['smart']);
      const result = await hasSkills(PLATFORMS[0], '/project');
      expect(result).toBe(true);
    });

    it('returns false when no smart skills', async () => {
      vi.mocked(readDir).mockResolvedValue(['openspec']);
      const result = await hasSkills(PLATFORMS[0], '/project');
      expect(result).toBe(false);
    });
  });

  describe('getBaseDir', () => {
    it('returns dir for project scope', () => {
      expect(getBaseDir('/my-project', 'project')).toBe('/my-project');
    });

    it('returns home dir for global scope', () => {
      const home = process.env.HOME || process.env.USERPROFILE || process.cwd();
      expect(getBaseDir('/my-project', 'global')).toBe(home);
    });
  });
});
