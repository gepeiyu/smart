import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock('../src/utils/file-system.js', () => ({
  fileExists: vi.fn(),
  readJson: vi.fn(),
  copyFile: vi.fn(),
  ensureDir: vi.fn(),
}));

import { fileExists, readJson, copyFile, ensureDir } from '../src/utils/file-system.js';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { computeRuleDestPath, isManagedHookCommand, getTopLevelSkillNames, readManifest, getManifestSkills, createWorkingDirs, copySmartRulesForPlatform, getAssetsDir } from '../src/core/skills.js';
import { PLATFORMS } from '../src/core/platforms.js';

describe('skills helpers (pure)', () => {
  describe('computeRuleDestPath', () => {
    it('keeps .md extension for md format', () => {
      const result = computeRuleDestPath('/rules', 'smart.md', 'md');
      expect(result.replace(/\\/g, '/')).toBe('/rules/smart.md');
    });

    it('converts to .mdc for mdc format', () => {
      const result = computeRuleDestPath('/rules', 'smart.md', 'mdc');
      expect(result.replace(/\\/g, '/')).toBe('/rules/smart.mdc');
    });

    it('converts to .instructions.md for copilot format', () => {
      const result = computeRuleDestPath('/rules', 'smart.md', 'copilot');
      expect(result.replace(/\\/g, '/')).toBe('/rules/smart.instructions.md');
    });
  });

  describe('isManagedHookCommand', () => {
    it('detects managed hook commands', () => {
      expect(isManagedHookCommand('bash .claude/skills/smart-guard.sh PreToolUse', ['smart-guard.sh'])).toBe(true);
    });

    it('rejects non-bash commands', () => {
      expect(isManagedHookCommand('node script.js', ['smart-guard.sh'])).toBe(false);
    });

    it('rejects unknown script paths', () => {
      expect(isManagedHookCommand('bash .claude/skills/other.sh', ['smart-guard.sh'])).toBe(false);
    });

    it('handles non-string commands', () => {
      expect(isManagedHookCommand(null, ['smart-guard.sh'])).toBe(false);
      expect(isManagedHookCommand(42, ['smart-guard.sh'])).toBe(false);
    });
  });

  describe('getTopLevelSkillNames', () => {
    it('extracts top-level skill names from paths', () => {
      const result = getTopLevelSkillNames(['smart/SKILL.md', 'smart-hotfix/SKILL.md']);
      expect(result).toEqual(['smart', 'smart-hotfix']);
    });

    it('filters out non-SKILL.md paths', () => {
      const result = getTopLevelSkillNames(['smart/SKILL.md', 'scripts/smart-guard.sh']);
      expect(result).toEqual(['smart']);
    });

    it('filters out deeply nested SKILL.md', () => {
      const result = getTopLevelSkillNames(['subdir/smart/SKILL.md']);
      expect(result).toEqual([]);
    });
  });
});

describe('createWorkingDirs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates expected directories and config', async () => {
    vi.mocked(fileExists).mockResolvedValue(false);
    vi.mocked(ensureDir).mockResolvedValue(undefined);
    vi.mocked(writeFile).mockResolvedValue(undefined);

    await createWorkingDirs('/project');

    expect(ensureDir).toHaveBeenCalledTimes(3);
    expect(ensureDir).toHaveBeenCalledWith(path.join('/project', 'docs', 'superpowers', 'specs'));
    expect(ensureDir).toHaveBeenCalledWith(path.join('/project', 'docs', 'superpowers', 'plans'));
    expect(ensureDir).toHaveBeenCalledWith(path.join('/project', '.smart'));
    expect(writeFile).toHaveBeenCalledWith(
      path.join('/project', '.smart', 'config.yaml'),
      expect.stringContaining('context_compression: off'),
      'utf-8',
    );
  });

  it('skips config if already exists', async () => {
    vi.mocked(fileExists).mockResolvedValue(true);
    vi.mocked(ensureDir).mockResolvedValue(undefined);

    await createWorkingDirs('/project');

    expect(writeFile).not.toHaveBeenCalled();
  });
});

describe('readManifest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads and returns manifest', async () => {
    vi.mocked(readJson).mockResolvedValue({
      version: '0.4.0',
      skills: ['smart/SKILL.md', 'smart-hotfix/SKILL.md'],
    });
    const manifest = await readManifest();
    expect(manifest.version).toBe('0.4.0');
    expect(manifest.skills).toHaveLength(2);
  });
});

describe('getManifestSkills', () => {
  it('returns skills array from manifest', async () => {
    vi.mocked(readJson).mockResolvedValue({
      version: '0.4.0',
      skills: ['smart/SKILL.md'],
    });
    const skills = await getManifestSkills();
    expect(skills).toEqual(['smart/SKILL.md']);
  });
});

describe('copySmartRulesForPlatform', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 0 when platform has no rulesDir', async () => {
    const gemini = PLATFORMS.find(p => p.id === 'gemini')!;
    expect(gemini.rulesDir).toBeUndefined();
    const result = await copySmartRulesForPlatform('/base', gemini, true);
    expect(result).toEqual({ copied: 0, skipped: 0 });
  });

  it('returns 0 when manifest has no rules', async () => {
    vi.mocked(readJson).mockResolvedValue({ version: '0.4.0', skills: [] });
    const cursor = PLATFORMS.find(p => p.id === 'cursor')!;
    const result = await copySmartRulesForPlatform('/base', cursor, true);
    expect(result).toEqual({ copied: 0, skipped: 0 });
  });
});
