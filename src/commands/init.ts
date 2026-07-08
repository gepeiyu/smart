import path from 'path';
import os from 'os';
import { checkbox, select } from '@inquirer/prompts';
import { platformSelectPrompt } from './platform-select-prompt.js';
import { PLATFORMS, getPlatformSkillsDir, type Platform } from '../core/platforms.js';
import { detectPlatforms, checkInstalledSkills, getBaseDir, type InstallScope } from '../core/detect.js';
import {
  copySmartSkillsForPlatform, copySmartRulesForPlatform, installSmartHooksForPlatform, createWorkingDirs,
  type LanguageConfig,
} from '../core/skills.js';
import { installOpenSpec, resolveOpenSpecCommand } from '../core/openspec.js';
import { installSuperpowersForPlatforms } from '../core/superpowers.js';
import { hasCodegraphProjectIndex, installCodegraph, resolveCodegraphCommand } from '../core/codegraph.js';
import { printVersionInfo } from '../core/version.js';
import { t, type TranslationKey } from './i18n.js';

type InitOptions = { yes?: boolean; skipExisting?: boolean; overwrite?: boolean; json?: boolean; scope?: InstallScope; language?: string; deps?: boolean };
type InstallStatus = 'installed' | 'skipped' | 'failed';
type ComponentAction = 'overwrite' | 'skip' | 'install';
type BulkOverwriteChoice = 'overwrite-all' | 'skip-all' | 'choose';

interface PlatformResult {
  platform: Platform; openspec: InstallStatus; superpowers: InstallStatus; smart: InstallStatus; codegraph: InstallStatus;
}

type ComponentPlan = { osAction: ComponentAction; spAction: ComponentAction; smAction: ComponentAction };

const LANGUAGES: LanguageConfig[] = [
  { id: 'en', name: 'English', skillsDir: 'skills' },
  { id: 'zh', name: '中文', skillsDir: 'skills-zh' },
];

async function selectScope(options: InitOptions, lang: string): Promise<InstallScope> {
  if (options.scope) return options.scope;
  if (options.yes) return 'project';
  return select({ message: t(lang, 'installScope'), choices: [
    { name: t(lang, 'scopeProject'), value: 'project' as const },
    { name: t(lang, 'scopeGlobal'), value: 'global' as const },
  ]});
}

async function selectLanguage(options: InitOptions): Promise<LanguageConfig> {
  if (options.language) return LANGUAGES.find((l) => l.id === options.language) ?? LANGUAGES[0];
  if (options.yes) return LANGUAGES[0];
  const langId = await select({ message: t('en', 'languagePrompt'), choices: LANGUAGES.map((lang) => ({ name: lang.name, value: lang.id })) });
  return LANGUAGES.find((l) => l.id === langId) ?? LANGUAGES[0];
}

async function selectPlatforms(detected: Set<string>, options: InitOptions, lang: string): Promise<string[]> {
  const choices = PLATFORMS.map((p) => ({
    name: `${p.name}${detected.has(p.id) ? ` (${t(lang, 'detected')})` : ''}`,
    value: p.id, checked: detected.has(p.id),
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

async function promptOverwriteChoice(componentName: string, platformName: string, lang: string): Promise<'overwrite' | 'skip'> {
  return select({ message: `${componentName} ${t(lang, 'alreadyExists')} ${platformName}. ${t(lang, 'overwriteChoice')}`, choices: [
    { name: t(lang, 'overwrite'), value: 'overwrite' as const },
    { name: t(lang, 'skip'), value: 'skip' as const },
  ]});
}

async function promptBulkOverwriteChoice(platformName: string, components: string[], lang: string): Promise<BulkOverwriteChoice> {
  return select({ message: `${platformName} ${t(lang, 'bulkOverwrite')} ${components.join(', ')}. ${t(lang, 'overwriteChoice')}`, choices: [
    { name: t(lang, 'overwriteAll'), value: 'overwrite-all' as const },
    { name: t(lang, 'skipAll'), value: 'skip-all' as const },
    { name: t(lang, 'choosePer'), value: 'choose' as const },
  ]});
}

function applyBulkOverwriteChoice<T extends ComponentPlan>(plan: T, choice: Exclude<BulkOverwriteChoice, 'choose'>, hasExisting?: { os?: boolean; sp?: boolean; sm?: boolean }): T {
  const action = choice === 'overwrite-all' ? 'overwrite' : 'skip';
  const shouldApply = (actionState: ComponentAction, exists?: boolean) => actionState === 'install' && (hasExisting === undefined || exists === true);
  return { ...plan, osAction: shouldApply(plan.osAction, hasExisting?.os) ? action : plan.osAction, spAction: shouldApply(plan.spAction, hasExisting?.sp) ? action : plan.spAction, smAction: shouldApply(plan.smAction, hasExisting?.sm) ? action : plan.smAction };
}

function resolveAction(hasExisting: boolean, options: InitOptions): 'overwrite' | 'skip' | 'install' {
  if (!hasExisting) return 'install';
  if (options.overwrite) return 'overwrite';
  if (options.skipExisting) return 'skip';
  if (options.yes) return 'skip';
  return 'install';
}

type NpmDepId = 'openspec' | 'superpowers' | 'codegraph';
interface NpmDepState { id: NpmDepId; installed: boolean; }

async function selectNpmDeps(projectPath: string, spPlatformIds: string[], options: InitOptions, lang: string): Promise<Set<NpmDepId>> {
  if (options.deps === false) return new Set();

  const openSpecInstalled = resolveOpenSpecCommand(projectPath) !== null;
  const codegraphInstalled = (await hasCodegraphProjectIndex(projectPath)) || resolveCodegraphCommand(projectPath) !== null;
  const superpowersInstalled = spPlatformIds.length === 0;
  const states: NpmDepState[] = [
    { id: 'openspec', installed: openSpecInstalled },
    { id: 'superpowers', installed: Boolean(superpowersInstalled) },
    { id: 'codegraph', installed: codegraphInstalled },
  ];
  const depLabel: Record<NpmDepId, (installed: boolean) => string> = {
    openspec: (installed) => installed ? t(lang, 'npmDepOpenSpecInstalled') : t(lang, 'npmDepOpenSpec'),
    superpowers: (installed) => installed ? t(lang, 'npmDepSuperpowersInstalled') : t(lang, 'npmDepSuperpowers'),
    codegraph: (installed) => installed ? t(lang, 'npmDepCodegraphInstalled') : t(lang, 'npmDepCodegraph'),
  };
  const depHint: Partial<Record<NpmDepId, string>> = { superpowers: t(lang, 'npmDepSuperpowersHint') };
  const choices = states.map(({ id, installed }) => {
    const choice: { name: string; value: NpmDepId; checked: boolean; description?: string } = {
      name: depLabel[id](installed), value: id, checked: !installed,
    };
    if (depHint[id]) choice.description = depHint[id];
    return choice;
  });
  if (options.yes) return new Set(states.filter((s) => !s.installed).map((s) => s.id));
  const selected = await checkbox({ message: t(lang, 'selectNpmDeps'), choices });
  return new Set(selected as NpmDepId[]);
}

function displaySummary(results: PlatformResult[], scope: InstallScope, lang: string): void {
  const scopeLabel = scope === 'global' ? os.homedir() : 'project';
  const componentStatuses: Array<[keyof Omit<PlatformResult, 'platform'>, string]> = [
    ['openspec', 'OpenSpec'], ['superpowers', 'Superpowers'], ['smart', 'Smart'], ['codegraph', 'CodeGraph'],
  ];
  const hasFailure = (result: PlatformResult) => componentStatuses.some(([key]) => result[key] === 'failed');
  const hasInstall = (result: PlatformResult) => componentStatuses.some(([key]) => result[key] === 'installed');
  const failedDetails = (result: PlatformResult) => componentStatuses.filter(([key]) => result[key] === 'failed').map(([, label]) => `${label} ${t(lang, 'failedStatus')}`).join(', ');

  console.log(`\n  ${t(lang, 'setupComplete')} (scope: ${scopeLabel})\n`);
  const failed = results.filter(hasFailure);
  const installed = results.filter((r) => !hasFailure(r) && hasInstall(r));
  const skipped = results.filter((r) => componentStatuses.every(([key]) => r[key] === 'skipped'));

  if (installed.length > 0) {
    console.log(`  ${t(lang, 'installed')}`);
    for (const r of installed) console.log(`    ${r.platform.name} -> ${getPlatformSkillsDir(r.platform, scope)}/skills/`);
  }
  if (skipped.length > 0) console.log(`  ${t(lang, 'skippedLabel')} ${skipped.map((r) => r.platform.name).join(', ')}`);
  if (failed.length > 0) {
    console.log(`  ${t(lang, 'failedLabel')}`);
    for (const r of failed) console.log(`    ${r.platform.name} (${failedDetails(r)})`);
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
  log(`  ${t(lang, 'settingUp')} ${projectPath}\n`);

  const detected = await detectPlatforms(projectPath);
  const detectedIds = new Set(detected.map(p => p.id));
  const scope = await selectScope(options, lang);
  const selectedPlatformIds = await selectPlatforms(detectedIds, options, lang);
  if (selectedPlatformIds.length === 0) {
    if (options.json) { console.log(JSON.stringify({ projectPath, scope, language: language.id, selectedPlatforms: [], results: [] }, null, 2)); return; }
    log(`\n  ${t(lang, 'noPlatforms')}\n`); return;
  }

  const selectedPlatforms = PLATFORMS.filter((p) => selectedPlatformIds.includes(p.id));
  const baseDir = getBaseDir(projectPath, scope);
  type PlatformPlan = ComponentPlan & { platform: Platform; hasOS: boolean; hasSP: boolean; hasSM: boolean };
  const plans: PlatformPlan[] = [];

  for (const platform of selectedPlatforms) {
    const installed = await checkInstalledSkills(platform, baseDir);
    const hasOS = installed.openspec;
    const hasSP = installed.superpowers;
    const hasSM = installed.smart;
    let osAction = resolveAction(hasOS, options);
    let spAction = resolveAction(hasSP, options);
    let smAction = resolveAction(hasSM, options);

    if (!options.yes) {
      const existingComponents = [
        hasOS && osAction === 'install' ? 'OpenSpec' : null,
        hasSP && spAction === 'install' ? 'Superpowers' : null,
        hasSM && smAction === 'install' ? 'Smart' : null,
      ].filter((component): component is string => Boolean(component));
      if (existingComponents.length > 1) {
        const bulkChoice = await promptBulkOverwriteChoice(platform.name, existingComponents, lang);
        if (bulkChoice !== 'choose') ({ osAction, spAction, smAction } = applyBulkOverwriteChoice({ osAction, spAction, smAction }, bulkChoice, { os: hasOS, sp: hasSP, sm: hasSM }));
      }
      if (osAction === 'install' && hasOS) osAction = await promptOverwriteChoice('OpenSpec', platform.name, lang);
      if (spAction === 'install' && hasSP) spAction = await promptOverwriteChoice('Superpowers', platform.name, lang);
      if (smAction === 'install' && hasSM) smAction = await promptOverwriteChoice('Smart', platform.name, lang);
    }
    plans.push({ platform, osAction, spAction, smAction, hasOS, hasSP, hasSM });
  }

  const osToolIds = plans.filter((p) => p.osAction !== 'skip').map((p) => p.platform.openspecToolId);
  const spPlatformIds = plans.filter((p) => p.spAction !== 'skip').map((p) => p.platform.id);
  const selectedNpmDeps = await selectNpmDeps(projectPath, spPlatformIds, options, lang);
  const shouldInstallOpenSpecCli = selectedNpmDeps.has('openspec');
  const shouldInstallSuperpowers = selectedNpmDeps.has('superpowers');
  const shouldInstallCodegraphCli = selectedNpmDeps.has('codegraph');

  let osGlobalStatus: InstallStatus = 'skipped';
  if (osToolIds.length > 0) {
    log(`\n  ${t(lang, 'installingOS')} ${osToolIds.join(', ')}`);
    osGlobalStatus = await installOpenSpec(projectPath, osToolIds, scope, shouldInstallOpenSpecCli);
    if (osGlobalStatus === 'skipped' && !shouldInstallOpenSpecCli) log(`  OpenSpec: ${t(lang, 'osSkippedNoCli')}`);
    else log(`  OpenSpec: ${osGlobalStatus}`);
  } else { log(`\n  OpenSpec: ${t(lang, 'allSkipped')}`); }

  let spGlobalStatus: InstallStatus = 'skipped';
  if (spPlatformIds.length > 0) {
    if (!shouldInstallSuperpowers) log(`\n  Superpowers: ${t(lang, 'spSkippedByUser')}`);
    else { log(`\n  ${t(lang, 'installingSP')} ${spPlatformIds.join(', ')}`); spGlobalStatus = await installSuperpowersForPlatforms(projectPath, scope, spPlatformIds, true); log(`  Superpowers: ${spGlobalStatus}`); }
  } else { log(`\n  Superpowers: ${t(lang, 'allSkipped')}`); }

  const results: PlatformResult[] = [];
  for (const plan of plans) {
    const { platform, smAction } = plan;
    const platformSkillsDir = getPlatformSkillsDir(platform, scope);
    const skillsPath = `${scope === 'global' ? '~/' : ''}${platformSkillsDir}/skills/`;
    let smStatus: InstallStatus = 'skipped';
    if (smAction !== 'skip') {
      const { copied } = await copySmartSkillsForPlatform(baseDir, platform, smAction === 'overwrite', language.skillsDir, scope);
      smStatus = copied > 0 ? 'installed' : 'skipped';
      log(`  Smart -> ${platform.name}: ${smStatus} (${copied} files) -> ${skillsPath}`);
    } else { log(`  Smart -> ${platform.name}: skipped (${t(lang, 'alreadyExists')})`); }

    if (smAction !== 'skip') {
      const { copied: ruleCopied } = await copySmartRulesForPlatform(baseDir, platform, smAction === 'overwrite', scope);
      if (ruleCopied > 0) log(`  Smart rules -> ${platform.name}: ${ruleCopied} ${t(lang, 'rulesInstalled')}`);
    }
    if (smAction !== 'skip' && platform.supportsHooks) {
      const { installed, reason } = await installSmartHooksForPlatform(baseDir, platform, scope);
      if (installed) log(`  Smart hooks -> ${platform.name}: ${t(lang, 'hooksInstalled')}`);
      else if (reason) log(`  Smart hooks -> ${platform.name}: ${t(lang, 'hooksSkipped')} (${reason})`);
    }
    results.push({ platform, openspec: osToolIds.includes(platform.openspecToolId) ? osGlobalStatus : 'skipped', superpowers: plan.spAction !== 'skip' ? spGlobalStatus : 'skipped', smart: smStatus, codegraph: 'skipped' });
  }

  const codegraphAlreadyIndexed = await hasCodegraphProjectIndex(projectPath);
  const shouldInstallCodegraph = !options.json && !codegraphAlreadyIndexed && shouldInstallCodegraphCli;
  if (shouldInstallCodegraph) {
    log(`\n  ${t(lang, 'installingCG')}`);
    const codegraphInstalled = installCodegraph(scope ?? 'project', projectPath);
    const cgGlobalStatus: InstallStatus = codegraphInstalled ? 'installed' : 'failed';
    log(`  CodeGraph: ${cgGlobalStatus}`);
    for (const r of results) r.codegraph = cgGlobalStatus;
  } else if (!options.json && codegraphAlreadyIndexed) { log('\n  CodeGraph: skipped (existing .codegraph index detected)'); }
  else if (!options.json) { log(`\n  CodeGraph: ${t(lang, 'cgSkippedByUser')}`); }

  if (scope === 'project') await createWorkingDirs(projectPath);

  if (options.json) {
    console.log(JSON.stringify({ projectPath, scope, language: language.id, selectedPlatforms: selectedPlatformIds, results: results.map((result) => ({ platform: result.platform.id, platformName: result.platform.name, openspec: result.openspec, superpowers: result.superpowers, smart: result.smart, codegraph: result.codegraph })), workingDirsCreated: scope === 'project' }, null, 2));
    return;
  }
  displaySummary(results, scope, lang);
}

export { applyBulkOverwriteChoice };
export type { TranslationKey };
