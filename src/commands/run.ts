import path from 'path';
import {
  advanceWorkflowRun,
  blockWorkflowRun,
  initializeWorkflowRun,
  readWorkflowRunState,
  recordWorkflowRunEvidence,
  resumeWorkflowRun,
  switchWorkflowRun,
  type WorkflowRunRoute,
  type WorkflowRunState,
} from '../workflows/run-state.js';

interface RunOptions {
  json?: boolean;
  route?: WorkflowRunRoute;
  stage?: string;
  confirmed?: boolean;
  acceptDrift?: boolean;
  workflow?: string;
}

function output(state: WorkflowRunState, json = false): void {
  if (json) {
    console.log(JSON.stringify(state, null, 2));
    return;
  }
  console.log(`Run: ${state.change}`);
  console.log(`Workflow: ${state.workflowSource} [${state.supportLevel}]`);
  console.log(`Status: ${state.status}`);
  console.log(`Current stage: ${state.currentStage ?? 'done'}`);
  if (state.readyStages.length > 1) console.log(`Ready stages: ${state.readyStages.join(', ')}`);
  if (state.failure) console.log(`Blocked: ${state.failure}`);
}

export async function initRunCommand(
  targetPath: string,
  change: string,
  options: RunOptions = {},
): Promise<void> {
  output(
    await initializeWorkflowRun(
      path.resolve(targetPath),
      change,
      options.route ?? 'standard',
      options.workflow,
    ),
    options.json,
  );
}

export async function statusRunCommand(
  targetPath: string,
  change: string,
  options: RunOptions = {},
): Promise<void> {
  output(await readWorkflowRunState(path.resolve(targetPath), change), options.json);
}

export async function advanceRunCommand(
  targetPath: string,
  change: string,
  options: RunOptions = {},
): Promise<void> {
  output(
    await advanceWorkflowRun(path.resolve(targetPath), change, {
      stage: options.stage,
      confirmed: options.confirmed,
      acceptDrift: options.acceptDrift,
    }),
    options.json,
  );
}

export async function blockRunCommand(
  targetPath: string,
  change: string,
  reason: string,
  options: RunOptions = {},
): Promise<void> {
  output(await blockWorkflowRun(path.resolve(targetPath), change, reason), options.json);
}

export async function resumeRunCommand(
  targetPath: string,
  change: string,
  options: RunOptions = {},
): Promise<void> {
  output(await resumeWorkflowRun(path.resolve(targetPath), change), options.json);
}

export async function switchRunCommand(
  targetPath: string,
  change: string,
  workflow: string,
  options: RunOptions = {},
): Promise<void> {
  output(
    await switchWorkflowRun(path.resolve(targetPath), change, workflow, options.confirmed === true),
    options.json,
  );
}

export async function evidenceRunCommand(
  targetPath: string,
  change: string,
  artifact: string,
  value: string,
  options: RunOptions = {},
): Promise<void> {
  output(
    await recordWorkflowRunEvidence(path.resolve(targetPath), change, artifact, value),
    options.json,
  );
}
