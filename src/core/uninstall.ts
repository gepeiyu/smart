import path from 'path';
import { removeDir, removeFile, readDir, fileExists, isDirEmpty, readJson, writeFile } from '../utils/file-system.js';
import type { Platform } from './platforms.js';
import { getPlatformSkillsDir } from './platforms.js';
import { computeRuleDestPath, isManagedHookCommand, readManifest } from './skills.js';
import type { InstallScope } from './types.js';

const SMART_PROJECT_PACKAGES = ['@fission-ai/openspec', '@colbymchenry/codegraph'];

interface AssociatedProjectRemovalResult {
  openspecSkills: number;
  openspecCommands: number;
  codegraph: number;
  superpowers: number;
  smartConfig: number;
  packages: number;
}

function getPlatformBase(platform: Platform, baseDir: string, scope: InstallScope = 'project'): string {
  return path.join(baseDir, getPlatformSkillsDir(platform, scope));
}

async function removeDirIfEmpty(dirPath: string): Promise<boolean> {
  if (!(await fileExists(dirPath))) return false;
  if (!(await isDirEmpty(dirPath))) return false;
  await removeDir(dirPath);
  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

async function getSmartSkillDirs(): Promise<string[]> {
  const manifest = await readManifest();
  return [...new Set(manifest.skills.map((skillPath) => skillPath.split('/')[0]).filter(Boolean))];
}

async function removeSmartSkillsForPlatform(platform: Platform, baseDir: string, scope: InstallScope = 'project'): Promise<number> {
  const skillsRoot = path.join(getPlatformBase(platform, baseDir, scope), 'skills');
  let removed = 0;

  for (const skillDir of await getSmartSkillDirs()) {
    const target = path.join(skillsRoot, skillDir);
    if (await fileExists(target)) {
      await removeDir(target);
      removed++;
    }
  }

  await removeDirIfEmpty(skillsRoot);
  return removed;
}

async function removeSmartRules(platform: Platform, baseDir: string, scope: InstallScope = 'project'): Promise<number> {
  const rulesDir = platform.rulesDir;
  if (!rulesDir || !platform.rulesFormat) return 0;

  const manifest = await readManifest();
  if (!manifest.rules || manifest.rules.length === 0) return 0;

  const rulesBase = platform.rulesBaseDir !== undefined
    ? platform.rulesBaseDir === '' ? baseDir : path.join(baseDir, platform.rulesBaseDir)
    : getPlatformBase(platform, baseDir, scope);
  const rulesRoot = path.join(rulesBase, rulesDir);
  let removed = 0;

  for (const ruleRelPath of manifest.rules) {
    const ruleFileName = path.basename(ruleRelPath);
    const target = computeRuleDestPath(rulesRoot, ruleFileName, platform.rulesFormat);
    if (await fileExists(target)) {
      await removeFile(target);
      removed++;
    }
  }

  await removeDirIfEmpty(rulesRoot);
  return removed;
}

function cleanHookGroups(groups: unknown, scriptRelPaths: string[]): { groups: Array<Record<string, unknown>>; removed: number } {
  if (!Array.isArray(groups)) return { groups: [], removed: 0 };

  let removed = 0;
  const cleaned = groups.flatMap((group) => {
    if (!isRecord(group) || !Array.isArray(group.hooks)) return [group as Record<string, unknown>];
    const hooks = group.hooks.filter((hook) => {
      const command = isRecord(hook) ? hook.command : undefined;
      const managed = isManagedHookCommand(command, scriptRelPaths);
      if (managed) removed++;
      return !managed;
    });
    if (hooks.length === 0 && group.hooks.length > 0) return [];
    return [{ ...group, hooks }];
  });

  return { groups: cleaned, removed };
}

function cleanFlatHooks(entries: unknown, scriptRelPaths: string[]): { entries: unknown[]; removed: number } {
  if (!Array.isArray(entries)) return { entries: [], removed: 0 };

  let removed = 0;
  const cleaned = entries.filter((entry) => {
    const command = isRecord(entry) ? entry.command : undefined;
    const managed = isManagedHookCommand(command, scriptRelPaths);
    if (managed) removed++;
    return !managed;
  });

  return { entries: cleaned, removed };
}

function removeEmptyHookContainers(settings: Record<string, unknown>): boolean {
  if (isRecord(settings.hooks) && Object.keys(settings.hooks).length === 0) {
    delete settings.hooks;
  }
  return Object.keys(settings).length === 0;
}

async function writeOrRemoveJson(filePath: string, settings: Record<string, unknown>): Promise<void> {
  if (removeEmptyHookContainers(settings)) await removeFile(filePath);
  else await writeFile(filePath, `${JSON.stringify(settings, null, 2)}\n`);
}

async function removeGroupedHooksFromSettings(settingsPath: string, hookKey: string, scriptRelPaths: string[]): Promise<number> {
  if (!(await fileExists(settingsPath))) return 0;

  let settings: Record<string, unknown>;
  try { settings = await readJson<Record<string, unknown>>(settingsPath); }
  catch { return 0; }
  if (!isRecord(settings.hooks)) return 0;

  const { groups, removed } = cleanHookGroups(settings.hooks[hookKey], scriptRelPaths);
  if (removed === 0) return 0;

  if (groups.length === 0) delete settings.hooks[hookKey];
  else settings.hooks[hookKey] = groups;
  await writeOrRemoveJson(settingsPath, settings);
  return removed;
}

async function removeFlatHooksFromSettings(settingsPath: string, hookKey: string, scriptRelPaths: string[]): Promise<number> {
  if (!(await fileExists(settingsPath))) return 0;

  let settings: Record<string, unknown>;
  try { settings = await readJson<Record<string, unknown>>(settingsPath); }
  catch { return 0; }
  if (!isRecord(settings.hooks)) return 0;

  const { entries, removed } = cleanFlatHooks(settings.hooks[hookKey], scriptRelPaths);
  if (removed === 0) return 0;

  if (entries.length === 0) delete settings.hooks[hookKey];
  else settings.hooks[hookKey] = entries;
  await writeOrRemoveJson(settingsPath, settings);
  return removed;
}

async function removeSmartHookFiles(platformBase: string): Promise<number> {
  const hooksDir = path.join(platformBase, 'hooks');
  if (!(await fileExists(hooksDir))) return 0;

  let removed = 0;
  const entries = await readDir(hooksDir);
  for (const entry of entries) {
    if (entry.startsWith('smart-')) {
      await removeFile(path.join(hooksDir, entry));
      removed++;
    }
  }

  await removeDirIfEmpty(hooksDir);
  return removed;
}

async function removeSmartHooks(platform: Platform, baseDir: string, scope: InstallScope = 'project'): Promise<number> {
  if (!platform.supportsHooks || !platform.hookFormat) return 0;

  const manifest = await readManifest();
  const scriptRelPaths = Object.keys(manifest.hooks ?? {});
  if (scriptRelPaths.length === 0) return 0;

  const platformBase = getPlatformBase(platform, baseDir, scope);
  switch (platform.hookFormat) {
    case 'claude-code':
      return removeGroupedHooksFromSettings(path.join(platformBase, 'settings.local.json'), 'PreToolUse', scriptRelPaths);
    case 'qwen':
    case 'qoder':
      return removeGroupedHooksFromSettings(path.join(platformBase, 'settings.json'), 'PreToolUse', scriptRelPaths);
    case 'gemini':
      return removeGroupedHooksFromSettings(path.join(platformBase, 'settings.json'), 'BeforeTool', scriptRelPaths);
    case 'windsurf':
      return removeFlatHooksFromSettings(path.join(platformBase, 'hooks.json'), 'pre_write_code', scriptRelPaths);
    case 'copilot':
    case 'kiro':
      return removeSmartHookFiles(platformBase);
    default:
      return 0;
  }
}

async function removeSmartWorkingDirs(baseDir: string): Promise<number> {
  const dirs = [
    '.smart',
  ];
  let removed = 0;

  for (const dir of dirs) {
    const fullPath = path.join(baseDir, dir);
    if (await fileExists(fullPath)) {
      await removeDir(fullPath);
      removed++;
    }
  }

  return removed;
}

async function removeOpenSpecSkillsForPlatform(platform: Platform, baseDir: string): Promise<number> {
  const skillsRoot = path.join(getPlatformBase(platform, baseDir, 'project'), 'skills');
  if (!(await fileExists(skillsRoot))) return 0;

  let removed = 0;
  for (const entry of await readDir(skillsRoot)) {
    if (entry.startsWith('openspec-')) {
      await removeDir(path.join(skillsRoot, entry));
      removed++;
    }
  }

  await removeDirIfEmpty(skillsRoot);
  return removed;
}

async function removeOpenSpecCommandsForPlatform(platform: Platform, baseDir: string): Promise<number> {
  const commandsRoot = path.join(getPlatformBase(platform, baseDir, 'project'), 'commands');
  if (!(await fileExists(commandsRoot))) return 0;

  let removed = 0;
  const opsxDir = path.join(commandsRoot, 'opsx');
  if (await fileExists(opsxDir)) {
    await removeDir(opsxDir);
    removed++;
  }

  for (const entry of await readDir(commandsRoot)) {
    if ((entry.startsWith('opsx-') || entry.startsWith('openspec-')) && entry.endsWith('.md')) {
      await removeFile(path.join(commandsRoot, entry));
      removed++;
    }
  }

  await removeDirIfEmpty(commandsRoot);
  return removed;
}

async function removeCodegraphForPlatform(platform: Platform, baseDir: string): Promise<number> {
  const rulesDir = platform.rulesDir;
  if (!rulesDir) return 0;

  const rulesBase = platform.rulesBaseDir !== undefined
    ? platform.rulesBaseDir === '' ? baseDir : path.join(baseDir, platform.rulesBaseDir)
    : getPlatformBase(platform, baseDir, 'project');
  const rulesRoot = path.join(rulesBase, rulesDir);
  if (!(await fileExists(rulesRoot))) return 0;

  let removed = 0;
  for (const entry of await readDir(rulesRoot)) {
    if (entry === 'codegraph.md' || entry === 'codegraph.mdc' || entry === 'codegraph.instructions.md') {
      await removeFile(path.join(rulesRoot, entry));
      removed++;
    }
  }

  await removeDirIfEmpty(rulesRoot);
  return removed;
}

function isSuperpowersLockEntry(entry: unknown): boolean {
  return isRecord(entry) && entry.source === 'obra/superpowers';
}

async function removeSuperpowersProjectInstall(baseDir: string): Promise<number> {
  const lockPath = path.join(baseDir, 'skills-lock.json');
  if (!(await fileExists(lockPath))) return 0;

  let lock: Record<string, unknown>;
  try { lock = await readJson<Record<string, unknown>>(lockPath); }
  catch { return 0; }
  if (!isRecord(lock.skills)) return 0;

  let removed = 0;
  for (const [skillName, entry] of Object.entries(lock.skills)) {
    if (!isSuperpowersLockEntry(entry)) continue;
    await removeDir(path.join(baseDir, '.agents', 'skills', skillName));
    delete lock.skills[skillName];
    removed++;
  }

  if (removed === 0) return 0;

  if (Object.keys(lock.skills).length === 0) await removeFile(lockPath);
  else await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`);

  await removeDirIfEmpty(path.join(baseDir, '.agents', 'skills'));
  await removeDirIfEmpty(path.join(baseDir, '.agents'));
  return removed;
}

function removePackageFromSection(pkg: Record<string, unknown>, section: string, packageNames: string[]): number {
  const deps = pkg[section];
  if (!isRecord(deps)) return 0;

  let removed = 0;
  for (const packageName of packageNames) {
    if (Object.prototype.hasOwnProperty.call(deps, packageName)) {
      delete deps[packageName];
      removed++;
    }
  }
  if (Object.keys(deps).length === 0) delete pkg[section];
  return removed;
}

async function removeProjectPackageReferences(baseDir: string, packageNames = SMART_PROJECT_PACKAGES): Promise<number> {
  let removed = 0;
  const packageJsonPath = path.join(baseDir, 'package.json');
  if (await fileExists(packageJsonPath)) {
    const pkg = await readJson<Record<string, unknown>>(packageJsonPath);
    removed += removePackageFromSection(pkg, 'dependencies', packageNames);
    removed += removePackageFromSection(pkg, 'devDependencies', packageNames);
    removed += removePackageFromSection(pkg, 'optionalDependencies', packageNames);
    removed += removePackageFromSection(pkg, 'peerDependencies', packageNames);
    if (removed > 0) await writeFile(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);
  }

  const packageLockPath = path.join(baseDir, 'package-lock.json');
  if (await fileExists(packageLockPath)) {
    const lock = await readJson<Record<string, unknown>>(packageLockPath);
    let changed = false;
    if (isRecord(lock.packages)) {
      for (const packageName of packageNames) {
        const packagePath = `node_modules/${packageName}`;
        if (Object.prototype.hasOwnProperty.call(lock.packages, packagePath)) {
          delete lock.packages[packagePath];
          changed = true;
        }
      }
      if (isRecord(lock.packages[''])) {
        for (const section of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
          changed = removePackageFromSection(lock.packages[''], section, packageNames) > 0 || changed;
        }
      }
    }
    if (isRecord(lock.dependencies)) {
      for (const packageName of packageNames) {
        if (Object.prototype.hasOwnProperty.call(lock.dependencies, packageName)) {
          delete lock.dependencies[packageName];
          changed = true;
        }
      }
    }
    if (changed) await writeFile(packageLockPath, `${JSON.stringify(lock, null, 2)}\n`);
  }

  for (const packageName of packageNames) {
    const packageDir = path.join(baseDir, 'node_modules', ...packageName.split('/'));
    if (await fileExists(packageDir)) await removeDir(packageDir);
    if (packageName.startsWith('@')) {
      await removeDirIfEmpty(path.join(baseDir, 'node_modules', packageName.split('/')[0]));
    }
  }

  return removed;
}

async function removeAssociatedProjectInstalls(baseDir: string, platforms: Platform[]): Promise<AssociatedProjectRemovalResult> {
  const result: AssociatedProjectRemovalResult = {
    openspecSkills: 0,
    openspecCommands: 0,
    codegraph: 0,
    superpowers: 0,
    smartConfig: 0,
    packages: 0,
  };

  for (const platform of platforms) {
    result.openspecSkills += await removeOpenSpecSkillsForPlatform(platform, baseDir);
    result.openspecCommands += await removeOpenSpecCommandsForPlatform(platform, baseDir);
    result.codegraph += await removeCodegraphForPlatform(platform, baseDir);
    await pruneEmptyPlatformDir(platform, baseDir, 'project');
  }

  const codegraphDir = path.join(baseDir, '.codegraph');
  if (await fileExists(codegraphDir)) {
    await removeDir(codegraphDir);
    result.codegraph++;
  }

  result.superpowers = await removeSuperpowersProjectInstall(baseDir);
  result.smartConfig = await removeSmartWorkingDirs(baseDir);
  result.packages = await removeProjectPackageReferences(baseDir);

  return result;
}

async function removeOpenCodeCommands(baseDir: string): Promise<boolean> {
  const smartCommandsDir = path.join(baseDir, '.opencode', 'smart');
  if (await fileExists(smartCommandsDir)) {
    await removeDir(smartCommandsDir);
    return true;
  }
  return false;
}

async function removePiExtension(baseDir: string): Promise<boolean> {
  const piExtension = path.join(baseDir, '.pi', 'extensions', 'smart.yaml');
  if (await fileExists(piExtension)) {
    await removeFile(piExtension);
    return true;
  }
  return false;
}

async function removeSmartManifests(baseDir: string): Promise<void> {
  const skillsDirs = ['.opencode', '.pi', '.smart'];
  for (const skillsDir of skillsDirs) {
    const manifestPath = path.join(baseDir, skillsDir, 'smart-manifest.json');
    if (await fileExists(manifestPath)) {
      await removeFile(manifestPath);
    }
  }
}

async function pruneEmptyPlatformDir(platform: Platform, baseDir: string, scope: InstallScope = 'project'): Promise<boolean> {
  const platformBase = getPlatformBase(platform, baseDir, scope);
  for (const childDir of ['skills', 'rules', 'hooks', 'commands', 'extensions']) {
    await removeDirIfEmpty(path.join(platformBase, childDir));
  }
  return removeDirIfEmpty(platformBase);
}

async function uninstallAll(baseDir: string, platforms: Platform[]): Promise<void> {
  for (const platform of platforms) {
    await removeSmartSkillsForPlatform(platform, baseDir);
    await removeSmartRules(platform, baseDir);
    await removeSmartHooks(platform, baseDir);
    await pruneEmptyPlatformDir(platform, baseDir);
  }

  await removeSmartWorkingDirs(baseDir);
  await removeOpenCodeCommands(baseDir);
  await removePiExtension(baseDir);
  await removeSmartManifests(baseDir);
}

export {
  removeSmartSkillsForPlatform,
  removeSmartRules,
  removeSmartHooks,
  removeSmartWorkingDirs,
  removeAssociatedProjectInstalls,
  removeProjectPackageReferences,
  pruneEmptyPlatformDir,
  removeOpenCodeCommands,
  removePiExtension,
  removeSmartManifests,
  uninstallAll,
};
