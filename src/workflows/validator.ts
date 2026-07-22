import type { IntegrationManifest } from '../integrations/types.js';
import type { ResolvedWorkflow, WorkflowIssue, WorkflowStageDefinition } from './types.js';

const EXTERNAL_INPUTS = new Set(['user-request']);
const SMART_STAGE_CONTRACT_PREFIX = 'smart.';

function issue(
  severity: WorkflowIssue['severity'],
  code: string,
  path: string,
  message: string,
): WorkflowIssue {
  return { severity, code, path, message };
}

function stageActors(stage: WorkflowStageDefinition): string[] {
  return [
    stage.owner,
    ...(stage.executors ?? []),
    ...(stage.participants ?? []),
    ...(stage.assistants ?? []),
  ].filter((value): value is string => Boolean(value));
}

function executionActors(stage: WorkflowStageDefinition): string[] {
  return [stage.owner, ...(stage.executors ?? [])].filter((value): value is string =>
    Boolean(value),
  );
}

function collectAncestors(
  stageId: string,
  stages: ResolvedWorkflow['stages'],
  seen = new Set<string>(),
): Set<string> {
  for (const dependency of stages[stageId]?.dependsOn ?? []) {
    if (seen.has(dependency)) continue;
    seen.add(dependency);
    collectAncestors(dependency, stages, seen);
  }
  return seen;
}

export function validateWorkflow(
  workflow: ResolvedWorkflow,
  manifests: Record<string, IntegrationManifest>,
): WorkflowIssue[] {
  const issues: WorkflowIssue[] = [];
  const stageEntries = Object.entries(workflow.stages);
  if (stageEntries.length === 0) {
    issues.push(
      issue(
        'error',
        'WORKFLOW_EMPTY',
        'stages',
        'Workflow must contain at least one enabled stage',
      ),
    );
    return issues;
  }

  let integrationStages = 0;
  for (const [stageId, stage] of stageEntries) {
    const path = `stages.${stageId}`;
    const dependencies = stage.dependsOn ?? [];
    for (const dependency of dependencies) {
      if (!workflow.stages[dependency]) {
        issues.push(
          issue(
            'error',
            'STAGE_DEPENDENCY_UNKNOWN',
            `${path}.depends_on`,
            `Unknown stage dependency: ${dependency}`,
          ),
        );
      }
      if (dependency === stageId) {
        issues.push(
          issue(
            'error',
            'STAGE_DEPENDENCY_SELF',
            `${path}.depends_on`,
            'Stage cannot depend on itself',
          ),
        );
      }
    }

    if (stage.kind !== 'integration') continue;
    integrationStages++;
    const executors = executionActors(stage);
    if (executors.length === 0) {
      issues.push(
        issue(
          'error',
          'STAGE_OWNER_MISSING',
          path,
          'Integration stage requires an owner or executor',
        ),
      );
    }

    for (const integrationId of new Set(stageActors(stage))) {
      const binding = workflow.integrations[integrationId];
      const manifest = manifests[integrationId];
      if (!binding) {
        issues.push(
          issue(
            'error',
            'STAGE_INTEGRATION_UNBOUND',
            path,
            `Stage references integration not bound by workflow: ${integrationId}`,
          ),
        );
        continue;
      }
      if (!manifest) {
        issues.push(
          issue(
            'error',
            'INTEGRATION_UNKNOWN',
            `integrations.${integrationId}`,
            `Unknown integration: ${integrationId}`,
          ),
        );
        continue;
      }
      if (binding.source !== manifest.source) {
        issues.push(
          issue(
            'error',
            'INTEGRATION_SOURCE_MISMATCH',
            `integrations.${integrationId}.source`,
            `Expected ${manifest.source} integration source, received ${binding.source}`,
          ),
        );
      }
      if (binding.source === 'local' && manifest.localTrust?.trusted !== true) {
        issues.push(
          issue(
            'error',
            'LOCAL_INTEGRATION_UNTRUSTED',
            `integrations.${integrationId}`,
            `Local integration content digest is not trusted: ${integrationId}`,
          ),
        );
      }
    }

    if (stage.capability) {
      const capable = executors.some((integrationId) =>
        manifests[integrationId]?.capabilities.includes(stage.capability!),
      );
      if (!capable) {
        issues.push(
          issue(
            'error',
            'STAGE_CAPABILITY_MISSING',
            `${path}.capability`,
            `No owner or executor provides capability: ${stage.capability}`,
          ),
        );
      }
    }

    if (!stage.executionContract) {
      issues.push(
        issue(
          'error',
          'STAGE_CONTRACT_MISSING',
          path,
          'Integration stage requires an execution contract',
        ),
      );
    } else if (!stage.executionContract.startsWith(SMART_STAGE_CONTRACT_PREFIX)) {
      const contractAvailable = executors.some((integrationId) =>
        manifests[integrationId]?.stageContracts.includes(stage.executionContract!),
      );
      if (!contractAvailable) {
        issues.push(
          issue(
            'error',
            'STAGE_CONTRACT_UNAVAILABLE',
            `${path}.execution_contract`,
            `No owner or executor declares contract: ${stage.executionContract}`,
          ),
        );
      }
    }
  }

  if (integrationStages === 0) {
    issues.push(
      issue(
        'error',
        'WORKFLOW_INTEGRATION_STAGE_MISSING',
        'stages',
        'Workflow must contain at least one integration stage',
      ),
    );
  }

  const inDegree = new Map<string, number>();
  const outgoing = new Map<string, string[]>();
  for (const [stageId, stage] of stageEntries) {
    const dependencies = (stage.dependsOn ?? []).filter(
      (dependency) => workflow.stages[dependency],
    );
    inDegree.set(stageId, dependencies.length);
    for (const dependency of dependencies)
      outgoing.set(dependency, [...(outgoing.get(dependency) ?? []), stageId]);
  }
  const queue = [...inDegree.entries()]
    .filter(([, degree]) => degree === 0)
    .map(([stageId]) => stageId);
  let visited = 0;
  while (queue.length > 0) {
    const stageId = queue.shift()!;
    visited++;
    for (const dependent of outgoing.get(stageId) ?? []) {
      const degree = (inDegree.get(dependent) ?? 0) - 1;
      inDegree.set(dependent, degree);
      if (degree === 0) queue.push(dependent);
    }
  }
  if (visited !== stageEntries.length) {
    issues.push(
      issue('error', 'WORKFLOW_STAGE_CYCLE', 'stages', 'Stage dependency graph contains a cycle'),
    );
  }

  const producers = new Map<string, string>();
  for (const [stageId, stage] of stageEntries) {
    for (const output of stage.requiredOutputs ?? []) {
      const existing = producers.get(output);
      if (existing) {
        issues.push(
          issue(
            'error',
            'ARTIFACT_PRODUCER_DUPLICATE',
            `stages.${stageId}.required_outputs`,
            `Artifact ${output} is already produced by stage ${existing}`,
          ),
        );
      } else {
        producers.set(output, stageId);
      }
    }
  }
  for (const [stageId, stage] of stageEntries) {
    const ancestors = collectAncestors(stageId, workflow.stages);
    for (const input of stage.requiredInputs ?? []) {
      if (EXTERNAL_INPUTS.has(input)) continue;
      const producer = producers.get(input);
      if (!producer) {
        issues.push(
          issue(
            'error',
            'ARTIFACT_PRODUCER_MISSING',
            `stages.${stageId}.required_inputs`,
            `No stage produces artifact: ${input}`,
          ),
        );
      } else if (!ancestors.has(producer)) {
        issues.push(
          issue(
            'error',
            'ARTIFACT_PRODUCER_NOT_UPSTREAM',
            `stages.${stageId}.required_inputs`,
            `Artifact ${input} is produced by ${producer}, which is not an upstream dependency`,
          ),
        );
      }
    }
  }

  const terminalStages = stageEntries.filter(
    ([stageId]) => (outgoing.get(stageId) ?? []).length === 0,
  );
  if (terminalStages.length === 0) {
    issues.push(
      issue('error', 'WORKFLOW_TERMINAL_MISSING', 'stages', 'Workflow must have a terminal stage'),
    );
  }

  return issues;
}
