import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import os from 'os';
import YAML from 'yaml';
import {
  OFFICIAL_INTEGRATIONS,
  OFFICIAL_INTEGRATION_REGISTRY,
} from '../src/integrations/catalog.js';
import { IntegrationRegistry, type IntegrationManifest } from '../src/integrations/types.js';
import { resolveWorkflow } from '../src/workflows/resolver.js';
import { parseWorkflowDefinition } from '../src/workflows/schema.js';
import {
  createProjectWorkflow,
  listProjectWorkflowDefinitions,
  projectSetupPath,
  projectWorkflowLockPath,
  resolveProjectWorkflow,
  setProjectWorkflow,
  writeResolvedWorkflow,
} from '../src/workflows/store.js';
import type { WorkflowDefinition } from '../src/workflows/types.js';

const tempProjects: string[] = [];

async function tempProject(): Promise<string> {
  const project = await mkdtemp(path.join(os.tmpdir(), 'smart-workflows-'));
  tempProjects.push(project);
  return project;
}

afterEach(async () => {
  await Promise.all(
    tempProjects.splice(0).map((project) => rm(project, { recursive: true, force: true })),
  );
});

describe('official workflows', () => {
  it('resolves the full preset as officially certified', () => {
    const result = resolveWorkflow('official/full', OFFICIAL_INTEGRATION_REGISTRY);

    expect(result.valid).toBe(true);
    expect(result.workflow.supportLevel).toBe('official-certified');
    expect(result.workflow.integrations).toHaveProperty('codegraph');
    expect(Object.keys(result.workflow.stages)).toEqual([
      'issue',
      'design',
      'build',
      'verify',
      'archive',
    ]);
    expect(result.issues).toEqual([]);
  });

  it('resolves the workflow preset without CodeGraph', () => {
    const result = resolveWorkflow('official/workflow', OFFICIAL_INTEGRATION_REGISTRY);

    expect(result.valid).toBe(true);
    expect(result.workflow.integrations).not.toHaveProperty('codegraph');
    expect(result.workflow.stages.issue.assistants).toEqual([]);
  });

  it('provides certified bugfix and quick presets without a design stage', () => {
    for (const reference of ['official/bugfix', 'official/quick']) {
      const result = resolveWorkflow(reference, OFFICIAL_INTEGRATION_REGISTRY);
      expect(result.valid).toBe(true);
      expect(result.workflow.supportLevel).toBe('official-certified');
      expect(result.workflow.stages).not.toHaveProperty('design');
      expect(result.workflow.stages.build.dependsOn).toEqual(['issue']);
    }
  });
});

describe('custom workflow resolution', () => {
  it('inherits an official preset and adds a valid checkpoint stage', () => {
    const custom: WorkflowDefinition = {
      version: 1,
      id: 'team-flow',
      kind: 'custom',
      extends: 'official/full',
      supportPolicy: { allowComponentVerified: true, allowLocalTrusted: false },
      integrations: {},
      stages: {
        'security-review': {
          kind: 'user-checkpoint',
          dependsOn: ['build'],
          requiredInputs: ['implementation', 'review-evidence'],
          requiredOutputs: ['security-approval'],
        },
        verify: {
          dependsOn: ['security-review'],
          requiredInputs: [
            'implementation',
            'test-evidence',
            'review-evidence',
            'security-approval',
          ],
        },
      },
    };

    const result = resolveWorkflow('team-flow', OFFICIAL_INTEGRATION_REGISTRY, {
      'team-flow': custom,
    });

    expect(result.valid).toBe(true);
    expect(result.workflow.supportLevel).toBe('component-verified');
    expect(result.workflow.stages['security-review'].kind).toBe('user-checkpoint');
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'WORKFLOW_CUSTOM_UNCERTIFIED', severity: 'warning' }),
    );
  });

  it('rejects an override that removes a required upstream stage', () => {
    const custom: WorkflowDefinition = {
      version: 1,
      id: 'broken-flow',
      kind: 'custom',
      extends: 'official/full',
      integrations: {},
      stages: { design: { enabled: false } },
    };

    const result = resolveWorkflow('broken-flow', OFFICIAL_INTEGRATION_REGISTRY, {
      'broken-flow': custom,
    });

    expect(result.valid).toBe(false);
    expect(result.workflow.supportLevel).toBe('invalid');
    expect(result.issues.map((item) => item.code)).toEqual(
      expect.arrayContaining(['STAGE_DEPENDENCY_UNKNOWN', 'ARTIFACT_PRODUCER_MISSING']),
    );
  });

  it('rejects stage dependency cycles', () => {
    const custom: WorkflowDefinition = {
      version: 1,
      id: 'cycle-flow',
      kind: 'custom',
      supportPolicy: { allowComponentVerified: true, allowLocalTrusted: false },
      integrations: { openspec: { source: 'official' } },
      stages: {
        first: {
          kind: 'integration',
          dependsOn: ['second'],
          capability: 'requirements',
          owner: 'openspec',
          executionContract: 'openspec.issue.instruction-driven.v1',
        },
        second: {
          kind: 'integration',
          dependsOn: ['first'],
          capability: 'archive',
          owner: 'openspec',
          executionContract: 'openspec.archive.instruction-driven.v1',
        },
      },
    };

    const result = resolveWorkflow('cycle-flow', OFFICIAL_INTEGRATION_REGISTRY, {
      'cycle-flow': custom,
    });

    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'WORKFLOW_STAGE_CYCLE' }));
  });

  it('requires explicit policy for local integrations', () => {
    const localManifest: IntegrationManifest = {
      id: 'local-review',
      displayName: 'Local Review',
      source: 'local',
      management: 'user',
      capabilities: ['review'],
      stageContracts: ['local-review.run.v1'],
      platformMappings: { codex: { toolId: 'local-review' } },
      localTrust: { digest: 'trusted-digest', trusted: true },
    };
    const registry = new IntegrationRegistry([...OFFICIAL_INTEGRATIONS, localManifest]);
    const custom: WorkflowDefinition = {
      version: 1,
      id: 'local-flow',
      kind: 'custom',
      supportPolicy: { allowComponentVerified: true, allowLocalTrusted: false },
      integrations: { 'local-review': { source: 'local' } },
      stages: {
        review: {
          kind: 'integration',
          capability: 'review',
          owner: 'local-review',
          executionContract: 'local-review.run.v1',
        },
      },
    };

    const result = resolveWorkflow('local-flow', registry, { 'local-flow': custom });

    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'LOCAL_TRUST_NOT_ALLOWED' }),
    );
  });
});

describe('workflow schema', () => {
  it('parses snake-case YAML fields', () => {
    const workflow = parseWorkflowDefinition(
      YAML.parse(`
version: 1
id: review-flow
kind: custom
extends: official/full
support_policy:
  allow_component_verified: true
  allow_local_trusted: false
integrations: {}
stages:
  verify:
    execution_contract: smart.verify-coordination.v1
    required_inputs: [implementation]
`),
    );

    expect(workflow.supportPolicy).toEqual({
      allowComponentVerified: true,
      allowLocalTrusted: false,
    });
    expect(workflow.stages.verify.executionContract).toBe('smart.verify-coordination.v1');
  });

  it('rejects arbitrary command fields', () => {
    expect(() =>
      parseWorkflowDefinition({
        version: 1,
        id: 'unsafe-flow',
        kind: 'custom',
        integrations: {},
        stages: { build: { kind: 'gate', command: 'rm -rf .' } },
      }),
    ).toThrow('unknown fields: command');
  });
});

describe('project workflow store', () => {
  it('creates, resolves, selects, and exports a custom workflow', async () => {
    const project = await tempProject();
    const filePath = await createProjectWorkflow(project, 'team-flow');

    const workflows = await listProjectWorkflowDefinitions(project);
    expect(workflows).toHaveLength(1);
    expect(workflows[0].definition.id).toBe('team-flow');

    const resolution = await resolveProjectWorkflow(
      project,
      'team-flow',
      OFFICIAL_INTEGRATION_REGISTRY,
    );
    expect(resolution.valid).toBe(true);
    expect(resolution.workflow.supportLevel).toBe('component-verified');

    await setProjectWorkflow(project, 'team-flow', resolution);
    const setup = YAML.parse(await readFile(projectSetupPath(project), 'utf-8')) as Record<
      string,
      unknown
    >;
    expect(setup.workflow).toMatchObject({
      mode: 'custom',
      source: 'team-flow',
      accept_custom_risk: true,
    });
    const lock = YAML.parse(await readFile(projectWorkflowLockPath(project), 'utf-8')) as Record<
      string,
      unknown
    >;
    expect(lock).toMatchObject({
      source: 'team-flow',
      digest: resolution.workflow.digest,
      support_level: 'component-verified',
    });
    expect(lock.workflow).toMatchObject({ stages: { archive: expect.any(Object) } });

    const exported = path.join(project, 'resolved.yaml');
    await writeResolvedWorkflow(exported, resolution.workflow);
    const exportedWorkflow = parseWorkflowDefinition(
      YAML.parse(await readFile(exported, 'utf-8')) as unknown,
    );
    expect(exportedWorkflow.extends).toBeUndefined();
    expect(exportedWorkflow.stages).toHaveProperty('archive');
    expect(filePath).toBe(path.join(project, '.smart', 'workflows', 'team-flow.yaml'));
  });

  it('loads a workflow by project-relative path', async () => {
    const project = await tempProject();
    const workflowPath = path.join(project, '.smart', 'workflows', 'direct.yaml');
    await mkdir(path.dirname(workflowPath), { recursive: true });
    await writeFile(
      workflowPath,
      YAML.stringify({
        version: 1,
        id: 'direct',
        kind: 'custom',
        extends: 'official/workflow',
        integrations: {},
        stages: {},
      }),
    );

    const result = await resolveProjectWorkflow(
      project,
      '.smart/workflows/direct.yaml',
      OFFICIAL_INTEGRATION_REGISTRY,
    );

    expect(result.valid).toBe(true);
    expect(result.workflow.id).toBe('direct');
  });

  it('preserves inherited stage fields omitted from YAML overrides', async () => {
    const project = await tempProject();
    const workflowPath = path.join(project, '.smart', 'workflows', 'yaml-override.yaml');
    await mkdir(path.dirname(workflowPath), { recursive: true });
    await writeFile(
      workflowPath,
      `version: 1
id: yaml-override
kind: custom
extends: official/workflow
support_policy:
  allow_component_verified: true
  allow_local_trusted: false
integrations: {}
stages:
  verify:
    depends_on: [build]
`,
      'utf-8',
    );

    const result = await resolveProjectWorkflow(
      project,
      'yaml-override',
      OFFICIAL_INTEGRATION_REGISTRY,
    );

    expect(result.valid).toBe(true);
    expect(result.workflow.stages.verify.executors).toEqual(['superpowers', 'openspec']);
    expect(result.workflow.stages.verify.executionContract).toBe('smart.verify-coordination.v1');
  });
});
