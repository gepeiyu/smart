import { execFileSync, execSync } from 'child_process';
import path from 'path';
import { fileExists, readDir } from '../utils/file-system.js';

export async function hasCodegraphProjectIndex(projectDir: string): Promise<boolean> {
  const codegraphDir = path.join(projectDir, '.codegraph');
  if (!(await fileExists(codegraphDir))) return false;
  const entries = await readDir(codegraphDir);
  return entries.length > 0;
}

function getLocalBinPath(projectPath: string, command: string): string {
  return path.join(
    projectPath,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? `${command}.cmd` : command,
  );
}

function canRunCommand(command: string, args: string[] = ['--version']): boolean {
  try {
    execFileSync(command, args, { encoding: 'utf-8', stdio: 'pipe', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

export function resolveCodegraphCommand(
  projectPath?: string,
): { command: string; location: 'local' | 'global' | 'npx' } | null {
  if (projectPath) {
    const localCommand = getLocalBinPath(projectPath, 'codegraph');
    if (canRunCommand(localCommand)) return { command: localCommand, location: 'local' };
  }
  if (canRunCommand('codegraph')) return { command: 'codegraph', location: 'global' };
  if (canRunCommand('npx', ['codegraph', '--version']))
    return { command: 'npx codegraph', location: 'npx' };
  return null;
}

export function installCodegraph(scope: 'global' | 'project', cwd?: string): boolean {
  try {
    if (scope === 'global') {
      const globalCmd = resolvePnpmGlobalCommand();
      if (globalCmd) {
        execSync(`${globalCmd} add -g @colbymchenry/codegraph`, {
          stdio: 'inherit',
          timeout: 120000,
        });
      } else {
        execSync('npm install -g @colbymchenry/codegraph', { stdio: 'inherit', timeout: 120000 });
      }
    } else if (cwd) {
      execSync('npm install @colbymchenry/codegraph', { cwd, stdio: 'inherit', timeout: 120000 });
    }
    return resolveCodegraphCommand(cwd) !== null;
  } catch {
    return false;
  }
}

export function initializeCodegraph(projectPath: string): boolean {
  const resolved = resolveCodegraphCommand(projectPath);
  if (!resolved) return false;
  const command = resolved.location === 'npx' ? 'npx' : resolved.command;
  const args = resolved.location === 'npx' ? ['codegraph', 'init', '-i'] : ['init', '-i'];
  try {
    execFileSync(command, args, {
      cwd: projectPath,
      stdio: 'inherit',
      timeout: 120_000,
      shell: process.platform === 'win32',
    });
    return true;
  } catch {
    return false;
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
