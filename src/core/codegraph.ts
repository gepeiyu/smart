import { execFileSync, execSync } from 'child_process';
import path from 'path';
import { fileExists, readDir } from '../utils/file-system.js';

export async function hasCodegraphProjectIndex(projectDir: string): Promise<boolean> {
  const codegraphDir = path.join(projectDir, '.codegraph');
  if (!(await fileExists(codegraphDir))) return false;
  const entries = await readDir(codegraphDir);
  return entries.length > 0;
}

export function resolveCodegraphCommand(): string {
  const candidates = ['codegraph', 'npx codegraph'];
  for (const cmd of candidates) {
    try {
      const [base, ...args] = cmd.split(' ');
      execFileSync(base, [...args, '--version'], { encoding: 'utf-8', stdio: 'pipe', timeout: 5000 });
      return cmd;
    } catch { /* cmd not available */ }
  }
  return '';
}

export function installCodegraph(scope: 'global' | 'project', cwd?: string): void {
  if (scope === 'global') {
    const globalCmd = resolvePnpmGlobalCommand();
    if (globalCmd) {
      execSync(`${globalCmd} add -g @codegraph/cli`, { stdio: 'inherit', timeout: 120000 });
    } else {
      execSync('npm install -g @codegraph/cli', { stdio: 'inherit', timeout: 120000 });
    }
  } else if (cwd) {
    execSync('npm install @codegraph/cli', { cwd, stdio: 'inherit', timeout: 120000 });
  }
}

export function resolvePnpmGlobalCommand(): string {
  try {
    execFileSync('pnpm', ['--version'], { encoding: 'utf-8', stdio: 'pipe', timeout: 5000 });
    return 'pnpm';
  } catch {
    return '';
  }
}
