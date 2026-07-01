import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('child_process', () => ({
  execFileSync: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  cp: vi.fn(),
  mkdir: vi.fn(),
  mkdtemp: vi.fn(),
  readdir: vi.fn(),
  rm: vi.fn(),
}));

import { execFileSync } from 'child_process';
import { mkdir, mkdtemp, readdir, cp, rm } from 'fs/promises';
import { buildSuperpowersInstallCommand, buildLingmaSuperpowersStageCommand, SKILLS_AGENT_MAP, installSuperpowersForPlatforms } from '../src/core/superpowers.js';
import { PLATFORMS } from '../src/core/platforms.js';
import type { InstallScope } from '../src/core/types.js';

describe('superpowers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getNpxExecutable (internal)', () => {
    // This function uses process.platform at call time; test via buildSuperpowersInstallCommand
    it('buildSuperpowersInstallCommand starts with npx', () => {
      const result = buildSuperpowersInstallCommand('/project', 'project', ['claude']);
      expect(result.command).toMatch(/^npx/);
    });
  });

  describe('SKILLS_AGENT_MAP', () => {
    it('covers all platforms', () => {
      for (const p of PLATFORMS) {
        expect(SKILLS_AGENT_MAP).toHaveProperty(p.id);
      }
    });

    it('has correct agent names for known platforms', () => {
      expect(SKILLS_AGENT_MAP.claude).toBe('claude-code');
      expect(SKILLS_AGENT_MAP.cursor).toBe('cursor');
      expect(SKILLS_AGENT_MAP['github-copilot']).toBe('github-copilot');
      expect(SKILLS_AGENT_MAP.gemini).toBe('gemini-cli');
    });

    it('lingma has null agent (staged install)', () => {
      expect(SKILLS_AGENT_MAP.lingma).toBeNull();
    });

    it('has no unknown keys beyond platform ids', () => {
      const platformIds = new Set(PLATFORMS.map(p => p.id));
      for (const key of Object.keys(SKILLS_AGENT_MAP)) {
        expect(platformIds.has(key)).toBe(true);
      }
    });
  });

  describe('buildSuperpowersInstallCommand', () => {
    it('builds command for project scope', () => {
      const result = buildSuperpowersInstallCommand('/project', 'project', ['claude', 'cursor']);
      expect(result.command).toMatch(/^npx/);
      expect(result.args).toContain('skills');
      expect(result.args).toContain('add');
      expect(result.args).toContain('obra/superpowers');
      expect(result.args).toContain('-y');
      expect(result.args).not.toContain('-g');
    });

    it('includes -g for global scope', () => {
      const result = buildSuperpowersInstallCommand('/project', 'global', ['claude']);
      expect(result.args).toContain('-g');
    });

    it('throws for unknown platform IDs', () => {
      expect(() => buildSuperpowersInstallCommand('/project', 'project', ['unknown'])).toThrow('Unknown platform IDs');
    });

    it('throws when no agent names resolved', () => {
      expect(() => buildSuperpowersInstallCommand('/project', 'project', ['lingma'])).toThrow('No skills CLI agent names resolved');
    });

    it('deduplicates agent names', () => {
      const result = buildSuperpowersInstallCommand('/project', 'project', ['claude', 'codex']);
      const agentFlags = result.args.filter((a, i) => a === '--agent' && i > 0).length;
      expect(agentFlags).toBe(2);
    });
  });

  describe('buildLingmaSuperpowersStageCommand', () => {
    it('builds staged install command', () => {
      const result = buildLingmaSuperpowersStageCommand();
      expect(result.args).toContain('--agent');
      expect(result.args).toContain('claude-code');
    });
  });

  describe('installSuperpowersForPlatforms', () => {
    it('returns skipped when shouldInstall is false', async () => {
      const result = await installSuperpowersForPlatforms('/project', 'project', ['claude'], false);
      expect(result).toBe('skipped');
    });

    it('throws for unknown platform IDs', async () => {
      await expect(installSuperpowersForPlatforms('/project', 'project', ['unknown'], true)).rejects.toThrow('Unknown platform IDs');
    });

    it('installs for known platforms', async () => {
      vi.mocked(execFileSync).mockImplementation(() => undefined);
      const result = await installSuperpowersForPlatforms('/project', 'project', ['claude'], true);
      expect(result).toBe('installed');
    });

    it('returns failed when exec fails', async () => {
      vi.mocked(execFileSync).mockImplementation(() => { throw new Error('install failed'); });
      const result = await installSuperpowersForPlatforms('/project', 'project', ['claude'], true);
      expect(result).toBe('failed');
    });
  });
});
