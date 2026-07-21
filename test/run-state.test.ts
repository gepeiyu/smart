import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { OFFICIAL_INTEGRATION_REGISTRY } from '../src/integrations/catalog.js';
import {
  advanceWorkflowRun,
  blockWorkflowRun,
  initializeWorkflowRun,
  readWorkflowRunState,
  recordWorkflowRunEvidence,
  resumeWorkflowRun,
  switchWorkflowRun,
} from '../src/workflows/run-state.js';
import { resolveProjectWorkflow, setProjectWorkflow } from '../src/workflows/store.js';

const projects: string[] = [];

async function project(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'smart-run-'));
  projects.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(projects.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function configure(dir: string, reference = 'official/full'): Promise<void> {
  const resolution = await resolveProjectWorkflow(dir, reference, OFFICIAL_INTEGRATION_REGISTRY);
  await setProjectWorkflow(dir, reference, resolution);
}

async function completeCurrentStage(
  dir: string,
  change: string,
  options: { confirmed?: boolean } = {},
) {
  const state = await readWorkflowRunState(dir, change);
  const resolution = await resolveProjectWorkflow(
    dir,
    state.workflowSource,
    OFFICIAL_INTEGRATION_REGISTRY,
  );
  const stage = resolution.workflow.stages[state.currentStage!];
  if (stage.kind === 'integration') {
    for (const output of stage.requiredOutputs ?? []) {
      await recordWorkflowRunEvidence(dir, change, output, `evidence:${output}`);
    }
  }
  return advanceWorkflowRun(dir, change, options);
}

describe('workflow run state', () => {
  it('starts and advances the official DAG', async () => {
    const dir = await project();
    await configure(dir);

    const started = await initializeWorkflowRun(dir, 'add-search');
    expect(started.currentStage).toBe('issue');
    expect(started.supportLevel).toBe('official-certified');

    await expect(advanceWorkflowRun(dir, 'add-search')).rejects.toThrow(
      'missing required output evidence',
    );
    const next = await completeCurrentStage(dir, 'add-search');
    expect(next.completedStages).toEqual(['issue']);
    expect(next.currentStage).toBe('design');
  });

  it('finishes when every stage is completed', async () => {
    const dir = await project();
    await configure(dir, 'official/workflow');
    await initializeWorkflowRun(dir, 'finish-flow');

    for (let index = 0; index < 5; index++) {
      await completeCurrentStage(dir, 'finish-flow');
    }
    const state = await readWorkflowRunState(dir, 'finish-flow');
    expect(state.status).toBe('completed');
    expect(state.currentStage).toBeNull();
  });

  it('requires explicit confirmation for custom checkpoints', async () => {
    const dir = await project();
    const workflowDir = path.join(dir, '.smart', 'workflows');
    await mkdir(workflowDir, { recursive: true });
    await writeFile(
      path.join(workflowDir, 'approval.yaml'),
      YAML.stringify({
        version: 1,
        id: 'approval',
        kind: 'custom',
        extends: 'official/workflow',
        support_policy: { allow_component_verified: true, allow_local_trusted: false },
        integrations: {},
        stages: {
          'security-review': {
            kind: 'user-checkpoint',
            depends_on: ['build'],
            required_inputs: ['implementation', 'review-evidence'],
            required_outputs: ['security-approval'],
            prompt: 'Approve the implementation',
          },
          verify: {
            depends_on: ['security-review'],
            required_inputs: [
              'implementation',
              'test-evidence',
              'review-evidence',
              'security-approval',
            ],
          },
        },
      }),
      'utf-8',
    );
    await configure(dir, 'approval');
    await initializeWorkflowRun(dir, 'approval-flow');
    await completeCurrentStage(dir, 'approval-flow');
    await completeCurrentStage(dir, 'approval-flow');
    await completeCurrentStage(dir, 'approval-flow');

    await expect(advanceWorkflowRun(dir, 'approval-flow')).rejects.toThrow(
      'requires explicit confirmation',
    );
    const next = await completeCurrentStage(dir, 'approval-flow', { confirmed: true });
    expect(next.currentStage).toBe('verify');
  });

  it('blocks and resumes without losing the current stage', async () => {
    const dir = await project();
    await configure(dir);
    await initializeWorkflowRun(dir, 'blocked-flow', 'bugfix');

    const blocked = await blockWorkflowRun(dir, 'blocked-flow', 'tests failed');
    expect(blocked.status).toBe('blocked');
    await expect(advanceWorkflowRun(dir, 'blocked-flow')).rejects.toThrow('tests failed');

    const resumed = await resumeWorkflowRun(dir, 'blocked-flow');
    expect(resumed.status).toBe('active');
    expect(resumed.currentStage).toBe('issue');
    expect(resumed.route).toBe('bugfix');
  });

  it('selects a per-change preset without changing the project default', async () => {
    const dir = await project();
    await configure(dir, 'official/full');

    const state = await initializeWorkflowRun(dir, 'small-fix', 'bugfix', 'official/bugfix');

    expect(state.workflowSource).toBe('official/bugfix');
    await completeCurrentStage(dir, 'small-fix');
    expect((await readWorkflowRunState(dir, 'small-fix')).currentStage).toBe('build');
  });

  it('switches a mode run to a compatible full workflow after confirmation', async () => {
    const dir = await project();
    await configure(dir);
    await initializeWorkflowRun(dir, 'upgrade-flow', 'bugfix', 'official/bugfix');
    await completeCurrentStage(dir, 'upgrade-flow');

    await expect(switchWorkflowRun(dir, 'upgrade-flow', 'official/full')).rejects.toThrow(
      'explicit confirmation',
    );
    const switched = await switchWorkflowRun(dir, 'upgrade-flow', 'official/full', true);
    expect(switched.workflowSource).toBe('official/full');
    expect(switched.currentStage).toBe('design');
  });
});
