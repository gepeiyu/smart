import path from 'path';
import { execFileSync } from 'child_process';
import { fileExists, readDir } from '../utils/file-system.js';
import { detectPlatforms } from '../core/detect.js';
import { isCommandAvailable } from '../core/openspec.js';
import { hasCodegraphProjectIndex } from '../core/codegraph.js';

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn' | 'skip';
  message: string;
}

function checkOpenSpecCLI(): CheckResult {
  const available = isCommandAvailable('openspec');
  return {
    name: 'OpenSpec CLI',
    status: available ? 'pass' : 'fail',
    message: available ? 'OpenSpec CLI is installed' : 'OpenSpec CLI is not installed. Run: npm install -g @openspec/cli',
  };
}

async function checkWorkingDirs(cwd: string): Promise<CheckResult> {
  const expected = ['.smart', 'docs', 'docs/superpowers', 'docs/superpowers/specs', 'docs/superpowers/plans', 'openspec', 'openspec/changes'];
  const missing = [];

  for (const dir of expected) {
    if (!(await fileExists(path.join(cwd, dir)))) {
      missing.push(dir);
    }
  }

  return {
    name: 'Working directories',
    status: missing.length === 0 ? 'pass' : missing.length === expected.length ? 'fail' : 'warn',
    message: missing.length === 0
      ? 'All working directories present'
      : `Missing: ${missing.join(', ')}`,
  };
}

async function checkSkills(cwd: string): Promise<CheckResult> {
  const platforms = await detectPlatforms(cwd);

  if (platforms.length === 0) {
    return {
      name: 'Smart skills',
      status: 'skip',
      message: 'No AI platforms detected in this project',
    };
  }

  let totalSkills = 0;
  let installedSkills = 0;

  for (const platform of platforms) {
    const skillsDir = path.join(cwd, platform.skillsDir, 'skills', 'smart');
    const hasSkill = await fileExists(skillsDir);
    totalSkills++;
    if (hasSkill) installedSkills++;
  }

  return {
    name: 'Smart skills',
    status: installedSkills === totalSkills ? 'pass' : 'warn',
    message: `Skills installed on ${installedSkills}/${totalSkills} platforms`,
  };
}

async function checkScripts(cwd: string): Promise<CheckResult> {
  const smartDir = path.join(cwd, '.smart');
  const hasDir = await fileExists(smartDir);
  return {
    name: 'Scripts',
    status: hasDir ? 'pass' : 'warn',
    message: hasDir ? '.smart directory exists' : '.smart directory not found',
  };
}

async function checkCodegraph(cwd: string): Promise<CheckResult> {
  const hasIndex = await hasCodegraphProjectIndex(cwd);
  return {
    name: 'CodeGraph',
    status: hasIndex ? 'pass' : 'warn',
    message: hasIndex ? 'CodeGraph project index found' : 'CodeGraph not indexed. Run: codegraph index',
  };
}

async function checkConfig(cwd: string): Promise<CheckResult> {
  const projectConfigPath = path.join(cwd, '.smart', 'config.yaml');
  const hasProjectConfig = await fileExists(projectConfigPath);

  const changesDir = path.join(cwd, 'openspec', 'changes');
  const hasChangesDir = await fileExists(changesDir);
  let smartYamlCount = 0;
  if (hasChangesDir) {
    const changeDirs = await readDir(changesDir);
    for (const changeName of changeDirs) {
      const smartYaml = path.join(changesDir, changeName, '.smart.yaml');
      if (await fileExists(smartYaml)) smartYamlCount++;
    }
  }

  const messages: string[] = [];
  let status: 'pass' | 'warn' | 'fail' = 'pass';

  if (hasProjectConfig) {
    try {
      const { promises: fs } = await import('fs');
      const content = await fs.readFile(projectConfigPath, 'utf-8');
      const hasPhase = content.includes('phase') || content.includes('auto_transition');
      messages.push(`.smart/config.yaml ${hasPhase ? 'valid' : 'may be incomplete'}`);
      if (!hasPhase) status = 'warn';
    } catch {
      messages.push('.smart/config.yaml not readable');
      status = 'warn';
    }
  } else {
    messages.push('.smart/config.yaml not found');
    status = 'fail';
  }

  if (smartYamlCount > 0) {
    messages.push(`${smartYamlCount} change(s) with .smart.yaml`);
  } else if (hasChangesDir) {
    messages.push('no changes with .smart.yaml found');
    if (status === 'pass') status = 'warn';
  } else {
    messages.push('openspec/changes/ not found');
  }

  return { name: 'Configuration file', status, message: messages.join('; ') };
}

export async function doctorCommand(targetPath: string, opts?: Record<string, unknown>): Promise<void> {
  const cwd = targetPath || process.cwd();
  const fixMode = opts?.fix === true;
  const jsonOutput = opts?.json === true;

  if (!jsonOutput) console.log(`Smart Doctor — ${cwd}\n`);

  const results: CheckResult[] = [
    checkOpenSpecCLI(),
    await checkWorkingDirs(cwd),
    await checkSkills(cwd),
    await checkScripts(cwd),
    await checkCodegraph(cwd),
    await checkConfig(cwd),
  ];

  if (jsonOutput) {
    process.stdout.write(JSON.stringify(results, null, 2) + '\n');
    return;
  }

  let passed = 0;
  let failed = 0;
  let warnings = 0;

  for (const result of results) {
    const icon = result.status === 'pass' ? '✓' : result.status === 'fail' ? '✗' : result.status === 'warn' ? '⚠' : '○';
    console.log(`  ${icon} ${result.name}: ${result.message}`);
    if (result.status === 'pass') passed++;
    else if (result.status === 'fail') failed++;
    else if (result.status === 'warn') warnings++;
  }

  console.log(`\n${passed} passed, ${warnings} warnings, ${failed} failed`);

  if (fixMode && failed > 0) {
    console.log('\nAttempting auto-fix...');
    if (results[0].status === 'fail') {
      try {
        execFileSync('npm', ['install', '-g', '@openspec/cli'], { stdio: 'inherit', timeout: 120000 });
        console.log('  ✓ OpenSpec CLI installed');
      } catch {
        console.log('  ✗ Failed to install OpenSpec CLI');
      }
    }
  }

  if (!fixMode && failed > 0) {
    console.log('\nRun with --fix to attempt auto-repair.');
  }
}
