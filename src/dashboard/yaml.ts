import { promises as fs } from 'fs';
import type { SmartYaml } from './types.js';
import { resolveSmartYamlPath } from '../core/smart-paths.js';

export async function readSmartYaml(projectPath: string, changeName: string): Promise<SmartYaml | null> {
  const yamlPath = await resolveSmartYamlPath(projectPath, changeName);
  if (!yamlPath) {
    return null;
  }
  const content = await fs.readFile(yamlPath, 'utf-8');
  return parseYaml(content);
}

export function parseYaml(content: string): SmartYaml {
  const result: SmartYaml = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes(':')) {
      continue;
    }
    const sepIndex = trimmed.indexOf(':');
    const key = trimmed.slice(0, sepIndex).trim();
    const value = trimmed.slice(sepIndex + 1).trim();
    setNestedValue(result as Record<string, unknown>, key, parseValue(value));
  }
  return result;
}

function parseValue(value: string): unknown {
  if (value === 'null' || value === '~') return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  const num = Number(value);
  if (!isNaN(num) && value !== '' && value !== '') return num;
  return value;
}

function setNestedValue(obj: Record<string, unknown>, key: string, value: unknown): void {
  if (key.includes('.')) {
    const parts = key.split('.');
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part] || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }
    current[parts[parts.length - 1]] = value;
  } else {
    obj[key] = value;
  }
}
