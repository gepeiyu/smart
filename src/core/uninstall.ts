import path from 'path';
import { removeDir, removeFile, readDir, fileExists, isDirEmpty } from '../utils/file-system.js';
import type { Platform } from './platforms.js';
import { getPlatformSkillsDir } from './platforms.js';

async function removeSmartSkillsForPlatform(platform: Platform, baseDir: string): Promise<boolean> {
  const skillsDir = getPlatformSkillsDir(platform, 'project');
  const smartSkillDir = path.join(baseDir, skillsDir, 'smart');

  if (await fileExists(smartSkillDir)) {
    await removeDir(smartSkillDir);
    return true;
  }
  return false;
}

async function removeSmartRules(platform: Platform, baseDir: string): Promise<boolean> {
  const rulesDir = platform.rulesDir;
  if (!rulesDir) return false;

  const skillsDir = getPlatformSkillsDir(platform, 'project');
  const smartRulesDir = path.join(baseDir, skillsDir, rulesDir, 'smart');

  if (await fileExists(smartRulesDir)) {
    await removeDir(smartRulesDir);
    return true;
  }
  return false;
}

async function removeSmartHooks(platform: Platform, baseDir: string): Promise<boolean> {
  if (!platform.supportsHooks) return false;

  const skillsDir = getPlatformSkillsDir(platform, 'project');
  const hooksDir = path.join(baseDir, skillsDir, 'hooks');

  if (await fileExists(hooksDir)) {
    const entries = await readDir(hooksDir);
    for (const entry of entries) {
      if (entry.startsWith('smart-')) {
        await removeFile(path.join(hooksDir, entry));
      }
    }
    const empty = await isDirEmpty(hooksDir);
    if (empty) {
      await removeDir(hooksDir);
    }
    return true;
  }
  return false;
}

async function removeSmartWorkingDirs(baseDir: string): Promise<void> {
  const dirs = [
    '.smart',
    'docs/superpowers',
    'docs/design',
  ];

  for (const dir of dirs) {
    const fullPath = path.join(baseDir, dir);
    if (await fileExists(fullPath)) {
      await removeDir(fullPath);
    }
  }
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

async function uninstallAll(baseDir: string, platforms: Platform[]): Promise<void> {
  for (const platform of platforms) {
    await removeSmartSkillsForPlatform(platform, baseDir);
    await removeSmartRules(platform, baseDir);
    await removeSmartHooks(platform, baseDir);
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
  removeOpenCodeCommands,
  removePiExtension,
  removeSmartManifests,
  uninstallAll,
};
