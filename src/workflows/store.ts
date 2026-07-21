import fs from 'fs/promises';
import path from 'path';
import YAML from 'yaml';
import type { IntegrationRegistry } from '../integrations/types.js';
import { OFFICIAL_WORKFLOWS } from './catalog.js';
import { resolveWorkflow } from './resolver.js';
import { parseWorkflowDefinition, toWorkflowDocument } from './schema.js';
import type { ResolvedWorkflow, WorkflowDefinition, WorkflowResolution } from './types.js';

export function projectWorkflowsDir(projectPath: string): string {
  return path.join(projectPath, '.smart', 'workflows');
}

export function projectSetupPath(projectPath: string): string {
  return path.join(projectPath, '.smart', 'setup.yaml');
}

export function projectWorkflowLockPath(projectPath: string): string {
  return path.join(projectPath, '.smart', 'workflow.lock.yaml');
}

export interface ProjectWorkflowSelection {
  mode: 'official' | 'custom';
  source: string;
  supportLevel: string;
  resolvedDigest: string;
  acceptCustomRisk: boolean;
}

function isInsideProject(projectPath: string, candidate: string): boolean {
  const relative = path.relative(path.resolve(projectPath), path.resolve(candidate));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export async function readWorkflowFile(filePath: string): Promise<WorkflowDefinition> {
  let parsed: unknown;
  try {
    parsed = YAML.parse(await fs.readFile(filePath, 'utf-8')) as unknown;
  } catch (error) {
    throw new Error(`Failed to read workflow ${filePath}: ${(error as Error).message}`, {
      cause: error,
    });
  }
  return parseWorkflowDefinition(parsed);
}

export async function listProjectWorkflowDefinitions(
  projectPath: string,
): Promise<Array<{ source: string; filePath: string; definition: WorkflowDefinition }>> {
  const dir = projectWorkflowsDir(projectPath);
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const workflows = [];
  for (const entry of entries) {
    if (!entry.isFile() || !/\.ya?ml$/i.test(entry.name)) continue;
    const filePath = path.join(dir, entry.name);
    const definition = await readWorkflowFile(filePath);
    workflows.push({ source: `.smart/workflows/${entry.name}`, filePath, definition });
  }
  return workflows;
}

async function projectDefinitionMap(
  projectPath: string,
): Promise<Record<string, WorkflowDefinition>> {
  const definitions: Record<string, WorkflowDefinition> = {};
  for (const item of await listProjectWorkflowDefinitions(projectPath)) {
    if (definitions[item.definition.id])
      throw new Error(`Duplicate project workflow id: ${item.definition.id}`);
    definitions[item.definition.id] = item.definition;
    definitions[item.source] = item.definition;
  }
  return definitions;
}

function officialReference(reference: string): string | null {
  if (OFFICIAL_WORKFLOWS[reference]) return reference;
  const qualified = `official/${reference}`;
  return OFFICIAL_WORKFLOWS[qualified] ? qualified : null;
}

export async function resolveProjectWorkflow(
  projectPath: string,
  reference: string,
  registry: IntegrationRegistry,
): Promise<WorkflowResolution> {
  const official = officialReference(reference);
  if (official) return resolveWorkflow(official, registry);

  const definitions = await projectDefinitionMap(projectPath);
  if (definitions[reference]) return resolveWorkflow(reference, registry, definitions);

  const candidate = path.resolve(projectPath, reference);
  if (!isInsideProject(projectPath, candidate))
    throw new Error(`Workflow path must stay inside project: ${reference}`);
  const definition = await readWorkflowFile(candidate);
  definitions[reference] = definition;
  definitions[definition.id] = definition;
  return resolveWorkflow(reference, registry, definitions);
}

export async function createProjectWorkflow(
  projectPath: string,
  name: string,
  extendsReference = 'official/full',
): Promise<string> {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name))
    throw new Error('Workflow name must use lowercase kebab-case');
  if (!officialReference(extendsReference)) {
    const definitions = await projectDefinitionMap(projectPath);
    if (!definitions[extendsReference])
      throw new Error(`Parent workflow not found: ${extendsReference}`);
  }
  const filePath = path.join(projectWorkflowsDir(projectPath), `${name}.yaml`);
  try {
    await fs.access(filePath);
    throw new Error(`Workflow already exists: ${filePath}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const definition: WorkflowDefinition = {
    version: 1,
    id: name,
    displayName: name,
    kind: 'custom',
    extends: extendsReference,
    supportPolicy: { allowComponentVerified: true, allowLocalTrusted: false },
    integrations: {},
    stages: {},
  };
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, YAML.stringify(toWorkflowDocument(definition)), 'utf-8');
  return filePath;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function setProjectWorkflow(
  projectPath: string,
  reference: string,
  resolution: WorkflowResolution,
): Promise<string> {
  if (!resolution.valid) throw new Error(`Cannot use invalid workflow: ${reference}`);
  const setupPath = projectSetupPath(projectPath);
  let setup: Record<string, unknown> = {};
  try {
    setup = asRecord(YAML.parse(await fs.readFile(setupPath, 'utf-8')) as unknown);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  setup.version = 1;
  setup.workflow = {
    mode: resolution.workflow.kind,
    source: reference,
    support_level: resolution.workflow.supportLevel,
    resolved_digest: resolution.workflow.digest,
    accept_custom_risk: resolution.workflow.kind === 'custom',
  };
  await fs.mkdir(path.dirname(setupPath), { recursive: true });
  await fs.writeFile(setupPath, YAML.stringify(setup), 'utf-8');
  await fs.writeFile(
    projectWorkflowLockPath(projectPath),
    YAML.stringify({
      version: 1,
      source: reference,
      digest: resolution.workflow.digest,
      support_level: resolution.workflow.supportLevel,
      local_integrations: resolution.workflow.integrationDigests,
      workflow: toWorkflowDocument(resolvedWorkflowDefinition(resolution.workflow)),
    }),
    'utf-8',
  );
  return setupPath;
}

export async function readProjectWorkflowSelection(
  projectPath: string,
): Promise<ProjectWorkflowSelection | null> {
  let setup: Record<string, unknown>;
  try {
    setup = asRecord(
      YAML.parse(await fs.readFile(projectSetupPath(projectPath), 'utf-8')) as unknown,
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
  const workflow = asRecord(setup.workflow);
  if (typeof workflow.source !== 'string' || workflow.source.length === 0) {
    throw new Error('.smart/setup.yaml is missing workflow.source');
  }
  const mode = workflow.mode;
  if (mode !== 'official' && mode !== 'custom') {
    throw new Error('.smart/setup.yaml has an invalid workflow.mode');
  }
  return {
    mode,
    source: workflow.source,
    supportLevel: typeof workflow.support_level === 'string' ? workflow.support_level : 'invalid',
    resolvedDigest: typeof workflow.resolved_digest === 'string' ? workflow.resolved_digest : '',
    acceptCustomRisk: workflow.accept_custom_risk === true,
  };
}

export async function resolveConfiguredProjectWorkflow(
  projectPath: string,
  registry: IntegrationRegistry,
): Promise<{ selection: ProjectWorkflowSelection; resolution: WorkflowResolution } | null> {
  const selection = await readProjectWorkflowSelection(projectPath);
  if (!selection) return null;
  return {
    selection,
    resolution: await resolveProjectWorkflow(projectPath, selection.source, registry),
  };
}

export function resolvedWorkflowDefinition(workflow: ResolvedWorkflow): WorkflowDefinition {
  return {
    version: 1,
    id: workflow.id,
    displayName: workflow.displayName,
    kind: 'custom',
    officialCertified: false,
    supportPolicy: workflow.supportPolicy,
    integrations: workflow.integrations,
    stages: workflow.stages,
  };
}

export async function writeResolvedWorkflow(
  filePath: string,
  workflow: ResolvedWorkflow,
): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(
    filePath,
    YAML.stringify(toWorkflowDocument(resolvedWorkflowDefinition(workflow))),
    'utf-8',
  );
}
