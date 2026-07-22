import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import YAML from 'yaml';
import { detectPlatforms, hasSmartSkills } from '../core/detect.js';
import { PLATFORMS, type Platform } from '../core/platforms.js';
import { smartdocsChangesDir } from '../core/smart-paths.js';
import { loadProjectIntegrationEnvironment } from '../integrations/environment.js';
import type { IntegrationRuntime } from '../integrations/runtime.js';
import { collectGitSnapshot } from '../dashboard/git.js';
import { readTasks } from '../dashboard/task-parser.js';
import { readVerification } from '../dashboard/verify-parser.js';
import { fileExists } from '../utils/file-system.js';
import { readWorkflowRunState } from '../workflows/run-state.js';
import {
  readProjectWorkflowSelection,
  resolveConfiguredProjectWorkflow,
  resolveProjectWorkflow,
} from '../workflows/store.js';
import type { ResolvedWorkflow } from '../workflows/types.js';
import type {
  IntegrationSnapshot,
  PlatformSnapshot,
  ProjectDiagnostic,
  ProjectHealth,
  ProjectLanguage,
  ProjectRunSnapshot,
  ProjectSnapshot,
  RunNextAction,
  WorkflowSnapshot,
} from './types.js';
import { localize, parseProjectLanguage, requireProjectLanguage } from './language.js';

export interface CollectProjectSnapshotOptions {
  language?: string;
}

const EMPTY_WORKFLOW: WorkflowSnapshot = {
  configured: false,
  source: null,
  supportLevel: null,
  configuredDigest: null,
  resolvedDigest: null,
  valid: false,
  drifted: false,
  issues: [],
};

function diagnostic(
  value: Omit<ProjectDiagnostic, 'area'> & { area?: ProjectDiagnostic['area'] },
): ProjectDiagnostic {
  return { area: value.area ?? 'setup', ...value };
}

async function listChangeNames(projectPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(smartdocsChangesDir(projectPath), { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory() && /^[a-z0-9][a-z0-9._-]*$/.test(entry.name))
      .map((entry) => entry.name);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

async function inspectLayout(
  projectPath: string,
  language: ProjectLanguage,
): Promise<ProjectDiagnostic[]> {
  const expected = ['.smart', 'smartdocs/changes'];
  const missing = (
    await Promise.all(
      expected.map(async (entry) => ({
        entry,
        exists: await fileExists(path.join(projectPath, entry)),
      })),
    )
  )
    .filter((item) => !item.exists)
    .map((item) => item.entry);

  if (missing.length === 0) {
    return [
      diagnostic({
        id: 'setup.layout',
        status: 'pass',
        title: localize(language, 'Project layout', '项目目录'),
        message: localize(language, 'Smart project directories are present', 'Smart 项目目录完整'),
      }),
    ];
  }
  return [
    diagnostic({
      id: 'setup.layout',
      status: 'fail',
      title: localize(language, 'Project layout', '项目目录'),
      message: localize(language, `Missing: ${missing.join(', ')}`, `缺少：${missing.join('、')}`),
      remediation: localize(
        language,
        'Run smart init or smart doctor --fix',
        '运行 smart init 或 smart doctor --fix',
      ),
      fix: { kind: 'create-project-layout' },
    }),
  ];
}

async function inspectConfiguration(
  projectPath: string,
  languageOverride: ProjectLanguage | undefined,
): Promise<{
  diagnostic: ProjectDiagnostic;
  language: ProjectLanguage;
  platformIds: string[] | null;
}> {
  const configPath = path.join(projectPath, '.smart', 'config.yaml');
  try {
    const parsed = YAML.parse(await fs.readFile(configPath, 'utf-8')) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('configuration must be a YAML object');
    }
    const config = parsed as Record<string, unknown>;
    const configuredLanguage = parseProjectLanguage(config.smart_language);
    const language = languageOverride ?? configuredLanguage ?? 'en';
    const issues: string[] = [];
    let platformIds: string[] | null = null;
    if (!configuredLanguage) {
      issues.push(
        localize(language, 'smart_language must be en or zh', 'smart_language 必须为 en 或 zh'),
      );
    }
    if (typeof config.auto_transition !== 'boolean') {
      issues.push(
        localize(
          language,
          'auto_transition must be true or false',
          'auto_transition 必须为 true 或 false',
        ),
      );
    }
    if (Object.hasOwn(config, 'platforms')) {
      if (
        !Array.isArray(config.platforms) ||
        !config.platforms.every((id) => typeof id === 'string')
      ) {
        issues.push(
          localize(
            language,
            'platforms must be a list of platform ids',
            'platforms 必须是平台 ID 列表',
          ),
        );
      } else {
        const values = config.platforms as string[];
        const knownIds = new Set(PLATFORMS.map((platform) => platform.id));
        const unknown = values.filter((id) => !knownIds.has(id));
        const duplicate = values.find((id, index) => values.indexOf(id) !== index);
        if (unknown.length > 0) {
          issues.push(
            localize(
              language,
              `unknown platform ids: ${unknown.join(', ')}`,
              `未知平台 ID：${unknown.join('、')}`,
            ),
          );
        } else if (duplicate) {
          issues.push(
            localize(language, `duplicate platform id: ${duplicate}`, `平台 ID 重复：${duplicate}`),
          );
        } else {
          platformIds = values;
        }
      }
    }
    return {
      language,
      platformIds,
      diagnostic: diagnostic({
        id: 'setup.configuration',
        status: issues.length === 0 ? 'pass' : 'warn',
        title: localize(language, 'Smart configuration', 'Smart 配置'),
        message:
          issues.length === 0
            ? localize(language, '.smart/config.yaml is valid', '.smart/config.yaml 配置有效')
            : issues.join(localize(language, '; ', '；')),
        remediation:
          issues.length === 0
            ? undefined
            : localize(language, 'Review .smart/config.yaml', '检查 .smart/config.yaml'),
      }),
    };
  } catch (error) {
    const language = languageOverride ?? 'en';
    const missing = (error as NodeJS.ErrnoException).code === 'ENOENT';
    return {
      language,
      platformIds: null,
      diagnostic: diagnostic({
        id: 'setup.configuration',
        status: 'fail',
        title: localize(language, 'Smart configuration', 'Smart 配置'),
        message: missing
          ? localize(language, '.smart/config.yaml is missing', '缺少 .smart/config.yaml')
          : localize(
              language,
              `.smart/config.yaml is invalid: ${(error as Error).message}`,
              `.smart/config.yaml 无效：${(error as Error).message}`,
            ),
        remediation: missing
          ? localize(language, 'Run smart doctor --fix', '运行 smart doctor --fix')
          : localize(language, 'Repair .smart/config.yaml', '修复 .smart/config.yaml'),
        fix: missing ? { kind: 'create-project-layout' } : undefined,
      }),
    };
  }
}

async function inspectPlatforms(
  projectPath: string,
  language: ProjectLanguage,
  configuredPlatformIds: string[] | null,
): Promise<{
  platforms: PlatformSnapshot[];
  diagnostics: ProjectDiagnostic[];
  platformIds: string[];
}> {
  const inferred = configuredPlatformIds === null;
  let selected: Platform[];
  if (inferred) {
    const detected = await detectPlatforms(projectPath);
    const installed = await Promise.all(
      detected.map(async (platform) => ({
        platform,
        installed: await hasSmartSkills(platform, projectPath, 'project'),
      })),
    );
    selected = installed.filter((item) => item.installed).map((item) => item.platform);
  } else {
    const byId = new Map(PLATFORMS.map((platform) => [platform.id, platform]));
    selected = configuredPlatformIds.flatMap((id) => {
      const platform = byId.get(id);
      return platform ? [platform] : [];
    });
  }

  if (selected.length === 0) {
    return {
      platforms: [],
      platformIds: [],
      diagnostics: [
        diagnostic({
          id: 'platform.configuration',
          area: 'platform',
          status: inferred ? 'warn' : 'skip',
          title: localize(language, 'AI platforms', 'AI 平台'),
          message: localize(
            language,
            inferred
              ? 'No saved platform selection or project Smart skills found'
              : 'No AI platforms are configured for this project',
            inferred ? '未保存平台选择，也未找到项目级 Smart 技能' : '此项目未配置 AI 平台',
          ),
          remediation: localize(
            language,
            'Run smart init to select project platforms',
            '运行 smart init 选择项目平台',
          ),
        }),
      ],
    };
  }

  const platforms = await Promise.all(
    selected.map(async (platform): Promise<PlatformSnapshot> => {
      const [projectInstalled, globalInstalled] = await Promise.all([
        hasSmartSkills(platform, projectPath, 'project'),
        hasSmartSkills(platform, os.homedir(), 'global'),
      ]);
      const skillsScope =
        projectInstalled && globalInstalled
          ? 'both'
          : projectInstalled
            ? 'project'
            : globalInstalled
              ? 'global'
              : 'missing';
      return { id: platform.id, name: platform.name, skillsScope };
    }),
  );
  const missing = platforms.filter((platform) => platform.skillsScope === 'missing');
  if (inferred) {
    return {
      platforms,
      platformIds: selected.map((platform) => platform.id),
      diagnostics: [
        diagnostic({
          id: 'platform.configuration',
          area: 'platform',
          status: 'warn',
          title: localize(language, 'AI platforms', 'AI 平台'),
          message: localize(
            language,
            `Platform selection is not saved; inferred from project Smart skills: ${platforms
              .map((platform) => platform.name)
              .join(', ')}`,
            `未保存平台选择；根据项目 Smart 技能推断为：${platforms
              .map((platform) => platform.name)
              .join('、')}`,
          ),
          remediation: localize(
            language,
            'Run smart init to save the platform selection',
            '运行 smart init 保存平台选择',
          ),
        }),
      ],
    };
  }
  return {
    platforms,
    platformIds: selected.map((platform) => platform.id),
    diagnostics: [
      diagnostic({
        id: 'platform.skills',
        area: 'platform',
        status: missing.length === 0 ? 'pass' : 'warn',
        title: localize(language, 'Smart skills', 'Smart 技能'),
        message:
          missing.length === 0
            ? localize(
                language,
                `Available on ${platforms.length}/${platforms.length} detected platforms`,
                `已覆盖检测到的 ${platforms.length}/${platforms.length} 个平台`,
              )
            : localize(
                language,
                `Missing on: ${missing.map((platform) => platform.name).join(', ')}`,
                `以下平台缺少 Smart 技能：${missing.map((platform) => platform.name).join('、')}`,
              ),
        remediation:
          missing.length === 0
            ? undefined
            : localize(
                language,
                'Run smart init for the missing platforms',
                '对缺失的平台运行 smart init',
              ),
      }),
    ],
  };
}

function workflowDiagnostic(
  workflow: WorkflowSnapshot,
  language: ProjectLanguage,
): ProjectDiagnostic {
  if (!workflow.configured) {
    return diagnostic({
      id: 'workflow.configuration',
      area: 'workflow',
      status: 'fail',
      title: localize(language, 'Workflow', '工作流'),
      message:
        workflow.issues[0] ??
        localize(language, '.smart/setup.yaml is missing', '缺少 .smart/setup.yaml'),
      remediation: localize(
        language,
        'Run smart init or smart workflow use <workflow>',
        '运行 smart init 或 smart workflow use <workflow>',
      ),
    });
  }
  if (!workflow.valid) {
    return diagnostic({
      id: 'workflow.configuration',
      area: 'workflow',
      status: 'fail',
      title: localize(language, 'Workflow', '工作流'),
      message: workflow.issues.join('; '),
      remediation: localize(
        language,
        `Run smart workflow validate ${workflow.source ?? ''}`.trim(),
        `运行 smart workflow validate ${workflow.source ?? ''}`.trim(),
      ),
    });
  }
  return diagnostic({
    id: 'workflow.configuration',
    area: 'workflow',
    status: workflow.drifted ? 'warn' : 'pass',
    title: localize(language, 'Workflow', '工作流'),
    message: workflow.drifted
      ? localize(
          language,
          `${workflow.source} changed since it was selected`,
          `${workflow.source} 自选用后发生了变化`,
        )
      : `${workflow.source} [${workflow.supportLevel}]`,
    remediation: workflow.drifted
      ? localize(
          language,
          `Review and run smart workflow use ${workflow.source}`,
          `检查后运行 smart workflow use ${workflow.source}`,
        )
      : undefined,
  });
}

function integrationStatus(
  runtime: IntegrationRuntime,
  dependencyAvailable: boolean,
  installedOnPlatforms: Record<string, boolean>,
  platformIds: string[],
): IntegrationSnapshot['status'] {
  if (runtime.manifest.source === 'local' && runtime.manifest.localTrust?.trusted !== true) {
    return 'untrusted';
  }
  if (platformIds.length === 0) return 'not-checked';
  const supported = platformIds.every(
    (platformId) =>
      runtime.manifest.platformMappings[platformId] ?? runtime.manifest.platformMappings['*'],
  );
  if (!supported) return 'unsupported';
  return dependencyAvailable && platformIds.every((id) => installedOnPlatforms[id])
    ? 'ready'
    : 'missing';
}

async function inspectIntegration(
  runtime: IntegrationRuntime,
  projectPath: string,
  platformIds: string[],
  language: ProjectLanguage,
): Promise<{ snapshot: IntegrationSnapshot; diagnostic: ProjectDiagnostic }> {
  let detection;
  try {
    detection = await runtime.detect({
      projectPath,
      baseDir: projectPath,
      scope: 'project',
      platformIds,
    });
  } catch (error) {
    const message = localize(
      language,
      `Detection failed: ${(error as Error).message}`,
      `检测失败：${(error as Error).message}`,
    );
    const canFix = runtime.manifest.management === 'smart';
    return {
      snapshot: {
        id: runtime.manifest.id,
        displayName: runtime.manifest.displayName,
        source: runtime.manifest.source,
        management: runtime.manifest.management,
        status: 'missing',
        dependencyAvailable: false,
        platforms: Object.fromEntries(platformIds.map((id) => [id, false])),
        message,
      },
      diagnostic: diagnostic({
        id: `integration.${runtime.manifest.id}`,
        area: 'integration',
        status: 'fail',
        title: runtime.manifest.displayName,
        message,
        remediation: canFix
          ? localize(language, 'Run smart doctor --fix', '运行 smart doctor --fix')
          : localize(language, 'Inspect the user-managed integration', '检查由用户管理的集成'),
        fix: canFix
          ? { kind: 'install-integration', integrationId: runtime.manifest.id }
          : undefined,
      }),
    };
  }
  const status = integrationStatus(
    runtime,
    detection.dependencyAvailable,
    detection.installedOnPlatforms,
    platformIds,
  );
  const missing = platformIds.filter((platformId) => !detection.installedOnPlatforms[platformId]);
  const message =
    status === 'ready'
      ? localize(language, 'Dependency and platform integration are ready', '依赖和平台集成已就绪')
      : status === 'untrusted'
        ? localize(
            language,
            'Local manifest is not trusted at its current digest',
            '本地清单的当前摘要尚未被信任',
          )
        : status === 'unsupported'
          ? localize(
              language,
              'The active integration does not map every detected platform',
              '当前集成未覆盖所有检测到的平台',
            )
          : status === 'not-checked'
            ? localize(language, 'No detected platform to check', '没有可检查的已检测平台')
            : [
                detection.dependencyAvailable
                  ? null
                  : localize(language, 'dependency missing', '缺少依赖'),
                missing.length > 0
                  ? localize(
                      language,
                      `missing on: ${missing.join(', ')}`,
                      `以下平台缺失：${missing.join('、')}`,
                    )
                  : null,
              ]
                .filter(Boolean)
                .join(localize(language, '; ', '；'));
  const canFix = status === 'missing' && runtime.manifest.management === 'smart';
  const checkStatus = status === 'ready' ? 'pass' : status === 'not-checked' ? 'skip' : 'fail';
  return {
    snapshot: {
      id: runtime.manifest.id,
      displayName: runtime.manifest.displayName,
      source: runtime.manifest.source,
      management: runtime.manifest.management,
      status,
      dependencyAvailable: detection.dependencyAvailable,
      platforms: detection.installedOnPlatforms,
      message,
    },
    diagnostic: diagnostic({
      id: `integration.${runtime.manifest.id}`,
      area: 'integration',
      status: checkStatus,
      title: runtime.manifest.displayName,
      message,
      remediation:
        status === 'untrusted'
          ? localize(
              language,
              `Run smart integration validate ${runtime.manifest.id}, then trust its exact digest`,
              `运行 smart integration validate ${runtime.manifest.id}，再信任其精确摘要`,
            )
          : status === 'unsupported'
            ? localize(
                language,
                `Update .smart/integrations/${runtime.manifest.id}/manifest.yaml`,
                `更新 .smart/integrations/${runtime.manifest.id}/manifest.yaml`,
              )
            : canFix
              ? localize(language, 'Run smart doctor --fix', '运行 smart doctor --fix')
              : undefined,
      fix: canFix ? { kind: 'install-integration', integrationId: runtime.manifest.id } : undefined,
    }),
  };
}

function nextAction(
  name: string,
  status: ProjectRunSnapshot['status'],
  currentStage: string | null,
  failure: string | null,
  language: ProjectLanguage,
): RunNextAction | null {
  if (status === 'completed') return null;
  if (status === 'invalid') {
    return {
      command: 'smart doctor',
      label: localize(language, 'Repair state', '修复状态'),
      reason: localize(language, 'Run state is invalid', '运行状态无效'),
    };
  }
  if (status === 'blocked') {
    return {
      command: `smart run status ${name}`,
      label: localize(language, 'Inspect blocker', '检查阻断原因'),
      reason: failure ?? localize(language, 'Run is blocked', '运行已被阻断'),
    };
  }
  const command =
    currentStage === 'issue'
      ? `/smart-issue ${name}`
      : currentStage === 'design'
        ? `/smart-design ${name}`
        : currentStage === 'build'
          ? `/smart-build ${name}`
          : currentStage === 'verify'
            ? `/smart-verify ${name}`
            : currentStage === 'archive'
              ? `/smart-archive ${name}`
              : `/smart ${name}`;
  return {
    command,
    label: currentStage
      ? localize(language, `Continue ${currentStage}`, `继续 ${currentStage}`)
      : localize(language, 'Resume workflow', '恢复工作流'),
    reason: currentStage
      ? localize(language, `Current stage is ${currentStage}`, `当前阶段为 ${currentStage}`)
      : localize(language, 'No current stage selected', '尚未选择当前阶段'),
  };
}

async function inspectRun(
  projectPath: string,
  name: string,
  workflowForSource: (source: string) => Promise<ResolvedWorkflow | null>,
  language: ProjectLanguage,
): Promise<{ run: ProjectRunSnapshot; diagnostics: ProjectDiagnostic[] }> {
  const changeDir = path.join(smartdocsChangesDir(projectPath), name);
  const [taskResult, verificationResult] = await Promise.allSettled([
    readTasks(changeDir),
    readVerification(changeDir),
  ]);
  const tasks = taskResult.status === 'fulfilled' ? taskResult.value : null;
  const verification = verificationResult.status === 'fulfilled' ? verificationResult.value : null;
  const artifactDiagnostics: ProjectDiagnostic[] = [];
  if (taskResult.status === 'rejected') {
    artifactDiagnostics.push(
      diagnostic({
        id: `run.${name}.tasks`,
        area: 'run',
        status: 'warn',
        title: localize(language, `${name} tasks`, `${name} 任务`),
        message: (taskResult.reason as Error).message,
        remediation: localize(
          language,
          `Repair smartdocs/changes/${name}/tasks.md`,
          `修复 smartdocs/changes/${name}/tasks.md`,
        ),
      }),
    );
  }
  if (verificationResult.status === 'rejected') {
    artifactDiagnostics.push(
      diagnostic({
        id: `run.${name}.verification`,
        area: 'run',
        status: 'warn',
        title: localize(language, `${name} verification`, `${name} 验证报告`),
        message: (verificationResult.reason as Error).message,
        remediation: localize(
          language,
          `Repair the verification report for ${name}`,
          `修复 ${name} 的验证报告`,
        ),
      }),
    );
  }
  try {
    const state = await readWorkflowRunState(projectPath, name);
    const workflow = await workflowForSource(state.workflowSource);
    const drifted = workflow ? workflow.digest !== state.workflowDigest : true;
    const stageCount = workflow ? Object.keys(workflow.stages).length : null;
    const progressPercent = stageCount
      ? Math.round((state.completedStages.length / stageCount) * 100)
      : null;
    const run: ProjectRunSnapshot = {
      name,
      workflowSource: state.workflowSource,
      supportLevel: state.supportLevel,
      route: state.route,
      status: state.status,
      currentStage: state.currentStage,
      readyStages: state.readyStages,
      completedStages: state.completedStages,
      stageCount,
      progressPercent,
      evidenceCount: Object.keys(state.evidence).length,
      failure: state.failure,
      drifted,
      updatedAt: state.updatedAt,
      nextAction: nextAction(name, state.status, state.currentStage, state.failure, language),
      tasks,
      verification,
      errors: workflow
        ? []
        : [
            localize(
              language,
              `Workflow cannot be resolved: ${state.workflowSource}`,
              `无法解析工作流：${state.workflowSource}`,
            ),
          ],
    };
    const diagnostics: ProjectDiagnostic[] = [...artifactDiagnostics];
    if (state.status === 'blocked') {
      diagnostics.push(
        diagnostic({
          id: `run.${name}.blocked`,
          area: 'run',
          status: 'fail',
          title: name,
          message:
            state.failure ?? localize(language, 'Workflow run is blocked', '工作流运行已被阻断'),
          remediation: localize(
            language,
            `Inspect with smart run status ${name}`,
            `使用 smart run status ${name} 检查`,
          ),
        }),
      );
    }
    if (drifted) {
      diagnostics.push(
        diagnostic({
          id: `run.${name}.drift`,
          area: 'run',
          status: 'warn',
          title: name,
          message: localize(
            language,
            `Run workflow differs from ${state.workflowSource}`,
            `运行使用的工作流与 ${state.workflowSource} 不一致`,
          ),
          remediation: localize(
            language,
            `Review before using smart run advance ${name} --accept-drift`,
            `检查后再运行 smart run advance ${name} --accept-drift`,
          ),
        }),
      );
    }
    return { run, diagnostics };
  } catch (error) {
    const message = (error as Error).message;
    return {
      run: {
        name,
        workflowSource: null,
        supportLevel: null,
        route: null,
        status: 'invalid',
        currentStage: null,
        readyStages: [],
        completedStages: [],
        stageCount: null,
        progressPercent: null,
        evidenceCount: 0,
        failure: null,
        drifted: false,
        updatedAt: null,
        nextAction: nextAction(name, 'invalid', null, null, language),
        tasks,
        verification,
        errors: [message],
      },
      diagnostics: [
        ...artifactDiagnostics,
        diagnostic({
          id: `run.${name}.invalid`,
          area: 'run',
          status: 'fail',
          title: name,
          message,
          remediation: localize(
            language,
            `Repair smartdocs/changes/${name}/.smart.yaml`,
            `修复 smartdocs/changes/${name}/.smart.yaml`,
          ),
        }),
      ],
    };
  }
}

function projectHealth(
  initialized: boolean,
  diagnostics: ProjectDiagnostic[],
  runs: ProjectRunSnapshot[],
): ProjectHealth {
  if (!initialized) return 'uninitialized';
  if (
    diagnostics.some((item) => item.status === 'fail') ||
    runs.some((run) => run.status === 'blocked')
  ) {
    return 'blocked';
  }
  if (diagnostics.some((item) => item.status === 'warn')) return 'attention';
  return 'healthy';
}

export async function collectProjectSnapshot(
  targetPath: string,
  options: CollectProjectSnapshotOptions = {},
): Promise<ProjectSnapshot> {
  const projectPath = path.resolve(targetPath);
  const languageOverride = requireProjectLanguage(options.language);
  const configuration = await inspectConfiguration(projectPath, languageOverride);
  const language = configuration.language;
  const [layoutChecks, platformInspection, changeNames, setupExists] = await Promise.all([
    inspectLayout(projectPath, language),
    inspectPlatforms(projectPath, language, configuration.platformIds),
    listChangeNames(projectPath),
    fileExists(path.join(projectPath, '.smart', 'setup.yaml')),
  ]);

  let selectedWorkflow: Awaited<ReturnType<typeof readProjectWorkflowSelection>> = null;
  let selectionIssue: string | null = null;
  try {
    selectedWorkflow = await readProjectWorkflowSelection(projectPath);
  } catch (error) {
    selectionIssue = (error as Error).message;
  }

  let workflow: WorkflowSnapshot;
  let integrations: IntegrationSnapshot[] = [];
  let integrationChecks: ProjectDiagnostic[] = [];
  let resolveSource: (source: string) => Promise<ResolvedWorkflow | null> = async () => null;

  try {
    const environment = await loadProjectIntegrationEnvironment(projectPath);
    const configured = await resolveConfiguredProjectWorkflow(projectPath, environment.registry);
    if (!configured) {
      workflow = {
        ...EMPTY_WORKFLOW,
        issues: [localize(language, '.smart/setup.yaml is missing', '缺少 .smart/setup.yaml')],
      };
    } else {
      const resolution = configured.resolution;
      workflow = {
        configured: true,
        source: configured.selection.source,
        supportLevel: resolution.workflow.supportLevel,
        configuredDigest: configured.selection.resolvedDigest,
        resolvedDigest: resolution.workflow.digest,
        valid: resolution.valid,
        drifted: configured.selection.resolvedDigest !== resolution.workflow.digest,
        issues: resolution.issues.map((issue) => issue.message),
      };
      const inspected = await Promise.all(
        Object.keys(resolution.workflow.integrations).map((id) =>
          inspectIntegration(
            environment.runtimes.require(id),
            projectPath,
            platformInspection.platformIds,
            language,
          ),
        ),
      );
      integrations = inspected.map((item) => item.snapshot);
      integrationChecks = inspected.map((item) => item.diagnostic);
    }
    const cache = new Map<string, Promise<ResolvedWorkflow | null>>();
    resolveSource = (source: string) => {
      let pending = cache.get(source);
      if (!pending) {
        pending = resolveProjectWorkflow(projectPath, source, environment.registry)
          .then((resolution) => (resolution.valid ? resolution.workflow : null))
          .catch(() => null);
        cache.set(source, pending);
      }
      return pending;
    };
  } catch (error) {
    workflow = {
      ...EMPTY_WORKFLOW,
      configured: setupExists,
      source: selectedWorkflow?.source ?? null,
      supportLevel: selectedWorkflow?.supportLevel ?? null,
      configuredDigest: selectedWorkflow?.resolvedDigest ?? null,
      issues: [selectionIssue ?? (error as Error).message],
    };
  }
  const workflowCheck = workflowDiagnostic(workflow, language);

  const inspectedRuns = await Promise.all(
    changeNames.map((name) => inspectRun(projectPath, name, resolveSource, language)),
  );
  const runs = inspectedRuns
    .map((item) => item.run)
    .sort((left, right) => (right.updatedAt ?? '').localeCompare(left.updatedAt ?? ''));
  const diagnostics = [
    ...layoutChecks,
    configuration.diagnostic,
    workflowCheck,
    ...platformInspection.diagnostics,
    ...integrationChecks,
    ...inspectedRuns.flatMap((item) => item.diagnostics),
  ];
  const initialized = setupExists;
  const summary = {
    active: runs.filter((run) => run.status === 'active').length,
    blocked: runs.filter((run) => run.status === 'blocked').length,
    completed: runs.filter((run) => run.status === 'completed').length,
    invalid: runs.filter((run) => run.status === 'invalid').length,
    warnings: diagnostics.filter((item) => item.status === 'warn').length,
    failures: diagnostics.filter((item) => item.status === 'fail').length,
  };

  return {
    version: 1,
    projectPath,
    generatedAt: new Date().toISOString(),
    language,
    initialized,
    health: projectHealth(initialized, diagnostics, runs),
    summary,
    workflow,
    platforms: platformInspection.platforms,
    integrations,
    runs,
    diagnostics,
    git: collectGitSnapshot(projectPath),
  };
}
