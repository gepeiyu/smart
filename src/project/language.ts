import fs from 'fs/promises';
import path from 'path';
import YAML from 'yaml';
import type { ProjectLanguage } from './types.js';

export function parseProjectLanguage(value: unknown): ProjectLanguage | null {
  return value === 'en' || value === 'zh' ? value : null;
}

export function requireProjectLanguage(value: unknown): ProjectLanguage | undefined {
  if (value === undefined) return undefined;
  const language = parseProjectLanguage(value);
  if (!language) throw new Error('Language must be en or zh');
  return language;
}

export async function readConfiguredProjectLanguage(projectPath: string): Promise<ProjectLanguage> {
  try {
    const parsed = YAML.parse(
      await fs.readFile(path.join(projectPath, '.smart', 'config.yaml'), 'utf-8'),
    ) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return 'en';
    return parseProjectLanguage((parsed as Record<string, unknown>).smart_language) ?? 'en';
  } catch {
    return 'en';
  }
}

export function localize(language: ProjectLanguage, en: string, zh: string): string {
  return language === 'zh' ? zh : en;
}
