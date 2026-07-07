import type { ChangeInfo, NextAction } from './types.js';

const COMMAND_MAP: Record<string, { command: string; label: string }> = {
  issue: { command: 'smart-design', label: 'Smart Design' },
  design: { command: 'smart-build', label: 'Smart Build' },
  build: { command: 'smart-verify', label: 'Smart Verify' },
  verify: { command: 'smart-verify', label: 'Smart Verify' },
  archive: { command: 'smart-archive', label: 'Smart Archive' },
};

function modeCommand(workflow: string): { command: string; label: string } | null {
  if (workflow === 'bugfix') return { command: 'smart-bugfix', label: 'Smart Bugfix' };
  if (workflow === 'quick') return { command: 'smart-quick', label: 'Smart Quick' };
  return null;
}

export function recommendNextAction(change: ChangeInfo): NextAction | null {
  if (change.archived) {
    return {
      change: change.name,
      command: '',
      label: 'Archived',
      reason: 'Change is archived',
    };
  }

  if (change.verifyResult === 'fail' && change.phase === 'verify') {
    return {
      change: change.name,
      command: 'smart-build',
      label: 'Smart Build',
      reason: 'Verification failed — rebuild to fix issues',
    };
  }

  if (change.verifyResult === 'pass' && change.phase === 'verify') {
    return {
      change: change.name,
      command: 'smart-archive',
      label: 'Smart Archive',
      reason: 'Verification passed — ready to archive',
    };
  }

  const modeMapping = ['issue', 'build'].includes(change.phase) ? modeCommand(change.workflow) : null;
  const mapping = modeMapping ?? COMMAND_MAP[change.phase];
  if (mapping) {
    return {
      change: change.name,
      command: mapping.command,
      label: mapping.label,
      reason: `Current phase is "${change.phase}"`,
    };
  }

  return null;
}
