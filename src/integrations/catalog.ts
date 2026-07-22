import { PLATFORMS } from '../core/platforms.js';
import { SKILLS_AGENT_MAP } from '../core/superpowers.js';
import {
  IntegrationRegistry,
  type IntegrationManifest,
  type PlatformIntegrationMapping,
} from './types.js';

function platformMappings(
  mapping: (platformId: string) => PlatformIntegrationMapping,
): Record<string, PlatformIntegrationMapping> {
  return Object.fromEntries(PLATFORMS.map((platform) => [platform.id, mapping(platform.id)]));
}

const OPENSPEC_TOOL_ID_OVERRIDES: Record<string, string> = { kimicode: 'kimi' };

export const OPENSPEC_TOOL_IDS = Object.fromEntries(
  PLATFORMS.map((platform) => [
    platform.id,
    OPENSPEC_TOOL_ID_OVERRIDES[platform.id] ?? platform.id,
  ]),
) as Record<string, string>;

const openspec: IntegrationManifest = {
  id: 'openspec',
  displayName: 'OpenSpec',
  source: 'official',
  management: 'smart',
  capabilities: ['requirements', 'specification', 'verification', 'archive'],
  stageContracts: [
    'openspec.issue.instruction-driven.v1',
    'openspec.verify.instruction-driven.v1',
    'openspec.archive.instruction-driven.v1',
  ],
  platformMappings: platformMappings((platformId) => ({
    toolId: OPENSPEC_TOOL_IDS[platformId],
  })),
  verification: {
    id: 'smart-0.1-openspec-component',
    platforms: PLATFORMS.map((platform) => platform.id),
    capabilities: ['requirements', 'specification', 'verification', 'archive'],
    stageContracts: [
      'openspec.issue.instruction-driven.v1',
      'openspec.verify.instruction-driven.v1',
      'openspec.archive.instruction-driven.v1',
    ],
  },
};

const superpowers: IntegrationManifest = {
  id: 'superpowers',
  displayName: 'Superpowers',
  source: 'official',
  management: 'smart',
  capabilities: ['design', 'planning', 'implementation', 'review', 'verification'],
  stageContracts: [
    'superpowers.design.instruction-driven.v1',
    'superpowers.build.instruction-driven.v1',
    'superpowers.verify.instruction-driven.v1',
  ],
  platformMappings: platformMappings((platformId) => ({ agentId: SKILLS_AGENT_MAP[platformId] })),
  verification: {
    id: 'smart-0.1-superpowers-component',
    platforms: PLATFORMS.map((platform) => platform.id),
    capabilities: ['design', 'planning', 'implementation', 'review', 'verification'],
    stageContracts: [
      'superpowers.design.instruction-driven.v1',
      'superpowers.build.instruction-driven.v1',
      'superpowers.verify.instruction-driven.v1',
    ],
  },
};

const codegraph: IntegrationManifest = {
  id: 'codegraph',
  displayName: 'CodeGraph',
  source: 'official',
  management: 'smart',
  capabilities: ['code-intelligence'],
  stageContracts: [],
  platformMappings: platformMappings(() => ({})),
  verification: {
    id: 'smart-0.1-codegraph-component',
    platforms: PLATFORMS.map((platform) => platform.id),
    capabilities: ['code-intelligence'],
    stageContracts: [],
  },
};

export const OFFICIAL_INTEGRATIONS = [openspec, superpowers, codegraph] as const;
export const OFFICIAL_INTEGRATION_REGISTRY = new IntegrationRegistry([...OFFICIAL_INTEGRATIONS]);
