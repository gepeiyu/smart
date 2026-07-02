import path from 'path';
import { readDir } from '../utils/file-system.js';
import { readSmartYaml } from './yaml.js';
import { readTasks } from './task-parser.js';
import { readVerification } from './verify-parser.js';
import { collectGitSnapshot } from './git.js';
import { assessRisks } from './risk.js';
import { recommendNextAction } from './next-action.js';
import type { DashboardSnapshot, ChangeInfo, NextAction, Risk } from './types.js';

export async function collectDashboardSnapshot(projectPath: string): Promise<DashboardSnapshot> {
  const changesDir = path.join(projectPath, 'openspec', 'changes');
  const changeDirs = await readDir(changesDir);

  const allChanges: ChangeInfo[] = [];
  const changes: ChangeInfo[] = [];
  const archived: ChangeInfo[] = [];

  for (const dirName of changeDirs) {
    const changeDir = path.join(changesDir, dirName);
    const yaml = await readSmartYaml(changeDir);
    if (!yaml) continue;

    const tasks = await readTasks(changeDir);
    const verification = await readVerification(changeDir);

    const info: ChangeInfo = {
      name: dirName,
      phase: yaml.phase || 'issue',
      workflow: yaml.workflow || 'full',
      autoTransition: yaml.auto_transition ?? true,
      verifyResult: yaml.verify_result || 'pending',
      branchStatus: yaml.branch_status || 'pending',
      archived: yaml.archived ?? false,
      designDoc: yaml.design_doc || null,
      plan: yaml.plan || null,
      tasks,
      verification,
      nextAction: null,
      risks: [],
    };

    allChanges.push(info);

    if (info.archived) {
      archived.push(info);
    } else {
      changes.push(info);
    }
  }

  const nextActions: NextAction[] = [];
  for (const change of changes) {
    const action = recommendNextAction(change);
    if (action) {
      change.nextAction = action.command || null;
      nextActions.push(action);
    }
  }

  const risks: Risk[] = assessRisks(allChanges);
  for (const risk of risks) {
    if (risk.change) {
      const change = allChanges.find(c => c.name === risk.change);
      if (change) {
        change.risks.push(risk.message);
      }
    }
  }

  const git = collectGitSnapshot(projectPath);

  return {
    changes,
    archived,
    projectPath,
    git: git || undefined,
    nextActions,
    risks,
    generatedAt: new Date().toISOString(),
  };
}
