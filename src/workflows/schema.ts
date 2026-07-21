import type {
  WorkflowDefinition,
  WorkflowIntegrationBinding,
  WorkflowStageDefinition,
  WorkflowStageKind,
  WorkflowSupportPolicy,
} from './types.js';

export class WorkflowSchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkflowSchemaError';
  }
}

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new WorkflowSchemaError(`${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

function assertKnownKeys(record: Record<string, unknown>, allowed: string[], path: string): void {
  const allowedSet = new Set(allowed);
  const unknown = Object.keys(record).filter((key) => !allowedSet.has(key));
  if (unknown.length > 0)
    throw new WorkflowSchemaError(`${path} contains unknown fields: ${unknown.join(', ')}`);
}

function requiredString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '')
    throw new WorkflowSchemaError(`${path} must be a non-empty string`);
  return value.trim();
}

function optionalString(value: unknown, path: string): string | undefined {
  if (value === undefined) return undefined;
  return requiredString(value, path);
}

function optionalBoolean(value: unknown, path: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') throw new WorkflowSchemaError(`${path} must be a boolean`);
  return value;
}

function optionalStringArray(value: unknown, path: string): string[] | undefined {
  if (value === undefined) return undefined;
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== 'string' || item.trim() === '')
  ) {
    throw new WorkflowSchemaError(`${path} must be an array of non-empty strings`);
  }
  return value.map((item) => item.trim());
}

function optionalRecord(value: unknown, path: string): Record<string, unknown> | undefined {
  if (value === undefined) return undefined;
  return asRecord(value, path);
}

function valueFor(record: Record<string, unknown>, camel: string, snake: string): unknown {
  if (record[camel] !== undefined && record[snake] !== undefined) {
    throw new WorkflowSchemaError(`Use only one of ${camel} or ${snake}`);
  }
  return record[camel] ?? record[snake];
}

function parseIntegration(value: unknown, path: string): WorkflowIntegrationBinding {
  const record = asRecord(value, path);
  assertKnownKeys(record, ['source', 'options'], path);
  const source = requiredString(record.source, `${path}.source`);
  if (source !== 'official' && source !== 'local') {
    throw new WorkflowSchemaError(`${path}.source must be official or local`);
  }
  return { source, options: optionalRecord(record.options, `${path}.options`) };
}

function parseStage(value: unknown, path: string): WorkflowStageDefinition {
  const record = asRecord(value, path);
  assertKnownKeys(
    record,
    [
      'kind',
      'enabled',
      'dependsOn',
      'depends_on',
      'capability',
      'owner',
      'executors',
      'participants',
      'assistants',
      'executionContract',
      'execution_contract',
      'requiredInputs',
      'required_inputs',
      'requiredOutputs',
      'required_outputs',
      'gates',
      'prompt',
    ],
    path,
  );
  const kind = optionalString(record.kind, `${path}.kind`) as WorkflowStageKind | undefined;
  if (kind && !['integration', 'user-checkpoint', 'gate'].includes(kind)) {
    throw new WorkflowSchemaError(`${path}.kind must be integration, user-checkpoint, or gate`);
  }
  return {
    kind,
    enabled: optionalBoolean(record.enabled, `${path}.enabled`),
    dependsOn: optionalStringArray(
      valueFor(record, 'dependsOn', 'depends_on'),
      `${path}.depends_on`,
    ),
    capability: optionalString(
      record.capability,
      `${path}.capability`,
    ) as WorkflowStageDefinition['capability'],
    owner: optionalString(record.owner, `${path}.owner`),
    executors: optionalStringArray(record.executors, `${path}.executors`),
    participants: optionalStringArray(record.participants, `${path}.participants`),
    assistants: optionalStringArray(record.assistants, `${path}.assistants`),
    executionContract: optionalString(
      valueFor(record, 'executionContract', 'execution_contract'),
      `${path}.execution_contract`,
    ),
    requiredInputs: optionalStringArray(
      valueFor(record, 'requiredInputs', 'required_inputs'),
      `${path}.required_inputs`,
    ),
    requiredOutputs: optionalStringArray(
      valueFor(record, 'requiredOutputs', 'required_outputs'),
      `${path}.required_outputs`,
    ),
    gates: optionalStringArray(record.gates, `${path}.gates`),
    prompt: optionalString(record.prompt, `${path}.prompt`),
  };
}

function parseSupportPolicy(value: unknown): WorkflowSupportPolicy | undefined {
  if (value === undefined) return undefined;
  const record = asRecord(value, 'workflow.support_policy');
  assertKnownKeys(
    record,
    [
      'allowComponentVerified',
      'allow_component_verified',
      'allowLocalTrusted',
      'allow_local_trusted',
    ],
    'workflow.support_policy',
  );
  return {
    allowComponentVerified:
      optionalBoolean(
        valueFor(record, 'allowComponentVerified', 'allow_component_verified'),
        'workflow.support_policy.allow_component_verified',
      ) ?? true,
    allowLocalTrusted:
      optionalBoolean(
        valueFor(record, 'allowLocalTrusted', 'allow_local_trusted'),
        'workflow.support_policy.allow_local_trusted',
      ) ?? false,
  };
}

export function parseWorkflowDefinition(value: unknown): WorkflowDefinition {
  const record = asRecord(value, 'workflow');
  assertKnownKeys(
    record,
    [
      'version',
      'id',
      'displayName',
      'display_name',
      'kind',
      'extends',
      'officialCertified',
      'official_certified',
      'supportPolicy',
      'support_policy',
      'integrations',
      'stages',
    ],
    'workflow',
  );
  if (record.version !== 1) throw new WorkflowSchemaError('workflow.version must be 1');
  const id = requiredString(record.id, 'workflow.id');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) {
    throw new WorkflowSchemaError('workflow.id must use lowercase kebab-case');
  }
  const kind = (optionalString(record.kind, 'workflow.kind') ??
    'custom') as WorkflowDefinition['kind'];
  if (kind !== 'official' && kind !== 'custom')
    throw new WorkflowSchemaError('workflow.kind must be official or custom');

  const integrationsRecord = asRecord(record.integrations ?? {}, 'workflow.integrations');
  const stagesRecord = asRecord(record.stages ?? {}, 'workflow.stages');
  return {
    version: 1,
    id,
    displayName: optionalString(
      valueFor(record, 'displayName', 'display_name'),
      'workflow.display_name',
    ),
    kind,
    extends: optionalString(record.extends, 'workflow.extends'),
    officialCertified: optionalBoolean(
      valueFor(record, 'officialCertified', 'official_certified'),
      'workflow.official_certified',
    ),
    supportPolicy: parseSupportPolicy(valueFor(record, 'supportPolicy', 'support_policy')),
    integrations: Object.fromEntries(
      Object.entries(integrationsRecord).map(([key, integration]) => [
        key,
        parseIntegration(integration, `workflow.integrations.${key}`),
      ]),
    ),
    stages: Object.fromEntries(
      Object.entries(stagesRecord).map(([key, stage]) => [
        key,
        parseStage(stage, `workflow.stages.${key}`),
      ]),
    ),
  };
}

function compact<T extends Record<string, unknown>>(record: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

export function toWorkflowDocument(workflow: WorkflowDefinition): Record<string, unknown> {
  return compact({
    version: workflow.version,
    id: workflow.id,
    display_name: workflow.displayName,
    kind: workflow.kind,
    extends: workflow.extends,
    official_certified: workflow.officialCertified,
    support_policy: workflow.supportPolicy
      ? {
          allow_component_verified: workflow.supportPolicy.allowComponentVerified,
          allow_local_trusted: workflow.supportPolicy.allowLocalTrusted,
        }
      : undefined,
    integrations: Object.fromEntries(
      Object.entries(workflow.integrations).map(([id, binding]) => [
        id,
        compact({ source: binding.source, options: binding.options }),
      ]),
    ),
    stages: Object.fromEntries(
      Object.entries(workflow.stages).map(([id, stage]) => [
        id,
        compact({
          kind: stage.kind,
          enabled: stage.enabled,
          depends_on: stage.dependsOn,
          capability: stage.capability,
          owner: stage.owner,
          executors: stage.executors,
          participants: stage.participants,
          assistants: stage.assistants,
          execution_contract: stage.executionContract,
          required_inputs: stage.requiredInputs,
          required_outputs: stage.requiredOutputs,
          gates: stage.gates,
          prompt: stage.prompt,
        }),
      ]),
    ),
  });
}
