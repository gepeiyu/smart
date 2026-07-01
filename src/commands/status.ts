import path from 'path';
import { readDir, fileExists } from '../utils/file-system.js';
import { promises as fs } from 'fs';

interface SmartYamlField {
  phase?: string;
  workflow?: string;
  issue_number?: string;
  issue_title?: string;
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
  const activeChanges: Array<{ name: string; phase: string; workflow: string; issue: string; title: string }> = [];

  for (const name of entries) {
    if (name === 'archive' || name === '.archive') continue;
    const changeDir = path.join(changesDir, name);
    const yaml = await readSmartYaml(changeDir);
    if (yaml) {
      activeChanges.push({
        name,
        phase: yaml.phase || 'open',
        workflow: yaml.workflow || 'full',
        issue: yaml.issue_number || '',
        title: yaml.issue_title || '',
      });
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
  }

  console.log(`\nNext commands:
  /smart-issue   — Create or select a change
  /smart-design  — Generate design document
  /smart-build   — Generate build specification
  /smart-verify  — Run verification
  /smart-archive — Archive completed changes`);
}
