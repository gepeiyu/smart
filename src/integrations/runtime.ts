import path from 'path';
import {
  hasCodegraphProjectIndex,
  initializeCodegraph,
  installCodegraph,
  resolveCodegraphCommand,
} from '../core/codegraph.js';
import { getPlatformSkillsDir, PLATFORMS } from '../core/platforms.js';
import { installOpenSpec, resolveOpenSpecCommand } from '../core/openspec.js';
import { installSuperpowersForPlatforms } from '../core/superpowers.js';
import type { InstallScope } from '../core/types.js';
import { readDir } from '../utils/file-system.js';
import { OFFICIAL_INTEGRATIONS } from './catalog.js';
import type { IntegrationManifest } from './types.js';

export type IntegrationInstallStatus = 'installed' | 'adopted' | 'skipped' | 'failed';

export interface IntegrationRuntimeContext {
  projectPath: string;
  baseDir: string;
  scope: InstallScope;
  platformIds: string[];
}

export interface IntegrationInstallContext extends IntegrationRuntimeContext {
  installDependency: boolean;
}

export interface IntegrationDetection {
  dependencyAvailable: boolean;
  installedOnPlatforms: Record<string, boolean>;
}

export interface IntegrationInstallResult {
  status: IntegrationInstallStatus;
  platformStatuses: Record<string, IntegrationInstallStatus>;
  message?: string;
}

export interface IntegrationRuntime {
  manifest: IntegrationManifest;
  detect(context: IntegrationRuntimeContext): Promise<IntegrationDetection>;
  install(context: IntegrationInstallContext): Promise<IntegrationInstallResult>;
}

function statuses(
  platformIds: string[],
  status: IntegrationInstallStatus,
): Record<string, IntegrationInstallStatus> {
  return Object.fromEntries(platformIds.map((platformId) => [platformId, status]));
}

async function detectSkillIntegration(
  context: IntegrationRuntimeContext,
  matcher: (entry: string) => boolean,
): Promise<Record<string, boolean>> {
  const result: Record<string, boolean> = {};
  for (const platformId of context.platformIds) {
    const platform = PLATFORMS.find((candidate) => candidate.id === platformId);
    if (!platform) {
      result[platformId] = false;
      continue;
    }
    const skillsRoot = path.join(
      context.baseDir,
      getPlatformSkillsDir(platform, context.scope),
      'skills',
    );
    result[platformId] = (await readDir(skillsRoot)).some((entry) => matcher(entry.toLowerCase()));
  }
  return result;
}

function manifest(id: string): IntegrationManifest {
  const value = OFFICIAL_INTEGRATIONS.find((candidate) => candidate.id === id);
  if (!value) throw new Error(`Official integration manifest not found: ${id}`);
  return value;
}

const openspecRuntime: IntegrationRuntime = {
  manifest: manifest('openspec'),
  async detect(context) {
    return {
      dependencyAvailable: resolveOpenSpecCommand(context.projectPath) !== null,
      installedOnPlatforms: await detectSkillIntegration(context, (entry) =>
        entry.includes('openspec'),
      ),
    };
  },
  async install(context) {
    const toolIds = context.platformIds.map((platformId) => {
      const toolId = this.manifest.platformMappings[platformId]?.toolId;
      if (!toolId) throw new Error(`OpenSpec does not support platform: ${platformId}`);
      return toolId;
    });
    const status = await installOpenSpec(
      context.projectPath,
      toolIds,
      context.scope,
      context.installDependency,
    );
    return { status, platformStatuses: statuses(context.platformIds, status) };
  },
};

const superpowersRuntime: IntegrationRuntime = {
  manifest: manifest('superpowers'),
  async detect(context) {
    const installedOnPlatforms = await detectSkillIntegration(context, (entry) =>
      entry.includes('superpowers'),
    );
    return {
      dependencyAvailable: Object.values(installedOnPlatforms).every(Boolean),
      installedOnPlatforms,
    };
  },
  async install(context) {
    const status = await installSuperpowersForPlatforms(
      context.projectPath,
      context.scope,
      context.platformIds,
      context.installDependency,
    );
    return { status, platformStatuses: statuses(context.platformIds, status) };
  },
};

const codegraphRuntime: IntegrationRuntime = {
  manifest: manifest('codegraph'),
  async detect(context) {
    const hasIndex = await hasCodegraphProjectIndex(context.projectPath);
    return {
      dependencyAvailable: resolveCodegraphCommand(context.projectPath) !== null,
      installedOnPlatforms: Object.fromEntries(
        context.platformIds.map((platformId) => [platformId, hasIndex]),
      ),
    };
  },
  async install(context) {
    if (await hasCodegraphProjectIndex(context.projectPath)) {
      return {
        status: 'skipped',
        platformStatuses: statuses(context.platformIds, 'skipped'),
        message: 'project index already exists',
      };
    }
    let available = resolveCodegraphCommand(context.projectPath) !== null;
    if (!available && context.installDependency) {
      available = installCodegraph(context.scope, context.projectPath);
    }
    if (!available) {
      return {
        status: 'skipped',
        platformStatuses: statuses(context.platformIds, 'skipped'),
        message: 'CodeGraph CLI is not installed',
      };
    }
    const initialized = initializeCodegraph(context.projectPath);
    const status = initialized ? 'installed' : 'failed';
    return {
      status,
      platformStatuses: statuses(context.platformIds, status),
      message: initialized ? undefined : 'CodeGraph project initialization failed',
    };
  },
};

export class IntegrationRuntimeRegistry {
  private readonly runtimes = new Map<string, IntegrationRuntime>();

  constructor(runtimes: IntegrationRuntime[]) {
    for (const runtime of runtimes) {
      const id = runtime.manifest.id;
      if (this.runtimes.has(id)) throw new Error(`Duplicate integration runtime: ${id}`);
      this.runtimes.set(id, runtime);
    }
  }

  list(): IntegrationRuntime[] {
    return [...this.runtimes.values()];
  }

  get(id: string): IntegrationRuntime | undefined {
    return this.runtimes.get(id);
  }

  require(id: string): IntegrationRuntime {
    const runtime = this.get(id);
    if (!runtime) throw new Error(`Integration runtime not found: ${id}`);
    return runtime;
  }
}

export function createUserManagedIntegrationRuntime(
  localManifest: IntegrationManifest,
): IntegrationRuntime {
  if (localManifest.source !== 'local' || localManifest.management !== 'user') {
    throw new Error(`User-managed runtime requires a local manifest: ${localManifest.id}`);
  }
  return {
    manifest: localManifest,
    async detect(context) {
      const trusted = localManifest.localTrust?.trusted === true;
      return {
        dependencyAvailable: trusted,
        installedOnPlatforms: Object.fromEntries(
          context.platformIds.map((platformId) => [
            platformId,
            trusted &&
              Boolean(
                localManifest.platformMappings[platformId] ?? localManifest.platformMappings['*'],
              ),
          ]),
        ),
      };
    },
    async install(context) {
      if (localManifest.localTrust?.trusted !== true) {
        return {
          status: 'failed',
          platformStatuses: statuses(context.platformIds, 'failed'),
          message: 'local integration manifest is not trusted',
        };
      }
      return {
        status: 'adopted',
        platformStatuses: statuses(context.platformIds, 'adopted'),
        message: 'user-managed integration adopted; no installation was performed',
      };
    },
  };
}

export const OFFICIAL_INTEGRATION_RUNTIMES = new IntegrationRuntimeRegistry([
  openspecRuntime,
  superpowersRuntime,
  codegraphRuntime,
]);
