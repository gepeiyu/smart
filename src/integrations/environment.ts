import { OFFICIAL_INTEGRATIONS } from './catalog.js';
import {
  createUserManagedIntegrationRuntime,
  IntegrationRuntimeRegistry,
  OFFICIAL_INTEGRATION_RUNTIMES,
} from './runtime.js';
import { listProjectLocalIntegrations, type LocalIntegrationRecord } from './store.js';
import { IntegrationRegistry } from './types.js';

export interface ProjectIntegrationEnvironment {
  registry: IntegrationRegistry;
  runtimes: IntegrationRuntimeRegistry;
  localIntegrations: LocalIntegrationRecord[];
}

export async function loadProjectIntegrationEnvironment(
  projectPath: string,
  homeDir?: string,
): Promise<ProjectIntegrationEnvironment> {
  const localIntegrations = await listProjectLocalIntegrations(projectPath, homeDir);
  return {
    registry: new IntegrationRegistry([
      ...OFFICIAL_INTEGRATIONS,
      ...localIntegrations.map((record) => record.manifest),
    ]),
    runtimes: new IntegrationRuntimeRegistry([
      ...OFFICIAL_INTEGRATION_RUNTIMES.list(),
      ...localIntegrations.map((record) => createUserManagedIntegrationRuntime(record.manifest)),
    ]),
    localIntegrations,
  };
}
