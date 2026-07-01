import { describe, it, expect } from 'vitest';
import { PLATFORMS, getPlatformSkillsDir, getPlatformSkillsDirs } from '../src/core/platforms.js';

describe('platforms', () => {
  it('has 29 platforms', () => {
    expect(PLATFORMS.length).toBe(29);
  });

  it('every platform has id, name, skillsDir, openspecToolId', () => {
    for (const p of PLATFORMS) {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.skillsDir).toBeTruthy();
      expect(p.openspecToolId).toBeTruthy();
      expect(p.skillsDir).toMatch(/^\./);
    }
  });

  it('platforms with hooks have hookFormat', () => {
    for (const p of PLATFORMS) {
      if (p.supportsHooks) {
        expect(p.hookFormat).toBeTruthy();
      }
    }
  });

  it('getPlatformSkillsDir returns skillsDir for project scope', () => {
    const claude = PLATFORMS.find(p => p.id === 'claude')!;
    expect(getPlatformSkillsDir(claude, 'project')).toBe('.claude');
  });

  it('getPlatformSkillsDir returns globalSkillsDir for global scope', () => {
    const claude = PLATFORMS.find(p => p.id === 'claude')!;
    expect(getPlatformSkillsDir(claude, 'global')).toBe('.claude');
  });

  it('getPlatformSkillsDir returns skillsDir when global scope has no globalSkillsDir', () => {
    const junie = PLATFORMS.find(p => p.id === 'junie')!;
    expect(getPlatformSkillsDir(junie, 'global')).toBe('.junie');
  });

  it('getPlatformSkillsDirs returns one entry', () => {
    const cursor = PLATFORMS.find(p => p.id === 'cursor')!;
    expect(getPlatformSkillsDirs(cursor, 'project')).toEqual(['.cursor']);
  });

  it('claude-code has correct config', () => {
    const claude = PLATFORMS.find(p => p.id === 'claude')!;
    expect(claude.rulesDir).toBe('rules');
    expect(claude.rulesFormat).toBe('md');
    expect(claude.supportsHooks).toBe(true);
    expect(claude.hookFormat).toBe('claude-code');
  });

  it('github-copilot has copilot rules format', () => {
    const copilot = PLATFORMS.find(p => p.id === 'github-copilot')!;
    expect(copilot.rulesFormat).toBe('copilot');
    expect(copilot.detectionPaths).toBeDefined();
    expect(copilot.detectionPaths!.length).toBeGreaterThan(0);
  });
});
