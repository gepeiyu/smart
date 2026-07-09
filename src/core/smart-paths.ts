import path from 'path';
import { fileExists } from '../utils/file-system.js';

export function smartdocsDir(projectPath: string): string {
  return path.join(projectPath, 'smartdocs');
}

export function smartdocsChangesDir(projectPath: string): string {
  return path.join(smartdocsDir(projectPath), 'changes');
}

export function smartChangeDir(projectPath: string, changeName: string): string {
  return path.join(smartdocsChangesDir(projectPath), changeName);
}

export function smartYamlPath(projectPath: string, changeName: string): string {
  return path.join(smartChangeDir(projectPath, changeName), '.smart.yaml');
}

export function openSpecChangesDir(projectPath: string): string {
  return path.join(projectPath, 'openspec', 'changes');
}

export function openSpecChangeDir(projectPath: string, changeName: string): string {
  return path.join(openSpecChangesDir(projectPath), changeName);
}

export async function resolveSmartYamlPath(projectPath: string, changeName: string): Promise<string | null> {
  const current = smartYamlPath(projectPath, changeName);
  if (await fileExists(current)) return current;

  return null;
}
