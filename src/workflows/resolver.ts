import { createHash } from 'crypto';
import type { IntegrationManifest, IntegrationRegistry } from '../integrations/types.js';
import { OFFICIAL_WORKFLOWS } from './catalog.js';
import type {
  ResolvedWorkflow,
  WorkflowDefinition,
  WorkflowIssue,
  WorkflowResolution,
  WorkflowStageDefinition,
  WorkflowSupportLevel,
} from './types.js';
import { validateWorkflow } from './validator.js';

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stableValue(item)]),
  );
}

export function workflowDigest(workflow: Omit<ResolvedWorkflow, 'digest'>): string {
  return createHash('sha256')
    .update(JSON.stringify(stableValue(workflow)))
    .digest('hex');
}

function mergeStage(
  base: WorkflowStageDefinition | undefined,
  override: WorkflowStageDefinition,
): WorkflowStageDefinition {
  return {
    ...(base ?? {}),
    ...Object.fromEntries(Object.entries(override).filter(([, value]) => value !== undefined)),
  };
}

function mergeDefinition(
  parent: WorkflowDefinition,
  child: WorkflowDefinition,
): WorkflowDefinition {
  const stages = { ...parent.stages };
  for (const [stageId, stage] of Object.entries(child.stages))
    stages[stageId] = mergeStage(stages[stageId], stage);
  const childFields = Object.fromEntries(
    Object.entries(child).filter(([, value]) => value !== undefined),
  ) as Partial<WorkflowDefinition>;
  return {
    ...parent,
    ...childFields,
    kind: child.kind,
    officialCertified: child.kind === 'official' ? child.officialCertified : false,
    extends: undefined,
    supportPolicy:
      child.kind === 'custom' ? child.supportPolicy : (child.supportPolicy ?? parent.supportPolicy),
    integrations: { ...parent.integrations, ...child.integrations },
    stages,
  };
}

function resolveDefinition(
  reference: string,
  definitions: Record<string, WorkflowDefinition>,
  stack: string[] = [],
): WorkflowDefinition {
  const definition = definitions[reference];
  if (!definition) throw new Error(`Workflow not found: ${reference}`);
  if (stack.includes(reference))
    throw new Error(`Workflow inheritance cycle: ${[...stack, reference].join(' -> ')}`);
  if (!definition.extends) return definition;
  const parent = resolveDefinition(definition.extends, definitions, [...stack, reference]);
  return mergeDefinition(parent, definition);
}

function manifestRecord(registry: IntegrationRegistry): Record<string, IntegrationManifest> {
  return Object.fromEntries(registry.list().map((manifest) => [manifest.id, manifest]));
}

function supportLevel(
  definition: WorkflowDefinition,
  manifests: Record<string, IntegrationManifest>,
): WorkflowSupportLevel {
  if (definition.kind === 'official' && definition.officialCertified) return 'official-certified';
  const hasLocal = Object.entries(definition.integrations).some(
    ([id, binding]) => binding.source === 'local' || manifests[id]?.source === 'local',
  );
  return hasLocal ? 'local-trusted' : 'component-verified';
}

export function resolveWorkflow(
  reference: string,
  registry: IntegrationRegistry,
  customDefinitions: Record<string, WorkflowDefinition> = {},
): WorkflowResolution {
  const definitions = { ...OFFICIAL_WORKFLOWS, ...customDefinitions };
  const definition = resolveDefinition(reference, definitions);
  const manifests = manifestRecord(registry);
  const stages = Object.fromEntries(
    Object.entries(definition.stages)
      .filter(([, stage]) => stage.enabled !== false)
      .map(([stageId, stage]) => [
        stageId,
        { ...stage, kind: stage.kind ?? 'integration', enabled: true as const },
      ]),
  );
  const withoutDigest: Omit<ResolvedWorkflow, 'digest'> = {
    version: 1,
    id: definition.id,
    displayName: definition.displayName,
    kind: definition.kind,
    officialCertified: definition.officialCertified,
    supportPolicy:
      definition.supportPolicy ??
      (definition.kind === 'custom'
        ? { allowComponentVerified: true, allowLocalTrusted: false }
        : { allowComponentVerified: false, allowLocalTrusted: false }),
    integrations: definition.integrations,
    integrationDigests: Object.fromEntries(
      Object.keys(definition.integrations).flatMap((integrationId) => {
        const digest = manifests[integrationId]?.localTrust?.digest;
        return digest ? [[integrationId, digest]] : [];
      }),
    ),
    stages,
    source: reference,
    supportLevel: supportLevel(definition, manifests),
  };
  const workflow: ResolvedWorkflow = { ...withoutDigest, digest: workflowDigest(withoutDigest) };
  const issues = validateWorkflow(workflow, manifests);

  if (
    workflow.supportLevel === 'component-verified' &&
    workflow.supportPolicy?.allowComponentVerified === false
  ) {
    issues.push({
      severity: 'error',
      code: 'COMPONENT_VERIFIED_NOT_ALLOWED',
      path: 'support_policy.allow_component_verified',
      message: 'Workflow policy does not allow component-verified combinations',
    });
  }
  if (
    workflow.supportLevel === 'local-trusted' &&
    workflow.supportPolicy?.allowLocalTrusted !== true
  ) {
    issues.push({
      severity: 'error',
      code: 'LOCAL_TRUST_NOT_ALLOWED',
      path: 'support_policy.allow_local_trusted',
      message: 'Workflow policy does not allow local-trusted integrations',
    });
  }
  if (definition.kind === 'custom') {
    issues.push({
      severity: 'warning',
      code: 'WORKFLOW_CUSTOM_UNCERTIFIED',
      path: 'workflow',
      message: 'Custom workflow is not covered by an official end-to-end certification',
    });
  }

  const valid = issues.every((item) => item.severity !== 'error');
  if (!valid) workflow.supportLevel = 'invalid';
  return { workflow, issues: issues as WorkflowIssue[], valid };
}
