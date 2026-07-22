import path from 'path';
import YAML from 'yaml';
import { loadProjectIntegrationEnvironment } from '../integrations/environment.js';
import { OFFICIAL_WORKFLOWS } from '../workflows/catalog.js';
import {
  createProjectWorkflow,
  listProjectWorkflowDefinitions,
  resolveProjectWorkflow,
  resolvedWorkflowDefinition,
  setProjectWorkflow,
  writeResolvedWorkflow,
} from '../workflows/store.js';
import { toWorkflowDocument } from '../workflows/schema.js';
import type { WorkflowResolution } from '../workflows/types.js';

interface JsonOption {
  json?: boolean;
}

function resolutionSummary(resolution: WorkflowResolution) {
  return {
    id: resolution.workflow.id,
    source: resolution.workflow.source,
    kind: resolution.workflow.kind,
    supportLevel: resolution.workflow.supportLevel,
    digest: resolution.workflow.digest,
    valid: resolution.valid,
    issues: resolution.issues,
  };
}

export async function listWorkflowsCommand(
  targetPath: string,
  options: JsonOption = {},
): Promise<void> {
  const projectPath = path.resolve(targetPath);
  const { registry } = await loadProjectIntegrationEnvironment(projectPath);
  const official = await Promise.all(
    Object.keys(OFFICIAL_WORKFLOWS).map(async (source) =>
      resolutionSummary(await resolveProjectWorkflow(projectPath, source, registry)),
    ),
  );
  const project = await Promise.all(
    (await listProjectWorkflowDefinitions(projectPath)).map(async ({ source }) =>
      resolutionSummary(await resolveProjectWorkflow(projectPath, source, registry)),
    ),
  );
  const result = { official, project };
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log('\n  Smart Workflows\n');
  for (const item of official)
    console.log(`  ${item.valid ? 'ok' : 'invalid'}  ${item.source}  ${item.supportLevel}`);
  if (project.length > 0) {
    console.log('');
    for (const item of project)
      console.log(`  ${item.valid ? 'ok' : 'invalid'}  ${item.source}  ${item.supportLevel}`);
  }
  console.log('');
}

export async function validateWorkflowCommand(
  targetPath: string,
  reference: string,
  options: JsonOption = {},
): Promise<WorkflowResolution> {
  const projectPath = path.resolve(targetPath);
  const { registry } = await loadProjectIntegrationEnvironment(projectPath);
  const resolution = await resolveProjectWorkflow(projectPath, reference, registry);
  if (options.json) {
    console.log(JSON.stringify(resolutionSummary(resolution), null, 2));
  } else {
    console.log(`\n  Workflow: ${resolution.workflow.id}`);
    console.log(`  Support: ${resolution.workflow.supportLevel}`);
    console.log(`  Digest: ${resolution.workflow.digest}`);
    if (resolution.issues.length === 0) console.log('  Valid\n');
    else {
      console.log('');
      for (const item of resolution.issues)
        console.log(`  ${item.severity.toUpperCase()} ${item.code} ${item.path}: ${item.message}`);
      console.log('');
    }
  }
  return resolution;
}

export async function createWorkflowCommand(
  targetPath: string,
  name: string,
  options: JsonOption & { extends?: string } = {},
): Promise<void> {
  const projectPath = path.resolve(targetPath);
  const filePath = await createProjectWorkflow(
    projectPath,
    name,
    options.extends ?? 'official/full',
  );
  const source = path.relative(projectPath, filePath).replace(/\\/g, '/');
  const { registry } = await loadProjectIntegrationEnvironment(projectPath);
  const resolution = await resolveProjectWorkflow(projectPath, source, registry);
  const result = { filePath, workflow: resolutionSummary(resolution) };
  if (options.json) console.log(JSON.stringify(result, null, 2));
  else console.log(`\n  Created ${source}\n  Support: ${resolution.workflow.supportLevel}\n`);
}

export async function useWorkflowCommand(
  targetPath: string,
  reference: string,
  options: JsonOption = {},
): Promise<void> {
  const projectPath = path.resolve(targetPath);
  const { registry } = await loadProjectIntegrationEnvironment(projectPath);
  const resolution = await resolveProjectWorkflow(projectPath, reference, registry);
  if (!resolution.valid) {
    const errors = resolution.issues
      .filter((item) => item.severity === 'error')
      .map((item) => item.message)
      .join('; ');
    throw new Error(`Cannot use invalid workflow ${reference}: ${errors}`);
  }
  const setupPath = await setProjectWorkflow(projectPath, reference, resolution);
  const result = { setupPath, workflow: resolutionSummary(resolution) };
  if (options.json) console.log(JSON.stringify(result, null, 2));
  else
    console.log(
      `\n  Default workflow: ${resolution.workflow.id}\n  Support: ${resolution.workflow.supportLevel}\n`,
    );
}

export async function exportWorkflowCommand(
  targetPath: string,
  reference: string,
  options: JsonOption & { output?: string } = {},
): Promise<void> {
  const projectPath = path.resolve(targetPath);
  const { registry } = await loadProjectIntegrationEnvironment(projectPath);
  const resolution = await resolveProjectWorkflow(projectPath, reference, registry);
  if (!resolution.valid) throw new Error(`Cannot export invalid workflow: ${reference}`);
  if (options.output) {
    const outputPath = path.resolve(projectPath, options.output);
    await writeResolvedWorkflow(outputPath, resolution.workflow);
    if (options.json)
      console.log(JSON.stringify({ outputPath, workflow: resolutionSummary(resolution) }, null, 2));
    else console.log(`\n  Exported ${resolution.workflow.id} -> ${outputPath}\n`);
    return;
  }
  const document = toWorkflowDocument(resolvedWorkflowDefinition(resolution.workflow));
  if (options.json) console.log(JSON.stringify(document, null, 2));
  else process.stdout.write(YAML.stringify(document));
}
