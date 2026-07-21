import { promises as fs } from 'fs';
import YAML from 'yaml';
import type { SmartYaml } from './types.js';
import { resolveSmartYamlPath } from '../core/smart-paths.js';

export async function readSmartYaml(
  projectPath: string,
  changeName: string,
): Promise<SmartYaml | null> {
  const yamlPath = await resolveSmartYamlPath(projectPath, changeName);
  if (!yamlPath) {
    return null;
  }
  const content = await fs.readFile(yamlPath, 'utf-8');
  return parseYaml(content);
}

export function parseYaml(content: string): SmartYaml {
  const value = YAML.parse(content) as unknown;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as SmartYaml;
}
