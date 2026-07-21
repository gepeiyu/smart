import type {
  IntegrationCapability,
  IntegrationManifest,
  PlatformIntegrationMapping,
} from './types.js';

const CAPABILITIES = new Set<IntegrationCapability>([
  'requirements',
  'specification',
  'design',
  'planning',
  'implementation',
  'review',
  'verification',
  'archive',
  'code-intelligence',
]);

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

function rejectUnknown(value: Record<string, unknown>, allowed: string[], path: string): void {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) throw new Error(`${path} contains unknown fields: ${unknown.join(', ')}`);
}

function requiredString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${path} must be a non-empty string`);
  }
  return value.trim();
}

function stringList(value: unknown, path: string): string[] {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((item) => typeof item !== 'string')
  ) {
    throw new Error(`${path} must be a non-empty string list`);
  }
  return [...new Set(value.map((item) => item.trim()))];
}

function platformMappings(value: unknown): Record<string, PlatformIntegrationMapping> {
  const mappings = record(value, 'platform_mappings');
  if (Object.keys(mappings).length === 0) {
    throw new Error('platform_mappings must declare at least one platform or *');
  }
  return Object.fromEntries(
    Object.entries(mappings).map(([platformId, raw]) => {
      if (!/^(\*|[a-z0-9][a-z0-9-]*)$/.test(platformId)) {
        throw new Error(`Invalid platform mapping id: ${platformId}`);
      }
      const mapping = record(raw, `platform_mappings.${platformId}`);
      rejectUnknown(mapping, ['tool_id', 'agent_id'], `platform_mappings.${platformId}`);
      const result: PlatformIntegrationMapping = {};
      if (mapping.tool_id !== undefined)
        result.toolId = requiredString(mapping.tool_id, `platform_mappings.${platformId}.tool_id`);
      if (mapping.agent_id !== undefined) {
        result.agentId =
          mapping.agent_id === null
            ? null
            : requiredString(mapping.agent_id, `platform_mappings.${platformId}.agent_id`);
      }
      if (result.toolId === undefined && result.agentId === undefined) {
        throw new Error(`platform_mappings.${platformId} must declare tool_id or agent_id`);
      }
      return [platformId, result];
    }),
  );
}

export function parseLocalIntegrationManifest(value: unknown): IntegrationManifest {
  const manifest = record(value, 'integration manifest');
  rejectUnknown(
    manifest,
    [
      'version',
      'id',
      'display_name',
      'source',
      'management',
      'capabilities',
      'stage_contracts',
      'platform_mappings',
    ],
    'integration manifest',
  );
  if (manifest.version !== 1) throw new Error('integration manifest version must be 1');
  if (manifest.source !== 'local') throw new Error('local integration source must be local');
  if (manifest.management !== 'user') {
    throw new Error('local integration management must be user');
  }
  const id = requiredString(manifest.id, 'id');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) {
    throw new Error('integration id must use lowercase kebab-case');
  }
  const capabilities = stringList(manifest.capabilities, 'capabilities');
  for (const capability of capabilities) {
    if (!CAPABILITIES.has(capability as IntegrationCapability)) {
      throw new Error(`Unknown integration capability: ${capability}`);
    }
  }
  const stageContracts = stringList(manifest.stage_contracts, 'stage_contracts');
  for (const contract of stageContracts) {
    if (!/^[a-z0-9][a-z0-9._-]*$/.test(contract)) {
      throw new Error(`Invalid stage contract id: ${contract}`);
    }
  }
  return {
    id,
    displayName: requiredString(manifest.display_name, 'display_name'),
    source: 'local',
    management: 'user',
    capabilities: capabilities as IntegrationCapability[],
    stageContracts,
    platformMappings: platformMappings(manifest.platform_mappings),
  };
}

export function toLocalIntegrationDocument(manifest: IntegrationManifest): Record<string, unknown> {
  return {
    version: 1,
    id: manifest.id,
    display_name: manifest.displayName,
    source: 'local',
    management: 'user',
    capabilities: manifest.capabilities,
    stage_contracts: manifest.stageContracts,
    platform_mappings: Object.fromEntries(
      Object.entries(manifest.platformMappings).map(([platformId, mapping]) => [
        platformId,
        {
          ...(mapping.toolId !== undefined ? { tool_id: mapping.toolId } : {}),
          ...(mapping.agentId !== undefined ? { agent_id: mapping.agentId } : {}),
        },
      ]),
    ),
  };
}
