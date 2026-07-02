import type { ChangeInfo, Risk } from './types.js';

export function assessRisks(changes: ChangeInfo[]): Risk[] {
  const risks: Risk[] = [];

  for (const change of changes) {
    if (change.phase === 'issue' && !change.tasks) {
      risks.push({
        change: change.name,
        level: 'medium',
        message: `Change "${change.name}" has no tasks defined`,
      });
    }

    if (change.phase === 'verify' && change.verifyResult === 'fail') {
      risks.push({
        change: change.name,
        level: 'high',
        message: `Change "${change.name}" failed verification`,
      });
    }

    if (change.phase === 'verify' && change.branchStatus !== 'handled') {
      risks.push({
        change: change.name,
        level: 'medium',
        message: `Change "${change.name}" has unhandled branch`,
      });
    }

    if (change.tasks && change.tasks.percent < 100 && change.phase !== 'issue') {
      risks.push({
        change: change.name,
        level: 'low',
        message: `Change "${change.name}" has incomplete tasks (${change.tasks.percent}%)`,
      });
    }

    if (change.phase === 'build' && !change.plan) {
      risks.push({
        change: change.name,
        level: 'low',
        message: `Change "${change.name}" has no plan defined`,
      });
    }
  }

  const activeCount = changes.filter(c => !c.archived).length;
  if (activeCount > 5) {
    risks.push({
      change: null,
      level: 'medium',
      message: `${activeCount} active changes — consider archiving completed work`,
    });
  }

  return risks;
}
