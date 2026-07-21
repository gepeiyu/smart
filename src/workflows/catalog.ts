import type { WorkflowDefinition, WorkflowStageDefinition } from './types.js';

function fullStages(includeCodegraph: boolean): Record<string, WorkflowStageDefinition> {
  const assistants = includeCodegraph ? ['codegraph'] : [];
  return {
    issue: {
      kind: 'integration',
      dependsOn: [],
      capability: 'requirements',
      owner: 'openspec',
      assistants,
      executionContract: 'openspec.issue.instruction-driven.v1',
      requiredInputs: ['user-request'],
      requiredOutputs: ['proposal', 'specification-delta', 'task-list'],
    },
    design: {
      kind: 'integration',
      dependsOn: ['issue'],
      capability: 'design',
      owner: 'superpowers',
      participants: ['openspec'],
      assistants,
      executionContract: 'superpowers.design.instruction-driven.v1',
      requiredInputs: ['proposal', 'specification-delta', 'task-list'],
      requiredOutputs: ['design-document', 'refined-task-list'],
    },
    build: {
      kind: 'integration',
      dependsOn: ['design'],
      capability: 'implementation',
      owner: 'superpowers',
      assistants,
      executionContract: 'superpowers.build.instruction-driven.v1',
      requiredInputs: ['design-document', 'refined-task-list'],
      requiredOutputs: ['implementation', 'test-evidence', 'review-evidence'],
    },
    verify: {
      kind: 'integration',
      dependsOn: ['build'],
      capability: 'verification',
      executors: ['superpowers', 'openspec'],
      assistants,
      executionContract: 'smart.verify-coordination.v1',
      requiredInputs: ['implementation', 'test-evidence', 'review-evidence'],
      requiredOutputs: ['verification-report'],
    },
    archive: {
      kind: 'integration',
      dependsOn: ['verify'],
      capability: 'archive',
      owner: 'openspec',
      executionContract: 'openspec.archive.instruction-driven.v1',
      requiredInputs: ['verification-report'],
      requiredOutputs: ['archived-change'],
    },
  };
}

function workflow(id: string, displayName: string, includeCodegraph: boolean): WorkflowDefinition {
  const integrations: WorkflowDefinition['integrations'] = {
    openspec: { source: 'official' },
    superpowers: { source: 'official' },
  };
  if (includeCodegraph) integrations.codegraph = { source: 'official' };

  return {
    version: 1,
    id,
    displayName,
    kind: 'official',
    officialCertified: true,
    supportPolicy: { allowComponentVerified: false, allowLocalTrusted: false },
    integrations,
    stages: fullStages(includeCodegraph),
  };
}

function modeWorkflow(
  id: 'bugfix' | 'quick',
  displayName: string,
  includeCodegraph: boolean,
): WorkflowDefinition {
  const definition = workflow(id, displayName, includeCodegraph);
  const stages = fullStages(includeCodegraph);
  delete stages.design;
  stages.build = {
    ...stages.build,
    dependsOn: ['issue'],
    requiredInputs: ['proposal', 'task-list'],
  };
  return { ...definition, stages };
}

export const OFFICIAL_WORKFLOWS: Record<string, WorkflowDefinition> = {
  'official/full': workflow('full', 'Full Development', true),
  'official/workflow': workflow('workflow', 'Workflow', false),
  'official/bugfix': modeWorkflow('bugfix', 'Bug Fix', true),
  'official/quick': modeWorkflow('quick', 'Quick Change', false),
};

export function listOfficialWorkflows(): WorkflowDefinition[] {
  return Object.values(OFFICIAL_WORKFLOWS);
}
