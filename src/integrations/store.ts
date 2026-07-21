import { createHash } from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import YAML from 'yaml';
import { OFFICIAL_INTEGRATIONS } from './catalog.js';
import { parseLocalIntegrationManifest, toLocalIntegrationDocument } from './schema.js';
import type { IntegrationManifest } from './types.js';

export interface LocalIntegrationRecord {
  manifest: IntegrationManifest;
  filePath: string;
  digest: string;
  trusted: boolean;
}

interface TrustRecord {
  digest: string;
  trustedAt: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stableValue(item)]),
  );
}

export function localIntegrationDigest(manifest: IntegrationManifest): string {
  return createHash('sha256')
    .update(JSON.stringify(stableValue(toLocalIntegrationDocument(manifest))))
    .digest('hex');
}

export function projectIntegrationsDir(projectPath: string): string {
  return path.join(projectPath, '.smart', 'integrations');
}

export function localIntegrationManifestPath(projectPath: string, id: string): string {
  return path.join(projectIntegrationsDir(projectPath), id, 'manifest.yaml');
}

export function smartHomeDir(): string {
  return process.env.SMART_HOME
    ? path.resolve(process.env.SMART_HOME)
    : path.join(os.homedir(), '.smart');
}

export function integrationTrustStorePath(homeDir = smartHomeDir()): string {
  return path.join(homeDir, 'trust', 'integrations.yaml');
}

async function readTrustStore(homeDir?: string): Promise<Record<string, TrustRecord>> {
  try {
    const parsed = asRecord(
      YAML.parse(await fs.readFile(integrationTrustStorePath(homeDir), 'utf-8')) as unknown,
    );
    const integrations = asRecord(parsed.integrations);
    return Object.fromEntries(
      Object.entries(integrations).flatMap(([id, value]) => {
        const item = asRecord(value);
        return typeof item.digest === 'string' && typeof item.trusted_at === 'string'
          ? [[id, { digest: item.digest, trustedAt: item.trusted_at }]]
          : [];
      }),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw error;
  }
}

async function writeTrustStore(
  records: Record<string, TrustRecord>,
  homeDir?: string,
): Promise<void> {
  const filePath = integrationTrustStorePath(homeDir);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const document = {
    version: 1,
    integrations: Object.fromEntries(
      Object.entries(records).map(([id, value]) => [
        id,
        { digest: value.digest, trusted_at: value.trustedAt },
      ]),
    ),
  };
  const temporary = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(temporary, YAML.stringify(document), 'utf-8');
  await fs.rename(temporary, filePath);
}

export async function readLocalIntegrationManifest(filePath: string): Promise<IntegrationManifest> {
  try {
    return parseLocalIntegrationManifest(
      YAML.parse(await fs.readFile(filePath, 'utf-8')) as unknown,
    );
  } catch (error) {
    throw new Error(`Failed to read local integration ${filePath}: ${(error as Error).message}`, {
      cause: error,
    });
  }
}

export async function listProjectLocalIntegrations(
  projectPath: string,
  homeDir?: string,
): Promise<LocalIntegrationRecord[]> {
  let entries;
  try {
    entries = await fs.readdir(projectIntegrationsDir(projectPath), { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const trust = await readTrustStore(homeDir);
  const integrationsRoot = await fs.realpath(projectIntegrationsDir(projectPath));
  const records: LocalIntegrationRecord[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const filePath = localIntegrationManifestPath(projectPath, entry.name);
    const realManifestPath = await fs.realpath(filePath);
    const relative = path.relative(integrationsRoot, realManifestPath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error(
        `Local integration manifest escapes project integration directory: ${entry.name}`,
      );
    }
    const manifest = await readLocalIntegrationManifest(filePath);
    if (manifest.id !== entry.name) {
      throw new Error(`Local integration directory must match manifest id: ${entry.name}`);
    }
    if (OFFICIAL_INTEGRATIONS.some((official) => official.id === manifest.id)) {
      throw new Error(`Local integration cannot override official integration: ${manifest.id}`);
    }
    const digest = localIntegrationDigest(manifest);
    const trusted = trust[manifest.id]?.digest === digest;
    manifest.localTrust = { digest, trusted };
    records.push({ manifest, filePath, digest, trusted });
  }
  return records;
}

export async function resolveLocalIntegration(
  projectPath: string,
  reference: string,
  homeDir?: string,
): Promise<LocalIntegrationRecord> {
  const records = await listProjectLocalIntegrations(projectPath, homeDir);
  const byId = records.find((record) => record.manifest.id === reference);
  if (byId) return byId;
  const candidate = path.resolve(projectPath, reference);
  const relative = path.relative(path.resolve(projectPath), candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Integration path must stay inside project: ${reference}`);
  }
  const direct = records.find((record) => path.resolve(record.filePath) === candidate);
  if (direct) return direct;
  throw new Error(`Local integration not found: ${reference}`);
}

export async function createLocalIntegration(
  projectPath: string,
  id: string,
  capabilities: IntegrationManifest['capabilities'],
  stageContracts: string[],
  platformIds: string[] = ['*'],
): Promise<LocalIntegrationRecord> {
  const manifest = parseLocalIntegrationManifest({
    version: 1,
    id,
    display_name: id,
    source: 'local',
    management: 'user',
    capabilities,
    stage_contracts: stageContracts,
    platform_mappings: Object.fromEntries(
      platformIds.map((platformId) => [platformId, { tool_id: id }]),
    ),
  });
  const filePath = localIntegrationManifestPath(projectPath, id);
  try {
    await fs.access(filePath);
    throw new Error(`Local integration already exists: ${id}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, YAML.stringify(toLocalIntegrationDocument(manifest)), 'utf-8');
  const digest = localIntegrationDigest(manifest);
  manifest.localTrust = { digest, trusted: false };
  return { manifest, filePath, digest, trusted: false };
}

export async function trustLocalIntegration(
  projectPath: string,
  reference: string,
  expectedDigest: string,
  homeDir?: string,
): Promise<LocalIntegrationRecord> {
  const record = await resolveLocalIntegration(projectPath, reference, homeDir);
  if (record.digest !== expectedDigest) {
    throw new Error(`Integration digest mismatch: expected ${record.digest}`);
  }
  const trust = await readTrustStore(homeDir);
  trust[record.manifest.id] = { digest: record.digest, trustedAt: new Date().toISOString() };
  await writeTrustStore(trust, homeDir);
  record.trusted = true;
  record.manifest.localTrust = { digest: record.digest, trusted: true };
  return record;
}

export async function untrustLocalIntegration(id: string, homeDir?: string): Promise<boolean> {
  const trust = await readTrustStore(homeDir);
  if (!trust[id]) return false;
  delete trust[id];
  await writeTrustStore(trust, homeDir);
  return true;
}
