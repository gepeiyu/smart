import os from 'os';
import path from 'path';
import { checkbox, select } from '@inquirer/prompts';
import { detectPlatforms, getBaseDir, hasSmartSkills, type InstallScope } from '../core/detect.js';
import { PLATFORMS, type Platform } from '../core/platforms.js';
import {
  copySmartRulesForPlatform,
  copySmartSkillsForPlatform,
  createWorkingDirs,
  installSmartHooksForPlatform,
  type LanguageConfig,
} from '../core/skills.js';
import { printVersionInfo } from '../core/version.js';
import { loadProjectIntegrationEnvironment } from '../integrations/environment.js';
import {
  type IntegrationDetection,
  type IntegrationInstallStatus,
  type IntegrationRuntime,
} from '../integrations/runtime.js';
import { listOfficialWorkflows } from '../workflows/catalog.js';
import {
  listProjectWorkflowDefinitions,
  resolveProjectWorkflow,
  setProjectWorkflow,
} from '../workflows/store.js';
import type { WorkflowResolution } from '../workflows/types.js';
import { t, type TranslationKey } from './i18n.js';
import { platformSelectPrompt } from './platform-select-prompt.js';

type InitOptions = {
  yes?: boolean;
  skipExisting?: boolean;
  overwrite?: boolean;
  json?: boolean;
  scope?: InstallScope;
  language?: string;
  deps?: boolean;
  preset?: string;
  workflow?: string;
};
type ComponentAction = 'overwrite' | 'skip' | 'install';
type BulkOverwriteChoice = 'overwrite-all' | 'skip-all' | 'choose';

interface PlatformResult {
  platform: Platform;
  smart: IntegrationInstallStatus;
  integrations: Record<string, IntegrationInstallStatus>;
}

interface PlatformPlan {
  platform: Platform;
  smartAction: ComponentAction;
  integrationActions: Record<string, ComponentAction>;
}

const LANGUAGES: LanguageConfig[] = [
  { id: 'en', name: 'English', skillsDir: 'skills' },
  { id: 'zh', name: '中文', skillsDir: 'skills-zh' },
];

async function selectScope(options: InitOptions, lang: string): Promise<InstallScope> {
  if (options.scope) return options.scope;
  if (options.yes) return 'project';
  return select({
    message: t(lang, 'installScope'),
    choices: [
      { name: t(lang, 'scopeProject'), value: 'project' as const },
      { name: t(lang, 'scopeGlobal'), value: 'global' as const },
    ],
  });
}

async function selectLanguage(options: InitOptions): Promise<LanguageConfig> {
  if (options.language)
    return LANGUAGES.find((language) => language.id === options.language) ?? LANGUAGES[0];
  if (options.yes) return LANGUAGES[0];
  const languageId = await select({
    message: t('en', 'languagePrompt'),
    choices: LANGUAGES.map((language) => ({ name: language.name, value: language.id })),
  });
  return LANGUAGES.find((language) => language.id === languageId) ?? LANGUAGES[0];
}

async function selectWorkflowReference(projectPath: string, options: InitOptions): Promise<string> {
  if (options.preset && options.workflow) {
    throw new Error('Use either --preset or --workflow, not both');
  }
  if (options.workflow) return options.workflow;
  if (options.preset)
    return options.preset.startsWith('official/') ? options.preset : `official/${options.preset}`;
  if (options.yes) return 'official/full';

  const officialChoices = listOfficialWorkflows().map((workflow) => ({
    name: `${workflow.displayName ?? workflow.id} (official certified)`,
    value: `official/${workflow.id}`,
  }));
  const projectChoices = (await listProjectWorkflowDefinitions(projectPath)).map((item) => ({
    name: `${item.definition.displayName ?? item.definition.id} (custom)`,
    value: item.source,
  }));
  return select({
    message: 'Select workflow',
    choices: [...officialChoices, ...projectChoices],
  });
}

async function selectPlatforms(
  detected: Set<string>,
  options: InitOptions,
  lang: string,
): Promise<string[]> {
  const choices = PLATFORMS.map((platform) => ({
    name: `${platform.name}${detected.has(platform.id) ? ` (${t(lang, 'detected')})` : ''}`,
    value: platform.id,
    checked: detected.has(platform.id),
  }));
  if (options.yes) return [...detected];
  return platformSelectPrompt({
    message: t(lang, 'selectPlatforms'),
    instructions: [
      ...(detected.size === 0 ? [t(lang, 'selectPlatformsNoDetected')] : []),
      t(lang, 'selectPlatformsHelp'),
    ],
    choices,
    validate: (items) => items.length > 0 || t(lang, 'selectPlatformsRequired'),
  });
}

function resolveAction(hasExisting: boolean, options: InitOptions): ComponentAction {
  if (!hasExisting) return 'install';
  if (options.overwrite) return 'overwrite';
  if (options.skipExisting || options.yes) return 'skip';
  return 'install';
}

async function promptOverwriteChoice(
  componentName: string,
  platformName: string,
  lang: string,
): Promise<'overwrite' | 'skip'> {
  return select({
    message: `${componentName} ${t(lang, 'alreadyExists')} ${platformName}. ${t(lang, 'overwriteChoice')}`,
    choices: [
      { name: t(lang, 'overwrite'), value: 'overwrite' as const },
      { name: t(lang, 'skip'), value: 'skip' as const },
    ],
  });
}

async function promptBulkOverwriteChoice(
  platformName: string,
  components: string[],
  lang: string,
): Promise<BulkOverwriteChoice> {
  return select({
    message: `${platformName} ${t(lang, 'bulkOverwrite')} ${components.join(', ')}. ${t(lang, 'overwriteChoice')}`,
    choices: [
      { name: t(lang, 'overwriteAll'), value: 'overwrite-all' as const },
      { name: t(lang, 'skipAll'), value: 'skip-all' as const },
      { name: t(lang, 'choosePer'), value: 'choose' as const },
    ],
  });
}

function assertValidWorkflow(reference: string, resolution: WorkflowResolution): void {
  if (resolution.valid) return;
  const details = resolution.issues
    .filter((issue) => issue.severity === 'error')
    .map((issue) => `${issue.path}: ${issue.message}`)
    .join('\n');
  throw new Error(`Workflow ${reference} is invalid${details ? `:\n${details}` : ''}`);
}

async function detectIntegrations(
  runtimes: IntegrationRuntime[],
  projectPath: string,
  baseDir: string,
  scope: InstallScope,
  platformIds: string[],
): Promise<Record<string, IntegrationDetection>> {
  const entries = await Promise.all(
    runtimes.map(
      async (runtime) =>
        [
          runtime.manifest.id,
          await runtime.detect({ projectPath, baseDir, scope, platformIds }),
        ] as const,
    ),
  );
  return Object.fromEntries(entries);
}

async function buildPlans(
  platforms: Platform[],
  runtimes: IntegrationRuntime[],
  detections: Record<string, IntegrationDetection>,
  baseDir: string,
  scope: InstallScope,
  options: InitOptions,
  lang: string,
): Promise<PlatformPlan[]> {
  const plans: PlatformPlan[] = [];
  for (const platform of platforms) {
    const smartExists = await hasSmartSkills(platform, baseDir, scope);
    let smartAction = resolveAction(smartExists, options);
    const integrationActions = Object.fromEntries(
      runtimes.map((runtime) => [
        runtime.manifest.id,
        resolveAction(
          runtime.manifest.management === 'user'
            ? false
            : (detections[runtime.manifest.id].installedOnPlatforms[platform.id] ?? false),
          options,
        ),
      ]),
    ) as Record<string, ComponentAction>;

    if (!options.yes) {
      const existing = [
        ...(smartExists && smartAction === 'install' ? ['Smart'] : []),
        ...runtimes
          .filter(
            (runtime) =>
              detections[runtime.manifest.id].installedOnPlatforms[platform.id] &&
              integrationActions[runtime.manifest.id] === 'install',
          )
          .map((runtime) => runtime.manifest.displayName),
      ];
      if (existing.length > 1) {
        const choice = await promptBulkOverwriteChoice(platform.name, existing, lang);
        if (choice !== 'choose') {
          const action = choice === 'overwrite-all' ? 'overwrite' : 'skip';
          if (smartExists && smartAction === 'install') smartAction = action;
          for (const runtime of runtimes) {
            if (
              detections[runtime.manifest.id].installedOnPlatforms[platform.id] &&
              integrationActions[runtime.manifest.id] === 'install'
            ) {
              integrationActions[runtime.manifest.id] = action;
            }
          }
        }
      }
      if (smartExists && smartAction === 'install') {
        smartAction = await promptOverwriteChoice('Smart', platform.name, lang);
      }
      for (const runtime of runtimes) {
        const id = runtime.manifest.id;
        if (
          detections[id].installedOnPlatforms[platform.id] &&
          integrationActions[id] === 'install'
        ) {
          integrationActions[id] = await promptOverwriteChoice(
            runtime.manifest.displayName,
            platform.name,
            lang,
          );
        }
      }
    }
    plans.push({ platform, smartAction, integrationActions });
  }
  return plans;
}

async function selectDependencies(
  runtimes: IntegrationRuntime[],
  detections: Record<string, IntegrationDetection>,
  options: InitOptions,
): Promise<Set<string>> {
  if (options.deps === false) return new Set();
  if (options.yes) {
    return new Set(
      runtimes
        .filter((runtime) => !detections[runtime.manifest.id].dependencyAvailable)
        .map((runtime) => runtime.manifest.id),
    );
  }
  const selected = await checkbox({
    message: 'Install workflow dependencies',
    choices: runtimes.map((runtime) => {
      const installed = detections[runtime.manifest.id].dependencyAvailable;
      return {
        name: `${runtime.manifest.displayName}${installed ? ' (available)' : ''}`,
        value: runtime.manifest.id,
        checked: !installed,
      };
    }),
  });
  return new Set(selected as string[]);
}

function displaySummary(
  results: PlatformResult[],
  runtimes: IntegrationRuntime[],
  scope: InstallScope,
  lang: string,
  workflow: WorkflowResolution['workflow'],
): void {
  const scopeLabel = scope === 'global' ? os.homedir() : 'project';
  console.log(`\n  ${t(lang, 'setupComplete')} (scope: ${scopeLabel})`);
  console.log(
    `  Workflow: ${workflow.displayName ?? workflow.id} [${workflow.supportLevel}] ${workflow.digest.slice(0, 12)}`,
  );
  for (const result of results) {
    const integrations = runtimes
      .map(
        (runtime) => `${runtime.manifest.displayName}=${result.integrations[runtime.manifest.id]}`,
      )
      .join(', ');
    console.log(`  ${result.platform.name}: Smart=${result.smart}, ${integrations}`);
  }
  if (scope === 'project') console.log(`\n  ${t(lang, 'workingDirs')}`);
  console.log(`\n  ${t(lang, 'getStarted')}`);
  console.log(`    ${t(lang, 'getStartedSmart')}`);
  console.log(`    ${t(lang, 'getStartedBugfix')}`);
  console.log(`    ${t(lang, 'getStartedQuick')}\n`);
}

export async function initCommand(targetPath: string, options: InitOptions = {}): Promise<void> {
  const projectPath = path.resolve(targetPath);
  const log = options.json ? () => undefined : console.log;
  if (!options.json) await printVersionInfo(log);

  const language = await selectLanguage(options);
  const lang = language.id;
  const workflowReference = await selectWorkflowReference(projectPath, options);
  const integrationEnvironment = await loadProjectIntegrationEnvironment(projectPath);
  const workflowResolution = await resolveProjectWorkflow(
    projectPath,
    workflowReference,
    integrationEnvironment.registry,
  );
  assertValidWorkflow(workflowReference, workflowResolution);
  const runtimes = Object.keys(workflowResolution.workflow.integrations).map((id) =>
    integrationEnvironment.runtimes.require(id),
  );

  log(`  ${t(lang, 'settingUp')} ${projectPath}`);
  log(
    `  Workflow: ${workflowResolution.workflow.displayName ?? workflowResolution.workflow.id} [${workflowResolution.workflow.supportLevel}]\n`,
  );

  const detected = await detectPlatforms(projectPath);
  const detectedIds = new Set(detected.map((platform) => platform.id));
  const scope = await selectScope(options, lang);
  if (scope === 'global' && runtimes.some((runtime) => runtime.manifest.management === 'user')) {
    throw new Error('Local trusted integrations are project-scoped and cannot use global init');
  }
  const selectedPlatformIds = await selectPlatforms(detectedIds, options, lang);
  if (selectedPlatformIds.length === 0) {
    if (options.json) {
      console.log(
        JSON.stringify(
          {
            projectPath,
            scope,
            language: language.id,
            workflow: workflowReference,
            selectedPlatforms: [],
            results: [],
          },
          null,
          2,
        ),
      );
      return;
    }
    log(`\n  ${t(lang, 'noPlatforms')}\n`);
    return;
  }

  const platforms = PLATFORMS.filter((platform) => selectedPlatformIds.includes(platform.id));
  const baseDir = getBaseDir(projectPath, scope);
  const detections = await detectIntegrations(
    runtimes,
    projectPath,
    baseDir,
    scope,
    selectedPlatformIds,
  );
  const plans = await buildPlans(platforms, runtimes, detections, baseDir, scope, options, lang);
  const dependencies = await selectDependencies(runtimes, detections, options);

  const integrationStatuses: Record<string, Record<string, IntegrationInstallStatus>> = {};
  for (const runtime of runtimes) {
    const id = runtime.manifest.id;
    const platformIds = plans
      .filter((plan) => plan.integrationActions[id] !== 'skip')
      .map((plan) => plan.platform.id);
    integrationStatuses[id] = Object.fromEntries(
      selectedPlatformIds.map((platformId) => [platformId, 'skipped']),
    );
    if (platformIds.length === 0) {
      log(`  ${runtime.manifest.displayName}: skipped`);
      continue;
    }
    log(`\n  Installing ${runtime.manifest.displayName}: ${platformIds.join(', ')}`);
    const result = await runtime.install({
      projectPath,
      baseDir,
      scope,
      platformIds,
      installDependency: dependencies.has(id),
    });
    Object.assign(integrationStatuses[id], result.platformStatuses);
    log(
      `  ${runtime.manifest.displayName}: ${result.status}${result.message ? ` (${result.message})` : ''}`,
    );
  }

  const results: PlatformResult[] = [];
  for (const plan of plans) {
    let smartStatus: IntegrationInstallStatus = 'skipped';
    if (plan.smartAction !== 'skip') {
      const { copied } = await copySmartSkillsForPlatform(
        baseDir,
        plan.platform,
        plan.smartAction === 'overwrite',
        language.skillsDir,
        scope,
      );
      smartStatus = copied > 0 ? 'installed' : 'skipped';
      log(`  Smart -> ${plan.platform.name}: ${smartStatus} (${copied} files)`);
      const { copied: ruleCopied } = await copySmartRulesForPlatform(
        baseDir,
        plan.platform,
        plan.smartAction === 'overwrite',
        scope,
      );
      if (ruleCopied > 0)
        log(`  Smart rules -> ${plan.platform.name}: ${ruleCopied} ${t(lang, 'rulesInstalled')}`);
      if (plan.platform.supportsHooks) {
        const { installed, reason } = await installSmartHooksForPlatform(
          baseDir,
          plan.platform,
          scope,
        );
        if (installed) log(`  Smart hooks -> ${plan.platform.name}: ${t(lang, 'hooksInstalled')}`);
        else if (reason)
          log(`  Smart hooks -> ${plan.platform.name}: ${t(lang, 'hooksSkipped')} (${reason})`);
      }
    }
    results.push({
      platform: plan.platform,
      smart: smartStatus,
      integrations: Object.fromEntries(
        runtimes.map((runtime) => [
          runtime.manifest.id,
          integrationStatuses[runtime.manifest.id][plan.platform.id] ?? 'skipped',
        ]),
      ),
    });
  }

  if (scope === 'project') {
    await createWorkingDirs(projectPath, language.id, selectedPlatformIds);
    await setProjectWorkflow(projectPath, workflowReference, workflowResolution);
  }

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          projectPath,
          scope,
          language: language.id,
          workflow: {
            source: workflowReference,
            id: workflowResolution.workflow.id,
            supportLevel: workflowResolution.workflow.supportLevel,
            digest: workflowResolution.workflow.digest,
          },
          selectedPlatforms: selectedPlatformIds,
          results: results.map((result) => ({
            platform: result.platform.id,
            platformName: result.platform.name,
            smart: result.smart,
            integrations: result.integrations,
          })),
          workingDirsCreated: scope === 'project',
        },
        null,
        2,
      ),
    );
    return;
  }
  displaySummary(results, runtimes, scope, lang, workflowResolution.workflow);
}

export type { TranslationKey };
