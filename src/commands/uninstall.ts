import path from 'path';
import { checkbox, select } from '@inquirer/prompts';
import { getBaseDir, type InstallScope } from '../core/detect.js';
import { getPlatformSkillsDir } from '../core/platforms.js';
import {
  pruneEmptyPlatformDir,
  removeSmartHooks,
  removeSmartRules,
  removeSmartSkillsForPlatform,
  removeSmartWorkingDirs,
} from '../core/uninstall.js';
import { fileExists } from '../utils/file-system.js';
import { detectInstalledSmartTargets } from './update.js';

interface UninstallOptions {
  json?: boolean;
  scope?: InstallScope;
  force?: boolean;
}

interface TargetUninstallResult {
  scope: InstallScope;
  platform: string;
  platformName: string;
  skillsRemoved: number;
  rulesRemoved: number;
  hooksRemoved: number;
  workingDirsRemoved: number;
}

export async function uninstallCommand(
  targetPath: string,
  options: UninstallOptions = {},
): Promise<void> {
  const projectPath = path.resolve(targetPath);
  const log = options.json ? () => undefined : console.log;

  log('\n  Smart Uninstall\n');

  const targets = await detectInstalledSmartTargets(projectPath, {
    scopes: options.scope ? [options.scope] : undefined,
  });
  const hasProjectConfig = await fileExists(path.join(projectPath, '.smart'));
  if (targets.length === 0 && !hasProjectConfig) {
    if (options.json) {
      console.log(JSON.stringify({ targets: [], results: [] }, null, 2));
      return;
    }
    log('  No Smart installations found. Nothing to uninstall.\n');
    return;
  }

  const scopeLabel = (scope: InstallScope) =>
    scope === 'global' ? 'global' : `project (${projectPath})`;
  if (targets.length > 0) log('  Found Smart installations on the following targets:\n');
  for (const target of targets) {
    const skillsDir = getPlatformSkillsDir(target.platform, target.scope);
    const prefix = target.scope === 'global' ? '~/' : '';
    log(`    ${target.platform.name} (${scopeLabel(target.scope)})`);
    log(`      Path: ${prefix}${skillsDir}/skills/`);
  }

  let selectedTargets = targets;
  if (!options.force && !options.json) {
    if (targets.length === 1) {
      const confirmed = await select({
        message: `Uninstall Smart from ${targets[0].platform.name} (${targets[0].scope})?`,
        choices: [
          { name: 'Yes, uninstall', value: true },
          { name: 'No, cancel', value: false },
        ],
      });
      if (!confirmed) {
        log('\n  Cancelled.\n');
        return;
      }
    } else if (targets.length > 1) {
      const selected = await checkbox({
        message: 'Select targets to uninstall:',
        choices: targets.map((t) => ({
          name: `${t.platform.name} (${t.scope})`,
          value: `${t.platform.id}:${t.scope}`,
          checked: true,
        })),
        required: true,
      });
      selectedTargets = targets.filter((t) => selected.includes(`${t.platform.id}:${t.scope}`));
      if (selectedTargets.length === 0) {
        log('\n  No targets selected. Cancelled.\n');
        return;
      }
    }
  }

  log('');
  const results: TargetUninstallResult[] = [];
  let totalSkills = 0;
  let totalRules = 0;
  let totalHooks = 0;

  for (const target of selectedTargets) {
    const baseDir = getBaseDir(projectPath, target.scope);
    const skillsRemoved = await removeSmartSkillsForPlatform(
      target.platform,
      baseDir,
      target.scope,
    );
    totalSkills += skillsRemoved;
    const rulesRemoved = await removeSmartRules(target.platform, baseDir, target.scope);
    totalRules += rulesRemoved;
    let hooksRemoved = 0;
    if (target.platform.supportsHooks) {
      hooksRemoved = await removeSmartHooks(target.platform, baseDir, target.scope);
      totalHooks += hooksRemoved;
    }
    await pruneEmptyPlatformDir(target.platform, baseDir, target.scope);
    log(
      `  ${target.platform.name} (${target.scope}): ${skillsRemoved} skills, ${rulesRemoved} rules, ${hooksRemoved} hooks removed`,
    );
    results.push({
      scope: target.scope,
      platform: target.platform.id,
      platformName: target.platform.name,
      skillsRemoved,
      rulesRemoved,
      hooksRemoved,
      workingDirsRemoved: 0,
    });
  }

  let workingDirsRemoved = 0;
  const hasProjectScope =
    hasProjectConfig &&
    (options.scope !== 'global' || selectedTargets.some((target) => target.scope === 'project'));
  if (hasProjectScope) {
    workingDirsRemoved = await removeSmartWorkingDirs(projectPath);
    if (workingDirsRemoved > 0) log('  Smart project configuration removed');
  }

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          targets: results.map((r) => ({
            scope: r.scope,
            platform: r.platform,
            platformName: r.platformName,
            skillsRemoved: r.skillsRemoved,
            rulesRemoved: r.rulesRemoved,
            hooksRemoved: r.hooksRemoved,
          })),
          workingDirsRemoved,
          integrationsPreserved: true,
          summary: {
            targetsProcessed: results.length,
            totalSkillsRemoved: totalSkills,
            totalRulesRemoved: totalRules,
            totalHooksRemoved: totalHooks,
          },
        },
        null,
        2,
      ),
    );
    return;
  }

  log(`\n  Summary:`);
  log(`    Targets: ${results.length}`);
  log(`    Skills removed: ${totalSkills}`);
  log(`    Rules removed: ${totalRules}`);
  log(`    Hooks removed: ${totalHooks}`);
  log('    Third-party integrations: preserved');
  log(`\n  Uninstall complete.\n`);
}
