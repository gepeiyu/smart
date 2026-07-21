import path from 'path';
import { detectPlatforms } from '../core/detect.js';
import { getPlatformSkillsDir, type Platform } from '../core/platforms.js';
import { loadProjectIntegrationEnvironment } from '../integrations/environment.js';
import type { IntegrationRuntime } from '../integrations/runtime.js';
import { fileExists } from '../utils/file-system.js';
import { resolveConfiguredProjectWorkflow } from '../workflows/store.js';

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn' | 'skip';
  message: string;
  integrationId?: string;
}

async function checkWorkingDirs(cwd: string): Promise<CheckResult> {
  const expected = ['.smart', '.smart/workflows', 'smartdocs/changes', 'smartdocs/workflows'];
  const missing = [];
  for (const dir of expected) {
    if (!(await fileExists(path.join(cwd, dir)))) missing.push(dir);
  }
  return {
    name: 'Working directories',
    status: missing.length === 0 ? 'pass' : missing.length === expected.length ? 'fail' : 'warn',
    message:
      missing.length === 0 ? 'All Smart directories present' : `Missing: ${missing.join(', ')}`,
  };
}

async function checkSkills(cwd: string, platforms: Platform[]): Promise<CheckResult> {
  if (platforms.length === 0) {
    return {
      name: 'Smart skills',
      status: 'skip',
      message: 'No AI platforms detected in this project',
    };
  }
  let installed = 0;
  for (const platform of platforms) {
    if (
      await fileExists(path.join(cwd, getPlatformSkillsDir(platform, 'project'), 'skills', 'smart'))
    ) {
      installed++;
    }
  }
  return {
    name: 'Smart skills',
    status: installed === platforms.length ? 'pass' : 'warn',
    message: `Skills installed on ${installed}/${platforms.length} platforms`,
  };
}

async function checkConfiguration(cwd: string): Promise<CheckResult> {
  const configPath = path.join(cwd, '.smart', 'config.yaml');
  if (!(await fileExists(configPath))) {
    return { name: 'Smart configuration', status: 'fail', message: '.smart/config.yaml not found' };
  }
  try {
    const { promises: fs } = await import('fs');
    const content = await fs.readFile(configPath, 'utf-8');
    const complete = content.includes('smart_language') && content.includes('auto_transition');
    return {
      name: 'Smart configuration',
      status: complete ? 'pass' : 'warn',
      message: complete ? '.smart/config.yaml is readable' : '.smart/config.yaml may be incomplete',
    };
  } catch {
    return {
      name: 'Smart configuration',
      status: 'fail',
      message: '.smart/config.yaml is not readable',
    };
  }
}

async function checkIntegration(
  runtime: IntegrationRuntime,
  cwd: string,
  platforms: Platform[],
): Promise<CheckResult> {
  const platformIds = platforms.map((platform) => platform.id);
  const detection = await runtime.detect({
    projectPath: cwd,
    baseDir: cwd,
    scope: 'project',
    platformIds,
  });
  const missingPlatforms = platformIds.filter(
    (platformId) => !detection.installedOnPlatforms[platformId],
  );
  const ready = detection.dependencyAvailable && missingPlatforms.length === 0;
  const details = [
    detection.dependencyAvailable ? 'dependency available' : 'dependency missing',
    missingPlatforms.length === 0
      ? 'project integration ready'
      : `missing on: ${missingPlatforms.join(', ')}`,
  ];
  return {
    name: runtime.manifest.displayName,
    integrationId: runtime.manifest.id,
    status: platformIds.length === 0 ? 'skip' : ready ? 'pass' : 'fail',
    message: details.join('; '),
  };
}

export async function doctorCommand(
  targetPath: string,
  opts?: Record<string, unknown>,
): Promise<void> {
  const cwd = path.resolve(targetPath || process.cwd());
  const fixMode = opts?.fix === true;
  const jsonOutput = opts?.json === true;
  if (!jsonOutput) console.log(`Smart Doctor - ${cwd}\n`);

  const platforms = await detectPlatforms(cwd);
  let workflowInfo: Awaited<ReturnType<typeof resolveConfiguredProjectWorkflow>> = null;
  let integrationEnvironment: Awaited<ReturnType<typeof loadProjectIntegrationEnvironment>> | null =
    null;
  let workflowCheck: CheckResult;
  let runtimes: IntegrationRuntime[] = [];
  try {
    integrationEnvironment = await loadProjectIntegrationEnvironment(cwd);
    workflowInfo = await resolveConfiguredProjectWorkflow(cwd, integrationEnvironment.registry);
    if (!workflowInfo) {
      workflowCheck = {
        name: 'Workflow configuration',
        status: 'fail',
        message: '.smart/setup.yaml not found; run smart init',
      };
    } else if (!workflowInfo.resolution.valid) {
      workflowCheck = {
        name: 'Workflow configuration',
        status: 'fail',
        message: workflowInfo.resolution.issues.map((issue) => issue.message).join('; '),
      };
    } else {
      runtimes = Object.keys(workflowInfo.resolution.workflow.integrations).map((id) =>
        integrationEnvironment!.runtimes.require(id),
      );
      const digestChanged =
        workflowInfo.selection.resolvedDigest !== workflowInfo.resolution.workflow.digest;
      workflowCheck = {
        name: 'Workflow configuration',
        status: digestChanged ? 'warn' : 'pass',
        message: digestChanged
          ? `Workflow changed since setup (${workflowInfo.selection.source})`
          : `${workflowInfo.selection.source} [${workflowInfo.resolution.workflow.supportLevel}]`,
      };
    }
  } catch (error) {
    workflowCheck = {
      name: 'Workflow configuration',
      status: 'fail',
      message: (error as Error).message,
    };
  }

  const integrationChecks = await Promise.all(
    runtimes.map((runtime) => checkIntegration(runtime, cwd, platforms)),
  );
  const results: CheckResult[] = [
    workflowCheck,
    await checkWorkingDirs(cwd),
    await checkSkills(cwd, platforms),
    await checkConfiguration(cwd),
    ...integrationChecks,
  ];

  if (fixMode) {
    for (const check of integrationChecks.filter((result) => result.status === 'fail')) {
      if (!integrationEnvironment) continue;
      const runtime = integrationEnvironment.runtimes.require(check.integrationId!);
      const result = await runtime.install({
        projectPath: cwd,
        baseDir: cwd,
        scope: 'project',
        platformIds: platforms.map((platform) => platform.id),
        installDependency: true,
      });
      if (!jsonOutput) console.log(`  Fix ${runtime.manifest.displayName}: ${result.status}`);
    }
  }

  if (jsonOutput) {
    process.stdout.write(
      JSON.stringify(
        {
          workflow: workflowInfo
            ? {
                source: workflowInfo.selection.source,
                supportLevel: workflowInfo.resolution.workflow.supportLevel,
                digest: workflowInfo.resolution.workflow.digest,
              }
            : null,
          checks: results,
        },
        null,
        2,
      ) + '\n',
    );
    return;
  }

  let passed = 0;
  let failed = 0;
  let warnings = 0;
  for (const result of results) {
    const icon =
      result.status === 'pass'
        ? 'OK'
        : result.status === 'fail'
          ? 'FAIL'
          : result.status === 'warn'
            ? 'WARN'
            : 'SKIP';
    console.log(`  [${icon}] ${result.name}: ${result.message}`);
    if (result.status === 'pass') passed++;
    else if (result.status === 'fail') failed++;
    else if (result.status === 'warn') warnings++;
  }
  console.log(`\n${passed} passed, ${warnings} warnings, ${failed} failed`);
  if (!fixMode && failed > 0) console.log('\nRun with --fix to reconcile active integrations.');
}
