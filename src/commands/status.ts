import { collectProjectSnapshot } from '../project/inspection.js';
import { localize } from '../project/language.js';
import type {
  ProjectDiagnostic,
  ProjectLanguage,
  ProjectRunSnapshot,
  ProjectSnapshot,
} from '../project/types.js';

interface StatusOptions {
  json?: boolean;
  all?: boolean;
  verbose?: boolean;
  change?: string;
  language?: string;
}

function healthLabel(snapshot: ProjectSnapshot): string {
  switch (snapshot.health) {
    case 'healthy':
      return localize(snapshot.language, 'HEALTHY', '健康');
    case 'attention':
      return localize(snapshot.language, 'ATTENTION', '需关注');
    case 'blocked':
      return localize(snapshot.language, 'BLOCKED', '已阻断');
    case 'uninitialized':
      return localize(snapshot.language, 'NOT INITIALIZED', '未初始化');
  }
}

function runLabel(run: ProjectRunSnapshot, language: ProjectLanguage): string {
  const labels: Record<ProjectRunSnapshot['status'], [string, string]> = {
    active: ['ACTIVE', '进行中'],
    blocked: ['BLOCKED', '已阻断'],
    completed: ['COMPLETED', '已完成'],
    invalid: ['INVALID', '无效'],
  };
  const [en, zh] = labels[run.status];
  return localize(language, en, zh).padEnd(language === 'zh' ? 5 : 9);
}

function progress(run: ProjectRunSnapshot): string {
  if (run.progressPercent === null) return '-';
  return `${run.progressPercent}%`;
}

function relevantDiagnostics(
  diagnostics: ProjectDiagnostic[],
  verbose: boolean,
): ProjectDiagnostic[] {
  return diagnostics.filter((item) => verbose || item.status === 'fail' || item.status === 'warn');
}

function printRun(run: ProjectRunSnapshot, language: ProjectLanguage): void {
  const stage =
    run.currentStage ?? (run.status === 'completed' ? localize(language, 'done', '完成') : '-');
  console.log(
    localize(
      language,
      `  ${runLabel(run, language)} ${run.name}  stage=${stage}  route=${run.route ?? '-'}  progress=${progress(run)}`,
      `  ${runLabel(run, language)} ${run.name}  阶段=${stage}  路由=${run.route ?? '-'}  进度=${progress(run)}`,
    ),
  );
  if (run.failure)
    console.log(
      localize(language, `            Blocked: ${run.failure}`, `            阻断：${run.failure}`),
    );
  for (const error of run.errors)
    console.log(localize(language, `            Error: ${error}`, `            错误：${error}`));
  if (run.drifted)
    console.log(
      localize(
        language,
        '            Workflow definition changed during this run',
        '            本次运行期间工作流定义已发生变化',
      ),
    );
  if (run.nextAction)
    console.log(
      localize(
        language,
        `            Next: ${run.nextAction.command}`,
        `            下一步：${run.nextAction.command}`,
      ),
    );
}

function printDiagnostics(diagnostics: ProjectDiagnostic[], language: ProjectLanguage): void {
  if (diagnostics.length === 0) return;
  console.log(localize(language, '\nDiagnostics', '\n诊断'));
  for (const item of diagnostics) {
    console.log(`  ${item.status.toUpperCase().padEnd(4)}  ${item.title}: ${item.message}`);
    if (item.remediation && item.status !== 'pass') {
      console.log(
        localize(language, `        Fix: ${item.remediation}`, `        修复：${item.remediation}`),
      );
    }
  }
}

function printVerboseDetails(snapshot: ProjectSnapshot): void {
  const language = snapshot.language;
  console.log(localize(language, '\nPlatforms', '\n平台'));
  if (snapshot.platforms.length === 0)
    console.log(localize(language, '  None detected', '  未检测到平台'));
  for (const platform of snapshot.platforms) {
    console.log(
      localize(
        language,
        `  ${platform.name}: skills=${platform.skillsScope}`,
        `  ${platform.name}：技能范围=${platform.skillsScope}`,
      ),
    );
  }

  console.log(localize(language, '\nIntegrations', '\n集成'));
  if (snapshot.integrations.length === 0)
    console.log(localize(language, '  None resolved', '  未解析到集成'));
  for (const integration of snapshot.integrations) {
    console.log(
      localize(
        language,
        `  ${integration.displayName}: ${integration.status} (${integration.source}, ${integration.management}-managed)`,
        `  ${integration.displayName}：${integration.status}（来源=${integration.source}，管理=${integration.management}）`,
      ),
    );
  }

  if (snapshot.git) {
    console.log('\nGit');
    console.log(
      `  ${snapshot.git.branch} @ ${snapshot.git.headShort}  ${
        snapshot.git.dirty
          ? localize(
              language,
              `${snapshot.git.dirtyFiles.length} dirty files`,
              `${snapshot.git.dirtyFiles.length} 个文件有改动`,
            )
          : localize(language, 'clean', '干净')
      }`,
    );
  }
}

export async function statusCommand(
  targetPath: string,
  opts: StatusOptions | Record<string, unknown> = {},
): Promise<void> {
  const options = opts as StatusOptions;
  const snapshot = await collectProjectSnapshot(targetPath || process.cwd(), {
    language: options.language,
  });
  const language = snapshot.language;
  const selected = options.change
    ? snapshot.runs.filter((run) => run.name === options.change)
    : snapshot.runs.filter((run) => options.all || run.status !== 'completed');

  if (options.change && selected.length === 0) {
    throw new Error(
      localize(
        language,
        `Workflow run not found: ${options.change}`,
        `未找到工作流运行：${options.change}`,
      ),
    );
  }

  if (options.json) {
    process.stdout.write(
      JSON.stringify(options.change ? { ...snapshot, runs: selected } : snapshot, null, 2) + '\n',
    );
    return;
  }

  console.log(`Smart ${localize(language, 'Status', '状态')}  ${healthLabel(snapshot)}`);
  console.log(snapshot.projectPath);
  if (snapshot.workflow.configured) {
    const digest = snapshot.workflow.resolvedDigest?.slice(0, 12) ?? '-';
    console.log(
      localize(
        language,
        `\nWorkflow  ${snapshot.workflow.source} [${snapshot.workflow.supportLevel}] ${digest}${snapshot.workflow.drifted ? '  DRIFTED' : ''}`,
        `\n工作流    ${snapshot.workflow.source} [${snapshot.workflow.supportLevel}] ${digest}${snapshot.workflow.drifted ? '  已漂移' : ''}`,
      ),
    );
  } else {
    console.log(localize(language, '\nWorkflow  not configured', '\n工作流    未配置'));
  }
  console.log(
    localize(
      language,
      `Runs      ${snapshot.summary.active} active  ${snapshot.summary.blocked} blocked  ${snapshot.summary.completed} completed  ${snapshot.summary.invalid} invalid`,
      `运行      ${snapshot.summary.active} 进行中  ${snapshot.summary.blocked} 已阻断  ${snapshot.summary.completed} 已完成  ${snapshot.summary.invalid} 无效`,
    ),
  );

  console.log(
    options.all
      ? localize(language, '\nChanges', '\n全部变更')
      : localize(language, '\nCurrent changes', '\n当前变更'),
  );
  if (selected.length === 0) {
    console.log(localize(language, '  No active or blocked changes', '  没有进行中或已阻断的变更'));
  } else {
    for (const run of selected) printRun(run, language);
  }

  if (options.verbose) printVerboseDetails(snapshot);
  printDiagnostics(relevantDiagnostics(snapshot.diagnostics, options.verbose === true), language);
}
