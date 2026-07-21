import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { printCommandErrorDetails } from './command-error.js';
import { PLATFORMS } from './platforms.js';
import type { InstallScope } from './types.js';

const ALL_OPENSPEC_WORKFLOWS = [
  'propose',
  'explore',
  'new',
  'continue',
  'apply',
  'ff',
  'sync',
  'archive',
  'bulk-archive',
  'verify',
  'onboard',
] as const;

function getNpmExecutable(platform: NodeJS.Platform = process.platform): string {
  return platform === 'win32' ? 'npm.cmd' : 'npm';
}

function buildOpenSpecInitInvocation(
  projectPath: string,
  toolIds: string[],
  scope: InstallScope,
  homeDir = os.homedir(),
  includeProfileFlag = true,
  command = 'openspec',
): { command: string; args: string[] } {
  const targetPath = scope === 'global' ? homeDir : projectPath;
  const args = ['init', targetPath, '--tools', toolIds.join(',')];
  if (includeProfileFlag) args.push('--profile', 'custom');
  return { command, args };
}

const ALL_WORKFLOWS_CONFIG =
  JSON.stringify(
    {
      featureFlags: {},
      profile: 'custom',
      delivery: 'both',
      workflows: [...ALL_OPENSPEC_WORKFLOWS],
    },
    null,
    2,
  ) + '\n';

function getOpenSpecDefaultConfigDir(): string {
  const platform = os.platform();
  if (platform === 'win32') {
    const appData = process.env.APPDATA;
    if (appData) return path.join(appData, 'openspec');
    return path.join(os.homedir(), 'AppData', 'Roaming', 'openspec');
  }
  const xdgConfig = process.env.XDG_CONFIG_HOME;
  if (xdgConfig) return path.join(xdgConfig, 'openspec');
  return path.join(os.homedir(), '.config', 'openspec');
}

function getOpenSpecDefaultConfigPath(): string {
  return path.join(getOpenSpecDefaultConfigDir(), 'config.json');
}

function createOpenSpecAllWorkflowsEnv(): { env: NodeJS.ProcessEnv; configHome: string } {
  const configHome = fs.mkdtempSync(path.join(os.tmpdir(), 'smart-openspec-profile-'));
  try {
    const openspecConfigDir = path.join(configHome, 'openspec');
    fs.mkdirSync(openspecConfigDir, { recursive: true });
    fs.writeFileSync(path.join(openspecConfigDir, 'config.json'), ALL_WORKFLOWS_CONFIG, 'utf-8');
    return { configHome, env: { ...process.env, XDG_CONFIG_HOME: configHome } };
  } catch (error) {
    fs.rmSync(configHome, { recursive: true, force: true });
    throw error;
  }
}

interface ConfigBackup {
  configPath: string;
  backupPath: string;
  hadExisting: boolean;
}

function writeAllWorkflowsToDefaultConfig(): ConfigBackup | null {
  const configPath = getOpenSpecDefaultConfigPath();
  const backupPath = configPath + '.smart-backup';
  let hadExisting = false;
  try {
    hadExisting = fs.existsSync(configPath);
    if (hadExisting) fs.copyFileSync(configPath, backupPath);
    const configDir = path.dirname(configPath);
    if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(configPath, ALL_WORKFLOWS_CONFIG, 'utf-8');
    return { configPath, backupPath, hadExisting };
  } catch {
    if (hadExisting) {
      try {
        fs.unlinkSync(backupPath);
      } catch {
        /* ignore cleanup error */
      }
    }
    return null;
  }
}

function restoreDefaultConfig(backup: ConfigBackup | null): void {
  if (!backup) return;
  try {
    if (backup.hadExisting) {
      fs.copyFileSync(backup.backupPath, backup.configPath);
      fs.unlinkSync(backup.backupPath);
    } else {
      if (fs.existsSync(backup.configPath)) fs.unlinkSync(backup.configPath);
    }
  } catch {
    /* restore error */
  }
}

function isCommandAvailable(command: string): boolean {
  try {
    const checker = process.platform === 'win32' ? 'where' : 'which';
    execFileSync(checker, [command], { stdio: 'ignore', timeout: 10_000 });
    return true;
  } catch {
    return false;
  }
}

function getLocalBinPath(projectPath: string, command: string): string {
  return path.join(
    projectPath,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? `${command}.cmd` : command,
  );
}

function isExecutableAvailable(command: string): boolean {
  try {
    execFileSync(command, ['--version'], { stdio: 'ignore', timeout: 10_000 });
    return true;
  } catch {
    return false;
  }
}

function resolveOpenSpecCommand(
  projectPath: string,
): { command: string; location: 'local' | 'global' } | null {
  const localCommand = getLocalBinPath(projectPath, 'openspec');
  if (fs.existsSync(localCommand) && isExecutableAvailable(localCommand))
    return { command: localCommand, location: 'local' };
  if (isCommandAvailable('openspec')) return { command: 'openspec', location: 'global' };
  return null;
}

async function ensureOpenSpecCli(
  scope: InstallScope,
  projectPath: string,
  shouldInstall = true,
): Promise<'ready' | 'missing' | 'failed'> {
  const existingCommand = resolveOpenSpecCommand(projectPath);
  if (!shouldInstall) return existingCommand ? 'ready' : 'missing';
  const label = existingCommand ? 'Upgrading' : 'Installing';
  console.warn(`    ${label} OpenSpec CLI...`);
  try {
    const npmArgs =
      scope === 'global'
        ? ['install', '-g', '@fission-ai/openspec@latest']
        : ['install', '@fission-ai/openspec@latest'];
    execFileSync(getNpmExecutable(), npmArgs, {
      cwd: projectPath,
      stdio: 'inherit',
      timeout: 120_000,
      shell: process.platform === 'win32',
    });
    return resolveOpenSpecCommand(projectPath) ? 'ready' : 'failed';
  } catch (error) {
    if (existingCommand) {
      console.warn(
        `    OpenSpec upgrade failed, using existing ${existingCommand.location} version: ${(error as Error).message}`,
      );
      return 'ready';
    }
    console.error(`    Failed to install OpenSpec CLI: ${(error as Error).message}`);
    printCommandErrorDetails(error);
    return 'failed';
  }
}

function migrateOpenCodeOpenSpecPaths(homeDir: string): void {
  const opencodePlatform = PLATFORMS.find((p) => p.id === 'opencode');
  if (!opencodePlatform?.globalSkillsDir) return;
  const wrongDir = path.join(homeDir, opencodePlatform.skillsDir);
  const correctDir = path.join(homeDir, opencodePlatform.globalSkillsDir);
  const migrations: Array<[string, string, string]> = [
    [path.join(wrongDir, 'skills'), path.join(correctDir, 'skills'), 'skills'],
    [path.join(wrongDir, 'commands'), path.join(correctDir, 'commands'), 'commands'],
  ];
  for (const [srcDir, destDir, label] of migrations) {
    if (srcDir === destDir) continue;
    if (!fs.existsSync(srcDir)) continue;
    try {
      const entries = fs.readdirSync(srcDir);
      if (entries.length === 0) continue;
      fs.mkdirSync(destDir, { recursive: true });
      for (const entry of entries) {
        fs.cpSync(path.join(srcDir, entry), path.join(destDir, entry), {
          recursive: true,
          force: true,
        });
      }
      fs.rmSync(srcDir, { recursive: true, force: true });
    } catch (error) {
      console.error(
        `    Warning: failed to migrate OpenSpec ${label}: ${(error as Error).message}`,
      );
    }
  }
  if (fs.existsSync(wrongDir)) {
    try {
      const remaining = fs.readdirSync(wrongDir);
      if (remaining.length === 0) fs.rmdirSync(wrongDir);
    } catch {
      /* cleanup error */
    }
  }
}

async function installOpenSpec(
  projectPath: string,
  toolIds: string[],
  scope: InstallScope,
  shouldInstallCli = true,
): Promise<'installed' | 'failed' | 'skipped'> {
  const cliStatus = await ensureOpenSpecCli(scope, projectPath, shouldInstallCli);
  if (cliStatus === 'failed') {
    console.error(
      '    OpenSpec CLI not available. Install manually: npm install -g @fission-ai/openspec@latest',
    );
    return 'failed';
  }
  if (cliStatus === 'missing') return 'skipped';
  const openspecCommand = resolveOpenSpecCommand(projectPath);
  if (!openspecCommand) {
    console.error(
      '    OpenSpec CLI not available. Install manually: npm install -g @fission-ai/openspec@latest',
    );
    return 'failed';
  }

  if (toolIds.length === 0) throw new Error('At least one OpenSpec tool ID is required');

  let configHome: string | undefined;
  let configBackup: ConfigBackup | null = null;
  try {
    const openspecEnv = createOpenSpecAllWorkflowsEnv();
    configHome = openspecEnv.configHome;
    configBackup = writeAllWorkflowsToDefaultConfig();
    const invocation = buildOpenSpecInitInvocation(
      projectPath,
      toolIds,
      scope,
      os.homedir(),
      true,
      openspecCommand.command,
    );
    try {
      execFileSync(invocation.command, invocation.args, {
        cwd: projectPath,
        env: openspecEnv.env,
        stdio: ['inherit', 'inherit', 'pipe'],
        timeout: 120_000,
        shell: process.platform === 'win32',
      });
    } catch (firstError) {
      const stderrText = (firstError as { stderr?: Buffer }).stderr?.toString() ?? '';
      if (stderrText.includes('unknown option') && stderrText.includes('--profile')) {
        console.warn('    OpenSpec does not support --profile flag, retrying without it...');
        const fallbackInvocation = buildOpenSpecInitInvocation(
          projectPath,
          toolIds,
          scope,
          os.homedir(),
          false,
          openspecCommand.command,
        );
        execFileSync(fallbackInvocation.command, fallbackInvocation.args, {
          cwd: projectPath,
          env: openspecEnv.env,
          stdio: 'inherit',
          timeout: 120_000,
          shell: process.platform === 'win32',
        });
      } else {
        throw firstError;
      }
    }
    if (scope === 'global' && toolIds.includes('opencode'))
      migrateOpenCodeOpenSpecPaths(os.homedir());
    return 'installed';
  } catch (error) {
    console.error(`    OpenSpec init failed: ${(error as Error).message}`);
    printCommandErrorDetails(error);
    return 'failed';
  } finally {
    restoreDefaultConfig(configBackup);
    if (configHome) fs.rmSync(configHome, { recursive: true, force: true });
  }
}

export {
  installOpenSpec,
  isCommandAvailable,
  buildOpenSpecInitInvocation,
  getNpmExecutable,
  migrateOpenCodeOpenSpecPaths,
  resolveOpenSpecCommand,
};
