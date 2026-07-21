import type { ChangeInfo, NextAction } from './types.js';

const COMMAND_MAP: Record<string, { command: string; label: string }> = {
  issue: { command: 'smart-issue', label: 'Smart Issue' },
  design: { command: 'smart-design', label: 'Smart Design' },
  build: { command: 'smart-build', label: 'Smart Build' },
  verify: { command: 'smart-verify', label: 'Smart Verify' },
  archive: { command: 'smart-archive', label: 'Smart Archive' },
};

export function recommendNextAction(change: ChangeInfo): NextAction | null {
  if (change.archived) {
    return {
      change: change.name,
      command: '',
      label: 'Archived',
      reason: 'Change is archived',
    };
  }

  if (change.verifyResult === 'fail') {
    return {
      change: change.name,
      command: 'smart run status',
      label: 'Blocked',
      reason: 'Run is blocked; inspect and resume after fixing the cause',
    };
  }

  const mapping = COMMAND_MAP[change.phase];
  if (mapping) {
    return {
      change: change.name,
      command: mapping.command,
      label: mapping.label,
      reason: `Current stage is "${change.phase}"`,
    };
  }

  return null;
}
