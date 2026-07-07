import path from 'path';
import { readDir, fileExists } from '../utils/file-system.js';
import { promises as fs } from 'fs';

interface SmartYamlField {
  phase?: string;
  workflow?: string;
  issue_number?: string;
  issue_title?: string;
  verify_result?: string;
  archived?: string;
}

interface ActiveChange {
  name: string;
  phase: string;
  workflow: string;
  issue: string;
  title: string;
  verifyResult: string;
  archived: boolean;
  nextCommand: string | null;
}

function recommendNextCommand(change: Pick<ActiveChange, 'phase' | 'workflow' | 'verifyResult' | 'archived'>): string | null {
  if (change.archived) return null;
  if (change.phase === 'verify' && change.verifyResult === 'pass') return '/smart-archive';
  if (change.phase === 'verify' && change.verifyResult === 'fail') return '/smart-build';

  switch (change.phase) {
    case 'issue':
      if (change.workflow === 'bugfix') return '/smart-bugfix';
      if (change.workflow === 'quick') return '/smart-quick';
      return '/smart-design';
    case 'design':
      return '/smart-build';
    case 'build':
      if (change.workflow === 'bugfix') return '/smart-bugfix';
      if (change.workflow === 'quick') return '/smart-quick';
      return '/smart-verify';
    case 'verify':
      return '/smart-verify';
    default:
      return '/smart';
  }
}

async function readSmartYaml(changeDir: string): Promise<SmartYamlField | null> {
  const yamlPath = path.join(changeDir, '.smart.yaml');
  if (!(await fileExists(yamlPath))) return null;
  try {
    const content = await fs.readFile(yamlPath, 'utf-8');
    const fields: SmartYamlField = {};
    for (const line of content.split('\n')) {
      const match = line.match(/^(\w+)\s*:\s*(.+)$/);
      if (match) {
        const key = match[1] as keyof SmartYamlField;
        fields[key] = match[2].trim();
      }
    }
    return fields;
  } catch {
    return null;
  }
}

export async function statusCommand(targetPath: string, opts?: Record<string, unknown>): Promise<void> {
  const cwd = targetPath || process.cwd();
  const jsonOutput = opts?.json === true;

  const changesDir = path.join(cwd, 'openspec', 'changes');
  if (!(await fileExists(changesDir))) {
    const msg = 'No openspec/changes/ directory. Run smart init first and use /smart-issue to create a change.';
    if (jsonOutput) {
      process.stdout.write(JSON.stringify({ error: msg, changes: [] }) + '\n');
    } else {
      console.log(msg);
    }
    return;
  }

  const entries = await readDir(changesDir);
  const activeChanges: ActiveChange[] = [];

  for (const name of entries) {
    if (name === 'archive' || name === '.archive') continue;
    const changeDir = path.join(changesDir, name);
    const yaml = await readSmartYaml(changeDir);
    if (yaml) {
      const change: ActiveChange = {
        name,
        phase: yaml.phase || 'issue',
        workflow: yaml.workflow || 'full',
        issue: yaml.issue_number || '',
        title: yaml.issue_title || '',
        verifyResult: yaml.verify_result || 'pending',
        archived: yaml.archived === 'true',
        nextCommand: null,
      };
      change.nextCommand = recommendNextCommand(change);
      activeChanges.push(change);
    }
  }

  if (jsonOutput) {
    process.stdout.write(JSON.stringify({ changes: activeChanges }) + '\n');
    return;
  }

  if (activeChanges.length === 0) {
    console.log('No active changes. Use /smart-issue <description> or /smart-issue #<id> to start.');
    return;
  }

  console.log(`Active changes (${activeChanges.length}):\n`);
  for (const change of activeChanges) {
    const issueInfo = change.issue ? ` #${change.issue}` : '';
    const titleInfo = change.title ? ` — ${change.title}` : '';
    console.log(`  ● ${change.name}${issueInfo}${titleInfo}`);
    console.log(`    Phase: ${change.phase}  |  Workflow: ${change.workflow}`);
    if (change.nextCommand) console.log(`    Next: ${change.nextCommand}`);
  }

  console.log(`\nUse /smart to resume the recommended workflow step automatically.`);
}
