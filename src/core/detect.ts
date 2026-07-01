import { execSync } from 'child_process';
import path from 'path';
import { fileExists, readDir } from '../utils/file-system.js';
import { getPlatformSkillsDir, getPlatformSkillsDirs, type Platform, PLATFORMS } from './platforms.js';

export async function detectPlatforms(dir: string): Promise<Platform[]> {
  const detected: Platform[] = [];

  for (const platform of PLATFORMS) {
    const dirs = getPlatformSkillsDirs(platform, 'project');

    let found = false;
    for (const d of dirs) {
      if (!d) continue;
      if (await fileExists(path.join(dir, d))) {
        found = true;
        break;
      }
    }

    if (found) detected.push(platform);
  }

  return detected;
}

export async function detectGlobalPlatforms(): Promise<Platform[]> {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  if (!home) return [];

  const detected: Platform[] = [];

  for (const platform of PLATFORMS) {
    const globalDir = platform.globalSkillsDir;
    if (!globalDir) continue;
    if (await fileExists(path.join(home, globalDir))) {
      detected.push(platform);
    }
  }

  return detected;
}

export async function checkInstalledSkills(
  platform: Platform,
  dir: string
): Promise<{ openspec: boolean; superpowers: boolean; smart: boolean }> {
  const result = { openspec: false, superpowers: false, smart: false };

  const skillsDir = getPlatformSkillsDir(platform, 'project');
  if (!skillsDir) return result;

  const entries = await readDir(path.join(dir, skillsDir));
  for (const entry of entries) {
    const lower = entry.toLowerCase();
    if (lower.includes('openspec')) result.openspec = true;
    if (lower.includes('superpowers')) result.superpowers = true;
    if (lower.includes('smart')) result.smart = true;
  }

  return result;
}

export async function checkSuperpowersInHostPluginCaches(platform: Platform, dir: string): Promise<boolean> {
  const skillsDir = getPlatformSkillsDir(platform, 'project');
  const pluginsDir = path.join(dir, skillsDir, 'plugins');

  const entries = await readDir(pluginsDir);
  for (const entry of entries) {
    if (entry.toLowerCase().includes('superpowers')) return true;
  }

  return false;
}

export function hasOpenCodeSmartCommands(): boolean {
  try {
    const out = execSync('smart --help 2>nul || smart -h 2>nul', { encoding: 'utf-8', timeout: 5000 });
    return out.length > 0;
  } catch {
    return false;
  }
}

export async function hasSkills(platform: Platform, dir: string): Promise<boolean> {
  const result = await checkInstalledSkills(platform, dir);
  return result.smart;
}

export type InstallScope = 'project' | 'global';

export function getBaseDir(dir: string, scope: InstallScope): string {
  if (scope === 'global') {
    return process.env.HOME || process.env.USERPROFILE || process.cwd();
  }
  return dir;
}
