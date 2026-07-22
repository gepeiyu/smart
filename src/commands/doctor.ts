import path from 'path';
import { createWorkingDirs } from '../core/skills.js';
import { detectPlatforms } from '../core/detect.js';
import { loadProjectIntegrationEnvironment } from '../integrations/environment.js';
import { collectProjectSnapshot } from '../project/inspection.js';
import { localize } from '../project/language.js';
import type {
  DiagnosticArea,
  DiagnosticFix,
  DiagnosticStatus,
  ProjectDiagnostic,
  ProjectLanguage,
  ProjectSnapshot,
} from '../project/types.js';

interface DoctorOptions {
  fix?: boolean;
  json?: boolean;
  language?: string;
}

interface FixResult {
  kind: DiagnosticFix['kind'];
  target: string;
  status: 'fixed' | 'skipped' | 'failed';
  message: string;
}

const AREA_LABELS: Record<DiagnosticArea, [string, string]> = {
  setup: ['Setup', '项目设置'],
  workflow: ['Workflow', '工作流'],
  platform: ['Platforms', '平台'],
  integration: ['Integrations', '集成'],
  run: ['Runs', '运行'],
};

function checkIcon(status: DiagnosticStatus): string {
  switch (status) {
    case 'pass':
      return 'OK';
    case 'warn':
      return 'WARN';
    case 'fail':
      return 'FAIL';
    case 'skip':
      return 'SKIP';
  }
}

function uniqueFixes(checks: ProjectDiagnostic[]): DiagnosticFix[] {
  const fixes = new Map<string, DiagnosticFix>();
  for (const check of checks) {
    if (!check.fix) continue;
    const key = `${check.fix.kind}:${check.fix.integrationId ?? ''}`;
    fixes.set(key, check.fix);
  }
  return [...fixes.values()];
}

async function applyFixes(projectPath: string, snapshot: ProjectSnapshot): Promise<FixResult[]> {
  const results: FixResult[] = [];
  const fixes = uniqueFixes(snapshot.diagnostics);
  const language = snapshot.language;

  if (fixes.some((fix) => fix.kind === 'create-project-layout')) {
    try {
      await createWorkingDirs(projectPath, language);
      results.push({
        kind: 'create-project-layout',
        target: projectPath,
        status: 'fixed',
        message: localize(
          language,
          'Created missing Smart project directories and configuration',
          '已创建缺失的 Smart 项目目录和配置',
        ),
      });
    } catch (error) {
      results.push({
        kind: 'create-project-layout',
        target: projectPath,
        status: 'failed',
        message: (error as Error).message,
      });
    }
  }

  const integrationFixes = fixes.filter(
    (fix): fix is DiagnosticFix & { integrationId: string } =>
      fix.kind === 'install-integration' && typeof fix.integrationId === 'string',
  );
  if (integrationFixes.length === 0) return results;

  let environment: Awaited<ReturnType<typeof loadProjectIntegrationEnvironment>>;
  try {
    environment = await loadProjectIntegrationEnvironment(projectPath);
  } catch (error) {
    return [
      ...results,
      ...integrationFixes.map((fix): FixResult => ({
        kind: fix.kind,
        target: fix.integrationId,
        status: 'failed',
        message: localize(
          language,
          `Cannot load integration environment: ${(error as Error).message}`,
          `无法加载集成环境：${(error as Error).message}`,
        ),
      })),
    ];
  }

  const platformIds = (await detectPlatforms(projectPath)).map((platform) => platform.id);
  for (const fix of integrationFixes) {
    const runtime = environment.runtimes.get(fix.integrationId);
    if (!runtime) {
      results.push({
        kind: fix.kind,
        target: fix.integrationId,
        status: 'failed',
        message: localize(language, 'Integration runtime is unavailable', '集成运行时不可用'),
      });
      continue;
    }
    if (runtime.manifest.management !== 'smart') {
      results.push({
        kind: fix.kind,
        target: fix.integrationId,
        status: 'skipped',
        message: localize(
          language,
          'User-managed integrations are never modified by Smart Doctor',
          'Smart Doctor 不会修改由用户管理的集成',
        ),
      });
      continue;
    }
    try {
      const result = await runtime.install({
        projectPath,
        baseDir: projectPath,
        scope: 'project',
        platformIds,
        installDependency: true,
      });
      results.push({
        kind: fix.kind,
        target: fix.integrationId,
        status:
          result.status === 'failed' ? 'failed' : result.status === 'skipped' ? 'skipped' : 'fixed',
        message: result.message ?? result.status,
      });
    } catch (error) {
      results.push({
        kind: fix.kind,
        target: fix.integrationId,
        status: 'failed',
        message: (error as Error).message,
      });
    }
  }
  return results;
}

function printChecks(snapshot: ProjectSnapshot): void {
  const language = snapshot.language;
  for (const area of Object.keys(AREA_LABELS) as DiagnosticArea[]) {
    const checks = snapshot.diagnostics.filter((item) => item.area === area);
    if (checks.length === 0) continue;
    console.log(`\n${localize(language, ...AREA_LABELS[area])}`);
    for (const check of checks) {
      console.log(`  [${checkIcon(check.status)}] ${check.title}: ${check.message}`);
      if (check.remediation && check.status !== 'pass') {
        console.log(
          localize(
            language,
            `         Next: ${check.remediation}`,
            `         下一步：${check.remediation}`,
          ),
        );
      }
    }
  }
}

function printFixes(results: FixResult[], language: ProjectLanguage): void {
  if (results.length === 0) return;
  console.log(localize(language, '\nRepairs', '\n修复结果'));
  for (const result of results) {
    console.log(`  [${result.status.toUpperCase()}] ${result.target}: ${result.message}`);
  }
}

export async function doctorCommand(
  targetPath: string,
  opts: DoctorOptions | Record<string, unknown> = {},
): Promise<void> {
  const options = opts as DoctorOptions;
  const projectPath = path.resolve(targetPath || process.cwd());
  const snapshotOptions = { language: options.language };
  const before = await collectProjectSnapshot(projectPath, snapshotOptions);
  const fixes = options.fix ? await applyFixes(projectPath, before) : [];
  const snapshot = options.fix
    ? await collectProjectSnapshot(projectPath, snapshotOptions)
    : before;
  const language = snapshot.language;

  if (options.json) {
    process.stdout.write(JSON.stringify({ snapshot, fixes }, null, 2) + '\n');
    return;
  }

  const healthLabels: Record<ProjectSnapshot['health'], [string, string]> = {
    healthy: ['HEALTHY', '健康'],
    attention: ['ATTENTION', '需关注'],
    blocked: ['BLOCKED', '已阻断'],
    uninitialized: ['NOT INITIALIZED', '未初始化'],
  };
  console.log(
    `Smart ${localize(language, 'Doctor', '诊断')}  ${localize(language, ...healthLabels[snapshot.health])}`,
  );
  console.log(projectPath);
  printChecks(snapshot);
  printFixes(fixes, language);
  console.log(
    localize(
      language,
      `\n${snapshot.diagnostics.filter((item) => item.status === 'pass').length} passed, ${snapshot.summary.warnings} warnings, ${snapshot.summary.failures} failed`,
      `\n${snapshot.diagnostics.filter((item) => item.status === 'pass').length} 项通过，${snapshot.summary.warnings} 项警告，${snapshot.summary.failures} 项失败`,
    ),
  );
  if (!options.fix && uniqueFixes(snapshot.diagnostics).length > 0) {
    console.log(
      localize(
        language,
        '\nRun smart doctor --fix to apply the listed automatic repairs.',
        '\n运行 smart doctor --fix 执行列出的自动修复。',
      ),
    );
  }
}
