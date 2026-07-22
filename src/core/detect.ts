import { execSync } from 'child_process';
import path from 'path';
import { fileExists, readDir } from '../utils/file-system.js';
import {
  getPlatformSkillsDir,
  getPlatformSkillsDirs,
  type Platform,
  PLATFORMS,
} from './platforms.js';

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

export async function hasSmartSkills(
  platform: Platform,
  dir: string,
  scope: InstallScope = 'project',
): Promise<boolean> {
  const skillsDir = getPlatformSkillsDir(platform, scope);
  if (!skillsDir) return false;

  const entries = await readDir(path.join(dir, skillsDir, 'skills'));
  return entries.some((entry) => entry.toLowerCase().includes('smart'));
}

export function hasOpenCodeSmartCommands(): boolean {
  try {
    const out = execSync('smart --help 2>nul || smart -h 2>nul', {
      encoding: 'utf-8',
      timeout: 5000,
    });
    return out.length > 0;
  } catch {
    return false;
  }
}

export type InstallScope = 'project' | 'global';

export function getBaseDir(dir: string, scope: InstallScope): string {
  if (scope === 'global') {
    return process.env.HOME || process.env.USERPROFILE || process.cwd();
  }
  return dir;
}
