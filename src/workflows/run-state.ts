import fs from 'fs/promises';
import path from 'path';
import YAML from 'yaml';
import { loadProjectIntegrationEnvironment } from '../integrations/environment.js';
import { smartYamlPath } from '../core/smart-paths.js';
import { resolveConfiguredProjectWorkflow, resolveProjectWorkflow } from './store.js';
import type { ResolvedWorkflow } from './types.js';

export type WorkflowRunStatus = 'active' | 'blocked' | 'completed';
export type WorkflowRunRoute = 'standard' | 'bugfix' | 'quick';

export interface WorkflowRunState {
  version: 1;
  change: string;
  workflowSource: string;
  workflowDigest: string;
  supportLevel: string;
  route: WorkflowRunRoute;
  status: WorkflowRunStatus;
  currentStage: string | null;
  readyStages: string[];
  completedStages: string[];
  evidence: Record<string, string>;
  failure: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdvanceWorkflowRunOptions {
  stage?: string;
  confirmed?: boolean;
  acceptDrift?: boolean;
}

function assertChangeName(change: string): void {
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(change)) {
    throw new Error(
      'Change name must use lowercase letters, numbers, dots, dashes, or underscores',
    );
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Workflow run state must be a YAML object');
  }
  return value as Record<string, unknown>;
}

function strings(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`Workflow run state ${field} must be a string list`);
  }
  return value as string[];
}

function stringRecord(value: unknown, field: string): Record<string, string> {
  const record = asRecord(value);
  if (Object.values(record).some((item) => typeof item !== 'string')) {
    throw new Error(`Workflow run state ${field} must contain string values`);
  }
  return record as Record<string, string>;
}

function parseState(value: unknown): WorkflowRunState {
  const state = asRecord(value);
  const route = state.route;
  const status = state.status;
  if (route !== 'standard' && route !== 'bugfix' && route !== 'quick') {
    throw new Error('Workflow run state has an invalid route');
  }
  if (status !== 'active' && status !== 'blocked' && status !== 'completed') {
    throw new Error('Workflow run state has an invalid status');
  }
  for (const field of [
    'change',
    'workflow_source',
    'workflow_digest',
    'support_level',
    'created_at',
    'updated_at',
  ]) {
    if (typeof state[field] !== 'string') {
      throw new Error(`Workflow run state ${field} must be a string`);
    }
  }
  if (state.current_stage !== null && typeof state.current_stage !== 'string') {
    throw new Error('Workflow run state current_stage must be a string or null');
  }
  if (state.failure !== null && typeof state.failure !== 'string') {
    throw new Error('Workflow run state failure must be a string or null');
  }
  return {
    version: 1,
    change: state.change as string,
    workflowSource: state.workflow_source as string,
    workflowDigest: state.workflow_digest as string,
    supportLevel: state.support_level as string,
    route,
    status,
    currentStage: state.current_stage as string | null,
    readyStages: strings(state.ready_stages, 'ready_stages'),
    completedStages: strings(state.completed_stages, 'completed_stages'),
    evidence: stringRecord(state.evidence, 'evidence'),
    failure: state.failure as string | null,
    createdAt: state.created_at as string,
    updatedAt: state.updated_at as string,
  };
}

function stateDocument(state: WorkflowRunState): Record<string, unknown> {
  return {
    version: state.version,
    change: state.change,
    workflow_source: state.workflowSource,
    workflow_digest: state.workflowDigest,
    support_level: state.supportLevel,
    route: state.route,
    status: state.status,
    current_stage: state.currentStage,
    ready_stages: state.readyStages,
    completed_stages: state.completedStages,
    evidence: state.evidence,
    failure: state.failure,
    created_at: state.createdAt,
    updated_at: state.updatedAt,
  };
}

async function writeState(projectPath: string, state: WorkflowRunState): Promise<void> {
  const filePath = smartYamlPath(projectPath, state.change);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(temporary, YAML.stringify(stateDocument(state)), 'utf-8');
  await fs.rename(temporary, filePath);
}

async function configuredWorkflow(
  projectPath: string,
): Promise<{ source: string; workflow: ResolvedWorkflow }> {
  const { registry } = await loadProjectIntegrationEnvironment(projectPath);
  const configured = await resolveConfiguredProjectWorkflow(projectPath, registry);
  if (!configured)
    throw new Error('No active workflow. Run smart init or smart workflow use first');
  if (!configured.resolution.valid) {
    throw new Error(
      `Active workflow is invalid: ${configured.resolution.issues.map((issue) => issue.message).join('; ')}`,
    );
  }
  return { source: configured.selection.source, workflow: configured.resolution.workflow };
}

async function workflowForReference(
  projectPath: string,
  reference: string,
): Promise<{ source: string; workflow: ResolvedWorkflow }> {
  const { registry } = await loadProjectIntegrationEnvironment(projectPath);
  const resolution = await resolveProjectWorkflow(projectPath, reference, registry);
  if (!resolution.valid) {
    throw new Error(
      `Workflow ${reference} is invalid: ${resolution.issues.map((issue) => issue.message).join('; ')}`,
    );
  }
  return { source: reference, workflow: resolution.workflow };
}

function readyStages(workflow: ResolvedWorkflow, completedStages: string[]): string[] {
  const completed = new Set(completedStages);
  return Object.entries(workflow.stages)
    .filter(
      ([stageId, stage]) =>
        !completed.has(stageId) &&
        (stage.dependsOn ?? []).every((dependency) => completed.has(dependency)),
    )
    .map(([stageId]) => stageId);
}

export async function readWorkflowRunState(
  projectPath: string,
  change: string,
): Promise<WorkflowRunState> {
  assertChangeName(change);
  const filePath = smartYamlPath(projectPath, change);
  try {
    return parseState(YAML.parse(await fs.readFile(filePath, 'utf-8')) as unknown);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Workflow run not found: ${change}`, { cause: error });
    }
    throw error;
  }
}

export async function initializeWorkflowRun(
  projectPath: string,
  change: string,
  route: WorkflowRunRoute = 'standard',
  workflowReference?: string,
): Promise<WorkflowRunState> {
  assertChangeName(change);
  const filePath = smartYamlPath(projectPath, change);
  try {
    await fs.access(filePath);
    throw new Error(`Workflow run already exists: ${change}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const { source, workflow } = workflowReference
    ? await workflowForReference(projectPath, workflowReference)
    : await configuredWorkflow(projectPath);
  const ready = readyStages(workflow, []);
  if (ready.length === 0) throw new Error('Active workflow has no entry stage');
  const timestamp = new Date().toISOString();
  const state: WorkflowRunState = {
    version: 1,
    change,
    workflowSource: source,
    workflowDigest: workflow.digest,
    supportLevel: workflow.supportLevel,
    route,
    status: 'active',
    currentStage: ready[0],
    readyStages: ready,
    completedStages: [],
    evidence: { 'user-request': 'provided' },
    failure: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await writeState(projectPath, state);
  return state;
}

export async function advanceWorkflowRun(
  projectPath: string,
  change: string,
  options: AdvanceWorkflowRunOptions = {},
): Promise<WorkflowRunState> {
  const state = await readWorkflowRunState(projectPath, change);
  if (state.status === 'completed') throw new Error(`Workflow run is already completed: ${change}`);
  if (state.status === 'blocked')
    throw new Error(`Workflow run is blocked: ${state.failure ?? change}`);
  const { source, workflow } = await workflowForReference(projectPath, state.workflowSource);
  if (state.workflowDigest !== workflow.digest && !options.acceptDrift) {
    throw new Error('Workflow definition changed during this run; pass --accept-drift to continue');
  }
  const stageId = options.stage ?? state.currentStage;
  if (!stageId || !workflow.stages[stageId]) throw new Error(`Unknown current stage: ${stageId}`);
  if (!state.readyStages.includes(stageId)) throw new Error(`Stage is not ready: ${stageId}`);
  const stage = workflow.stages[stageId];
  if ((stage.kind === 'gate' || stage.kind === 'user-checkpoint') && !options.confirmed) {
    throw new Error(`Stage ${stageId} requires explicit confirmation`);
  }
  const evidence = { ...state.evidence };
  if (stage.kind === 'gate' || stage.kind === 'user-checkpoint') {
    for (const output of stage.requiredOutputs ?? []) evidence[output] ??= 'confirmed';
  }
  const missingInputs = (stage.requiredInputs ?? []).filter((artifact) => !evidence[artifact]);
  if (missingInputs.length > 0) {
    throw new Error(
      `Stage ${stageId} is missing required input evidence: ${missingInputs.join(', ')}`,
    );
  }
  const missingOutputs = (stage.requiredOutputs ?? []).filter((artifact) => !evidence[artifact]);
  if (missingOutputs.length > 0) {
    throw new Error(
      `Stage ${stageId} is missing required output evidence: ${missingOutputs.join(', ')}`,
    );
  }
  const completedStages = [...new Set([...state.completedStages, stageId])];
  const ready = readyStages(workflow, completedStages);
  const complete = completedStages.length === Object.keys(workflow.stages).length;
  const next: WorkflowRunState = {
    ...state,
    workflowSource: source,
    workflowDigest: workflow.digest,
    supportLevel: workflow.supportLevel,
    status: complete ? 'completed' : 'active',
    currentStage: complete ? null : (ready[0] ?? null),
    readyStages: complete ? [] : ready,
    completedStages,
    evidence,
    failure: null,
    updatedAt: new Date().toISOString(),
  };
  if (!complete && !next.currentStage) {
    throw new Error('Workflow has no ready stage but is not complete');
  }
  await writeState(projectPath, next);
  return next;
}

export async function recordWorkflowRunEvidence(
  projectPath: string,
  change: string,
  artifact: string,
  value: string,
): Promise<WorkflowRunState> {
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(artifact)) {
    throw new Error(
      'Evidence artifact id must use lowercase letters, numbers, dots, dashes, or underscores',
    );
  }
  if (!value.trim()) throw new Error('Evidence value cannot be empty');
  const state = await readWorkflowRunState(projectPath, change);
  if (state.status === 'completed') throw new Error(`Workflow run is already completed: ${change}`);
  const { workflow } = await workflowForReference(projectPath, state.workflowSource);
  const declared = new Set([
    'user-request',
    ...Object.values(workflow.stages).flatMap((stage) => [
      ...(stage.requiredInputs ?? []),
      ...(stage.requiredOutputs ?? []),
    ]),
  ]);
  if (!declared.has(artifact)) throw new Error(`Evidence artifact is not declared: ${artifact}`);
  const next = {
    ...state,
    evidence: { ...state.evidence, [artifact]: value.trim() },
    updatedAt: new Date().toISOString(),
  };
  await writeState(projectPath, next);
  return next;
}

export async function blockWorkflowRun(
  projectPath: string,
  change: string,
  reason: string,
): Promise<WorkflowRunState> {
  if (!reason.trim()) throw new Error('A blocking reason is required');
  const state = await readWorkflowRunState(projectPath, change);
  const next = {
    ...state,
    status: 'blocked' as const,
    failure: reason.trim(),
    updatedAt: new Date().toISOString(),
  };
  await writeState(projectPath, next);
  return next;
}

export async function resumeWorkflowRun(
  projectPath: string,
  change: string,
): Promise<WorkflowRunState> {
  const state = await readWorkflowRunState(projectPath, change);
  if (state.status !== 'blocked') throw new Error(`Workflow run is not blocked: ${change}`);
  const next = {
    ...state,
    status: 'active' as const,
    failure: null,
    updatedAt: new Date().toISOString(),
  };
  await writeState(projectPath, next);
  return next;
}

export async function switchWorkflowRun(
  projectPath: string,
  change: string,
  workflowReference: string,
  confirmed = false,
): Promise<WorkflowRunState> {
  if (!confirmed) throw new Error('Switching a run workflow requires explicit confirmation');
  const state = await readWorkflowRunState(projectPath, change);
  if (state.status === 'completed') throw new Error(`Workflow run is already completed: ${change}`);
  const { source, workflow } = await workflowForReference(projectPath, workflowReference);
  const missingCompleted = state.completedStages.filter((stageId) => !workflow.stages[stageId]);
  if (missingCompleted.length > 0) {
    throw new Error(
      `Target workflow does not contain completed stages: ${missingCompleted.join(', ')}`,
    );
  }
  const ready = readyStages(workflow, state.completedStages);
  const complete = state.completedStages.length === Object.keys(workflow.stages).length;
  if (!complete && ready.length === 0) {
    throw new Error('Target workflow has no stage ready after the completed stage set');
  }
  const next: WorkflowRunState = {
    ...state,
    workflowSource: source,
    workflowDigest: workflow.digest,
    supportLevel: workflow.supportLevel,
    status: complete ? 'completed' : 'active',
    currentStage: complete ? null : ready[0],
    readyStages: complete ? [] : ready,
    failure: null,
    updatedAt: new Date().toISOString(),
  };
  await writeState(projectPath, next);
  return next;
}
