import { mkdir, mkdtemp, readFile, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';

import { fileExists } from '../src/utils/file-system.js';
import { PLATFORMS } from '../src/core/platforms.js';
import {
  removeAssociatedProjectInstalls,
  removeProjectPackageReferences,
  removeSmartHooks,
  removeSmartWorkingDirs,
  pruneEmptyPlatformDir,
  removeSmartRules,
  removeSmartSkillsForPlatform,
} from '../src/core/uninstall.js';

async function tempProject(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), 'smart-uninstall-test-'));
}

describe('uninstall helpers', () => {
  it('removes Smart skill directories from the installed skills folder', async () => {
    const baseDir = await tempProject();
    const claude = PLATFORMS.find((platform) => platform.id === 'claude')!;
    const skillsRoot = path.join(baseDir, '.claude', 'skills');

    await mkdir(path.join(skillsRoot, 'smart'), { recursive: true });
    await mkdir(path.join(skillsRoot, 'smart-bugfix'), { recursive: true });
    await mkdir(path.join(skillsRoot, 'user-skill'), { recursive: true });
    await writeFile(path.join(skillsRoot, 'smart', 'SKILL.md'), '# Smart');
    await writeFile(path.join(skillsRoot, 'smart-bugfix', 'SKILL.md'), '# Smart Bugfix');
    await writeFile(path.join(skillsRoot, 'user-skill', 'SKILL.md'), '# User Skill');

    const removed = await removeSmartSkillsForPlatform(claude, baseDir);

    expect(removed).toBe(2);
    await expect(fileExists(path.join(skillsRoot, 'smart'))).resolves.toBe(false);
    await expect(fileExists(path.join(skillsRoot, 'smart-bugfix'))).resolves.toBe(false);
    await expect(fileExists(path.join(skillsRoot, 'user-skill'))).resolves.toBe(true);
  });

  it('preserves rules not declared by the current manifest', async () => {
    const baseDir = await tempProject();
    const cursor = PLATFORMS.find((platform) => platform.id === 'cursor')!;
    const rulesRoot = path.join(baseDir, '.cursor', 'rules');

    await mkdir(rulesRoot, { recursive: true });
    await writeFile(path.join(rulesRoot, 'smart-phase-guard.mdc'), '# Smart Rule');
    await writeFile(path.join(rulesRoot, 'user-rule.mdc'), '# User Rule');

    const removed = await removeSmartRules(cursor, baseDir);

    expect(removed).toBe(0);
    await expect(fileExists(path.join(rulesRoot, 'smart-phase-guard.mdc'))).resolves.toBe(true);
    await expect(fileExists(path.join(rulesRoot, 'user-rule.mdc'))).resolves.toBe(true);
  });

  it('preserves hooks not declared by the current manifest', async () => {
    const baseDir = await tempProject();
    const codex = PLATFORMS.find((platform) => platform.id === 'codex')!;
    const settingsPath = path.join(baseDir, '.codex', 'settings.local.json');

    await mkdir(path.dirname(settingsPath), { recursive: true });
    await writeFile(
      settingsPath,
      JSON.stringify(
        {
          hooks: {
            PreToolUse: [
              {
                matcher: 'Write|Edit',
                hooks: [
                  {
                    type: 'command',
                    command: 'bash .codex/skills/smart/scripts/smart-hook-guard.sh',
                  },
                  { type: 'command', command: 'bash .codex/skills/user-hook.sh' },
                ],
              },
            ],
          },
        },
        null,
        2,
      ),
    );

    const removed = await removeSmartHooks(codex, baseDir);
    const settings = JSON.parse(await readFile(settingsPath, 'utf-8')) as {
      hooks: { PreToolUse: Array<{ hooks: Array<{ command: string }> }> };
    };

    expect(removed).toBe(0);
    expect(settings.hooks.PreToolUse).toHaveLength(1);
    expect(settings.hooks.PreToolUse[0].hooks).toHaveLength(2);
  });

  it('removes an empty platform directory after Smart files are gone', async () => {
    const baseDir = await tempProject();
    const claude = PLATFORMS.find((platform) => platform.id === 'claude')!;
    const platformRoot = path.join(baseDir, '.claude');

    await mkdir(path.join(platformRoot, 'skills'), { recursive: true });

    const removed = await pruneEmptyPlatformDir(claude, baseDir, 'project');

    expect(removed).toBe(true);
    await expect(fileExists(platformRoot)).resolves.toBe(false);
  });

  it('removes Smart config while preserving generated docs', async () => {
    const baseDir = await tempProject();

    await mkdir(path.join(baseDir, 'docs', 'superpowers', 'specs'), { recursive: true });
    await mkdir(path.join(baseDir, 'docs', 'superpowers', 'plans'), { recursive: true });
    await mkdir(path.join(baseDir, '.smart'), { recursive: true });

    const removed = await removeSmartWorkingDirs(baseDir);

    expect(removed).toBe(1);
    await expect(fileExists(path.join(baseDir, '.smart'))).resolves.toBe(false);
    await expect(fileExists(path.join(baseDir, 'docs', 'superpowers', 'specs'))).resolves.toBe(
      true,
    );
  });

  it('removes Smart-introduced npm package references without touching app dependencies', async () => {
    const baseDir = await tempProject();

    await writeFile(
      path.join(baseDir, 'package.json'),
      JSON.stringify(
        {
          dependencies: {
            '@fission-ai/openspec': '^1.5.0',
            '@colbymchenry/codegraph': '^0.1.0',
            ws: '^8.18.0',
          },
        },
        null,
        2,
      ),
    );
    await writeFile(
      path.join(baseDir, 'package-lock.json'),
      JSON.stringify(
        {
          lockfileVersion: 3,
          packages: {
            '': {
              dependencies: {
                '@fission-ai/openspec': '^1.5.0',
                '@colbymchenry/codegraph': '^0.1.0',
                ws: '^8.18.0',
              },
            },
            'node_modules/@fission-ai/openspec': { version: '1.5.0' },
            'node_modules/@colbymchenry/codegraph': { version: '0.1.0' },
            'node_modules/ws': { version: '8.18.0' },
          },
          dependencies: {
            '@fission-ai/openspec': { version: '1.5.0' },
            '@colbymchenry/codegraph': { version: '0.1.0' },
            ws: { version: '8.18.0' },
          },
        },
        null,
        2,
      ),
    );
    await mkdir(path.join(baseDir, 'node_modules', '@fission-ai', 'openspec'), { recursive: true });
    await mkdir(path.join(baseDir, 'node_modules', '@colbymchenry', 'codegraph'), {
      recursive: true,
    });
    await mkdir(path.join(baseDir, 'node_modules', 'ws'), { recursive: true });

    const removed = await removeProjectPackageReferences(baseDir);
    const pkg = JSON.parse(await readFile(path.join(baseDir, 'package.json'), 'utf-8')) as {
      dependencies: Record<string, string>;
    };
    const lock = JSON.parse(await readFile(path.join(baseDir, 'package-lock.json'), 'utf-8')) as {
      packages: Record<string, unknown>;
      dependencies: Record<string, unknown>;
    };

    expect(removed).toBe(2);
    expect(pkg.dependencies).toEqual({ ws: '^8.18.0' });
    expect(lock.packages[''].dependencies).toEqual({ ws: '^8.18.0' });
    expect(lock.packages['node_modules/@fission-ai/openspec']).toBeUndefined();
    expect(lock.packages['node_modules/@colbymchenry/codegraph']).toBeUndefined();
    expect(lock.dependencies).toEqual({ ws: { version: '8.18.0' } });
    await expect(
      fileExists(path.join(baseDir, 'node_modules', '@fission-ai', 'openspec')),
    ).resolves.toBe(false);
    await expect(
      fileExists(path.join(baseDir, 'node_modules', '@colbymchenry', 'codegraph')),
    ).resolves.toBe(false);
    await expect(fileExists(path.join(baseDir, 'node_modules', 'ws'))).resolves.toBe(true);
  });

  it('removes project-level associated installs while preserving work products', async () => {
    const baseDir = await tempProject();

    await mkdir(path.join(baseDir, '.claude', 'skills', 'openspec-new-change'), {
      recursive: true,
    });
    await mkdir(path.join(baseDir, '.claude', 'skills', 'user-skill'), { recursive: true });
    await mkdir(path.join(baseDir, '.claude', 'commands', 'opsx'), { recursive: true });
    await writeFile(path.join(baseDir, '.claude', 'commands', 'opsx', 'new.md'), '# OpenSpec');
    await writeFile(
      path.join(baseDir, '.claude', 'skills', 'openspec-new-change', 'SKILL.md'),
      '# OpenSpec',
    );
    await writeFile(path.join(baseDir, '.claude', 'skills', 'user-skill', 'SKILL.md'), '# User');
    await mkdir(path.join(baseDir, '.cursor', 'commands'), { recursive: true });
    await mkdir(path.join(baseDir, '.cursor', 'rules'), { recursive: true });
    await writeFile(path.join(baseDir, '.cursor', 'commands', 'opsx-new.md'), '# OpenSpec');
    await writeFile(path.join(baseDir, '.cursor', 'rules', 'codegraph.mdc'), '# CodeGraph');

    await mkdir(path.join(baseDir, '.agents', 'skills', 'brainstorming'), { recursive: true });
    await mkdir(path.join(baseDir, '.agents', 'skills', 'user-skill'), { recursive: true });
    await writeFile(
      path.join(baseDir, '.agents', 'skills', 'brainstorming', 'SKILL.md'),
      '# Superpowers',
    );
    await writeFile(path.join(baseDir, '.agents', 'skills', 'user-skill', 'SKILL.md'), '# User');
    await writeFile(
      path.join(baseDir, 'skills-lock.json'),
      JSON.stringify(
        {
          version: 1,
          skills: {
            brainstorming: { source: 'obra/superpowers' },
            'user-skill': { source: 'local' },
          },
        },
        null,
        2,
      ),
    );

    await mkdir(path.join(baseDir, '.codegraph'), { recursive: true });
    await writeFile(path.join(baseDir, '.codegraph', 'codegraph.db'), 'index');
    await mkdir(path.join(baseDir, '.smart'), { recursive: true });
    await writeFile(path.join(baseDir, '.smart', 'config.yaml'), 'smart_language: en\n');
    await mkdir(path.join(baseDir, 'docs', 'superpowers', 'specs'), { recursive: true });
    await writeFile(path.join(baseDir, 'docs', 'superpowers', 'specs', 'design.md'), '# Design');
    await mkdir(path.join(baseDir, 'openspec', 'changes', 'add-feature'), { recursive: true });
    await writeFile(
      path.join(baseDir, 'openspec', 'changes', 'add-feature', 'proposal.md'),
      '# Proposal',
    );

    const removed = await removeAssociatedProjectInstalls(baseDir, [
      PLATFORMS.find((platform) => platform.id === 'claude')!,
      PLATFORMS.find((platform) => platform.id === 'cursor')!,
    ]);
    const lock = JSON.parse(await readFile(path.join(baseDir, 'skills-lock.json'), 'utf-8')) as {
      skills: Record<string, unknown>;
    };

    expect(removed.openspecSkills).toBe(1);
    expect(removed.openspecCommands).toBe(2);
    expect(removed.codegraph).toBe(2);
    expect(removed.superpowers).toBe(1);
    await expect(
      fileExists(path.join(baseDir, '.claude', 'skills', 'openspec-new-change')),
    ).resolves.toBe(false);
    await expect(fileExists(path.join(baseDir, '.claude', 'commands', 'opsx'))).resolves.toBe(
      false,
    );
    await expect(
      fileExists(path.join(baseDir, '.cursor', 'commands', 'opsx-new.md')),
    ).resolves.toBe(false);
    await expect(fileExists(path.join(baseDir, '.cursor', 'rules', 'codegraph.mdc'))).resolves.toBe(
      false,
    );
    await expect(fileExists(path.join(baseDir, '.codegraph'))).resolves.toBe(false);
    await expect(fileExists(path.join(baseDir, '.smart'))).resolves.toBe(false);
    await expect(fileExists(path.join(baseDir, '.claude', 'skills', 'user-skill'))).resolves.toBe(
      true,
    );
    await expect(fileExists(path.join(baseDir, '.agents', 'skills', 'user-skill'))).resolves.toBe(
      true,
    );
    expect(lock.skills).toEqual({ 'user-skill': { source: 'local' } });
    await expect(
      fileExists(path.join(baseDir, 'docs', 'superpowers', 'specs', 'design.md')),
    ).resolves.toBe(true);
    await expect(
      fileExists(path.join(baseDir, 'openspec', 'changes', 'add-feature', 'proposal.md')),
    ).resolves.toBe(true);
  });
});
