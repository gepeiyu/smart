import { promises as fs } from 'fs';
import YAML from 'yaml';
import { resolveSmartYamlPath, smartdocsChangesDir } from '../core/smart-paths.js';
import { fileExists, readDir } from '../utils/file-system.js';
import { readProjectWorkflowSelection } from '../workflows/store.js';

interface SmartYamlField {
  current_stage?: string;
  workflow_source?: string;
  support_level?: string;
  route?: string;
  status?: string;
}

interface ActiveChange {
  name: string;
  currentStage: string | null;
  workflowSource: string;
  supportLevel: string;
  route: string;
  status: string;
  nextCommand: string | null;
}

function recommendNextCommand(stage: string | null, status: string): string | null {
  if (status === 'completed') return null;
  switch (stage) {
    case 'issue':
      return '/smart-issue';
    case 'design':
      return '/smart-design';
    case 'build':
      return '/smart-build';
    case 'verify':
      return '/smart-verify';
    case 'archive':
      return '/smart-archive';
    default:
      return '/smart';
  }
}

async function readSmartYaml(
  projectPath: string,
  changeName: string,
): Promise<SmartYamlField | null> {
  const yamlPath = await resolveSmartYamlPath(projectPath, changeName);
  if (!yamlPath) return null;
  try {
    const value = YAML.parse(await fs.readFile(yamlPath, 'utf-8')) as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    const text = (key: string): string | undefined =>
      typeof record[key] === 'string' || typeof record[key] === 'number'
        ? String(record[key])
        : undefined;
    return {
      current_stage: text('current_stage'),
      workflow_source: text('workflow_source'),
      support_level: text('support_level'),
      route: text('route'),
      status: text('status'),
    };
  } catch {
    return null;
  }
}

export async function statusCommand(
  targetPath: string,
  opts?: Record<string, unknown>,
): Promise<void> {
  const cwd = targetPath || process.cwd();
  const jsonOutput = opts?.json === true;
  const configuredWorkflow = await readProjectWorkflowSelection(cwd);
  const changesDir = smartdocsChangesDir(cwd);
  if (!(await fileExists(changesDir))) {
    const message =
      'No smartdocs/changes/ directory. Run smart init first and use /smart-issue to create a change.';
    if (jsonOutput) {
      process.stdout.write(
        JSON.stringify({ workflow: configuredWorkflow, error: message, changes: [] }) + '\n',
      );
    } else {
      console.log(message);
    }
    return;
  }

  const activeChanges: ActiveChange[] = [];
  for (const name of await readDir(changesDir)) {
    const state = await readSmartYaml(cwd, name);
    if (!state) continue;
    const change: ActiveChange = {
      name,
      currentStage: state.current_stage || null,
      workflowSource: state.workflow_source || configuredWorkflow?.source || '',
      supportLevel: state.support_level || configuredWorkflow?.supportLevel || 'invalid',
      route: state.route || 'standard',
      status: state.status || 'active',
      nextCommand: null,
    };
    change.nextCommand = recommendNextCommand(change.currentStage, change.status);
    activeChanges.push(change);
  }

  if (jsonOutput) {
    process.stdout.write(
      JSON.stringify({ workflow: configuredWorkflow, changes: activeChanges }) + '\n',
    );
    return;
  }
  if (activeChanges.length === 0) {
    console.log('No active changes. Use /smart-issue <description> to start.');
    return;
  }
  if (configuredWorkflow) {
    console.log(
      `Workflow: ${configuredWorkflow.source} [${configuredWorkflow.supportLevel}] ${configuredWorkflow.resolvedDigest.slice(0, 12)}\n`,
    );
  }
  console.log(`Active changes (${activeChanges.length}):\n`);
  for (const change of activeChanges) {
    console.log(`  * ${change.name}`);
    console.log(
      `    Stage: ${change.currentStage ?? 'done'}  |  Route: ${change.route}  |  Status: ${change.status}`,
    );
    if (change.nextCommand) console.log(`    Next: ${change.nextCommand}`);
  }
  console.log('\nUse /smart to resume the recommended workflow stage automatically.');
}
