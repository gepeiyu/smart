import type { IntegrationCapability, IntegrationManifest } from '../integrations/types.js';

export type WorkflowSupportLevel =
  'official-certified' | 'component-verified' | 'local-trusted' | 'invalid';
export type WorkflowStageKind = 'integration' | 'user-checkpoint' | 'gate';

export interface WorkflowIntegrationBinding {
  source: 'official' | 'local';
  options?: Record<string, unknown>;
}

export interface WorkflowSupportPolicy {
  allowComponentVerified: boolean;
  allowLocalTrusted: boolean;
}

export interface WorkflowStageDefinition {
  kind?: WorkflowStageKind;
  enabled?: boolean;
  dependsOn?: string[];
  capability?: IntegrationCapability;
  owner?: string;
  executors?: string[];
  participants?: string[];
  assistants?: string[];
  executionContract?: string;
  requiredInputs?: string[];
  requiredOutputs?: string[];
  gates?: string[];
  prompt?: string;
}

export interface WorkflowDefinition {
  version: 1;
  id: string;
  displayName?: string;
  kind: 'official' | 'custom';
  extends?: string;
  officialCertified?: boolean;
  supportPolicy?: WorkflowSupportPolicy;
  integrations: Record<string, WorkflowIntegrationBinding>;
  stages: Record<string, WorkflowStageDefinition>;
}

export interface ResolvedWorkflow extends Omit<WorkflowDefinition, 'extends' | 'stages'> {
  source: string;
  digest: string;
  supportLevel: WorkflowSupportLevel;
  integrationDigests: Record<string, string>;
  stages: Record<string, WorkflowStageDefinition & { kind: WorkflowStageKind; enabled: true }>;
}

export type WorkflowIssueSeverity = 'error' | 'warning';

export interface WorkflowIssue {
  severity: WorkflowIssueSeverity;
  code: string;
  path: string;
  message: string;
}

export interface WorkflowResolution {
  workflow: ResolvedWorkflow;
  issues: WorkflowIssue[];
  valid: boolean;
}

export interface WorkflowResolverContext {
  definitions: Record<string, WorkflowDefinition>;
  manifests: Record<string, IntegrationManifest>;
}
