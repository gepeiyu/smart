import path from 'path';
import { OFFICIAL_INTEGRATIONS } from '../integrations/catalog.js';
import {
  createLocalIntegration,
  listProjectLocalIntegrations,
  resolveLocalIntegration,
  trustLocalIntegration,
  untrustLocalIntegration,
} from '../integrations/store.js';
import type { IntegrationCapability } from '../integrations/types.js';

interface IntegrationOptions {
  json?: boolean;
  capabilities?: string;
  contracts?: string;
  platforms?: string;
  digest?: string;
}

function items(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function localSummary(record: Awaited<ReturnType<typeof resolveLocalIntegration>>) {
  return {
    id: record.manifest.id,
    displayName: record.manifest.displayName,
    source: record.manifest.source,
    management: record.manifest.management,
    capabilities: record.manifest.capabilities,
    stageContracts: record.manifest.stageContracts,
    platforms: Object.keys(record.manifest.platformMappings),
    digest: record.digest,
    trusted: record.trusted,
    filePath: record.filePath,
  };
}

export async function listIntegrationsCommand(
  targetPath: string,
  options: IntegrationOptions = {},
): Promise<void> {
  const result = {
    official: OFFICIAL_INTEGRATIONS.map((manifest) => ({
      id: manifest.id,
      displayName: manifest.displayName,
      source: manifest.source,
      management: manifest.management,
      capabilities: manifest.capabilities,
      stageContracts: manifest.stageContracts,
      trusted: true,
    })),
    local: (await listProjectLocalIntegrations(path.resolve(targetPath))).map(localSummary),
  };
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log('\n  Smart Integrations\n');
  for (const integration of result.official)
    console.log(`  official  ${integration.id}  ${integration.capabilities.join(', ')}`);
  for (const integration of result.local)
    console.log(
      `  ${integration.trusted ? 'trusted' : 'untrusted'}  ${integration.id}  ${integration.digest.slice(0, 12)}`,
    );
  console.log('');
}

export async function createIntegrationCommand(
  targetPath: string,
  id: string,
  options: IntegrationOptions = {},
): Promise<void> {
  const result = await createLocalIntegration(
    path.resolve(targetPath),
    id,
    items(options.capabilities) as IntegrationCapability[],
    items(options.contracts),
    items(options.platforms ?? '*'),
  );
  const summary = localSummary(result);
  if (options.json) console.log(JSON.stringify(summary, null, 2));
  else {
    console.log(`Created: ${summary.filePath}`);
    console.log(`Digest: ${summary.digest}`);
    console.log(`Next: smart integration trust ${id} --digest ${summary.digest}`);
  }
}

export async function validateIntegrationCommand(
  targetPath: string,
  reference: string,
  options: IntegrationOptions = {},
): Promise<void> {
  const summary = localSummary(await resolveLocalIntegration(path.resolve(targetPath), reference));
  if (options.json) console.log(JSON.stringify(summary, null, 2));
  else {
    console.log(`\n  Integration: ${summary.id}`);
    console.log(`  Digest: ${summary.digest}`);
    console.log(`  Trust: ${summary.trusted ? 'trusted' : 'untrusted'}`);
    console.log(`  Capabilities: ${summary.capabilities.join(', ')}`);
    console.log(`  Contracts: ${summary.stageContracts.join(', ')}\n`);
  }
}

export async function trustIntegrationCommand(
  targetPath: string,
  reference: string,
  options: IntegrationOptions = {},
): Promise<void> {
  if (!options.digest) {
    throw new Error('Trust requires --digest <sha256> from smart integration validate');
  }
  const summary = localSummary(
    await trustLocalIntegration(path.resolve(targetPath), reference, options.digest),
  );
  if (options.json) console.log(JSON.stringify(summary, null, 2));
  else console.log(`Trusted ${summary.id} at digest ${summary.digest}`);
}

export async function untrustIntegrationCommand(
  id: string,
  options: IntegrationOptions = {},
): Promise<void> {
  const removed = await untrustLocalIntegration(id);
  if (options.json) console.log(JSON.stringify({ id, removed }, null, 2));
  else console.log(removed ? `Trust removed: ${id}` : `No trust record found: ${id}`);
}
