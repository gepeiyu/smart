import { Command } from 'commander';
import { initCommand } from '../commands/init.js';
import { statusCommand } from '../commands/status.js';
import { dashboardCommand } from '../commands/dashboard.js';
import { doctorCommand } from '../commands/doctor.js';
import { updateCommand } from '../commands/update.js';
import { uninstallCommand } from '../commands/uninstall.js';
import {
  createWorkflowCommand,
  exportWorkflowCommand,
  listWorkflowsCommand,
  useWorkflowCommand,
  validateWorkflowCommand,
} from '../commands/workflow.js';
import {
  advanceRunCommand,
  blockRunCommand,
  evidenceRunCommand,
  initRunCommand,
  resumeRunCommand,
  statusRunCommand,
  switchRunCommand,
} from '../commands/run.js';
import { getCurrentVersion } from '../core/version.js';
import {
  createIntegrationCommand,
  listIntegrationsCommand,
  trustIntegrationCommand,
  untrustIntegrationCommand,
  validateIntegrationCommand,
} from '../commands/integration.js';

const SKILL_COMMANDS = [
  '/smart',
  '/smart-issue',
  '/smart-design',
  '/smart-build',
  '/smart-verify',
  '/smart-archive',
  '/smart-bugfix',
  '/smart-quick',
];

const program = new Command();

program
  .name('smart')
  .description('User-facing orchestration for verified AI development workflows')
  .version(getCurrentVersion(), '-v, --version', 'Display version')
  .helpOption('-h, --help', 'Display help')
  .addHelpText('after', `\nSkill Commands:\n  ${SKILL_COMMANDS.join('\n  ')}\n`);

program
  .command('init')
  .description('Initialize Smart in a project')
  .argument('[path]', 'Project path')
  .option('--yes', 'Non-interactive mode')
  .option('--scope <scope>', 'Install scope (project | global)')
  .option('--skip-existing', 'Skip already installed components')
  .option('--overwrite', 'Overwrite installed components')
  .option('--no-deps', 'Skip dependency installation')
  .option('--preset <preset>', 'Official workflow preset (full | workflow)')
  .option('--workflow <workflow>', 'Custom workflow id or project-relative YAML path')
  .option('--json', 'Output as JSON')
  .option('--lang <lang>', 'Language (en | zh)')
  .option('--language <language>', 'Language (en | zh)')
  .action(async (path?: string, options?: Record<string, unknown>) => {
    const normalizedOptions = { ...(options || {}) };
    if (!normalizedOptions.language && normalizedOptions.lang)
      normalizedOptions.language = normalizedOptions.lang;
    await initCommand(path || process.cwd(), normalizedOptions);
  });

program
  .command('status')
  .description('Show active changes and workflow status')
  .argument('[path]', 'Project path')
  .option('--json', 'Output as JSON')
  .action(async (path?: string, options?: Record<string, unknown>) => {
    await statusCommand(path || process.cwd(), options || {});
  });

program
  .command('dashboard')
  .description('Launch the Smart dashboard')
  .argument('[path]', 'Project path')
  .option('-p, --port <port>', 'Server port')
  .option('--no-open', 'Do not open browser')
  .option('--json', 'Output snapshot as JSON and exit')
  .action(async (path?: string, options?: Record<string, unknown>) => {
    await dashboardCommand(path || process.cwd(), options || {});
  });

program
  .command('doctor')
  .description('Diagnose Smart installation health')
  .argument('[path]', 'Project path')
  .option('--fix', 'Attempt to auto-fix issues')
  .option('--json', 'Output as JSON')
  .action(async (path?: string, options?: Record<string, unknown>) => {
    await doctorCommand(path || process.cwd(), options || {});
  });

program
  .command('update')
  .description('Update Smart npm package and skills')
  .argument('[path]', 'Project path')
  .option('--yes', 'Skip confirmation')
  .option('--scope <scope>', 'Update scope (project | global)')
  .option('--skip-npm', 'Skip npm package update')
  .option('--json', 'Output as JSON')
  .option('--lang <lang>', 'Language (en | zh)')
  .option('--language <language>', 'Language (en | zh)')
  .action(async (path?: string, options?: Record<string, unknown>) => {
    const normalizedOptions = { ...(options || {}) };
    if (!normalizedOptions.language && normalizedOptions.lang)
      normalizedOptions.language = normalizedOptions.lang;
    await updateCommand(path || process.cwd(), normalizedOptions);
  });

program
  .command('uninstall')
  .description('Uninstall Smart skills')
  .argument('[path]', 'Project path')
  .option('--force', 'Skip confirmation')
  .option('--scope <scope>', 'Uninstall scope (project | global)')
  .option('--json', 'Output as JSON')
  .action(async (path?: string, options?: Record<string, unknown>) => {
    await uninstallCommand(path || process.cwd(), options || {});
  });

const workflow = program
  .command('workflow')
  .description('Manage official presets and custom workflows');

workflow
  .command('list')
  .description('List official and project workflows')
  .argument('[path]', 'Project path')
  .option('--json', 'Output as JSON')
  .action(async (path?: string, options?: Record<string, unknown>) => {
    await listWorkflowsCommand(path || process.cwd(), options || {});
  });

workflow
  .command('validate')
  .description('Validate and resolve a workflow')
  .argument('<workflow>', 'Workflow id or project-relative YAML path')
  .argument('[path]', 'Project path')
  .option('--json', 'Output as JSON')
  .action(async (reference: string, path?: string, options?: Record<string, unknown>) => {
    await validateWorkflowCommand(path || process.cwd(), reference, options || {});
  });

workflow
  .command('create')
  .description('Create a custom workflow')
  .argument('<name>', 'Workflow name')
  .argument('[path]', 'Project path')
  .option('--extends <workflow>', 'Parent workflow', 'official/full')
  .option('--json', 'Output as JSON')
  .action(async (name: string, path?: string, options?: Record<string, unknown>) => {
    await createWorkflowCommand(path || process.cwd(), name, options || {});
  });

workflow
  .command('use')
  .description('Set the default workflow for new changes')
  .argument('<workflow>', 'Workflow id or project-relative YAML path')
  .argument('[path]', 'Project path')
  .option('--json', 'Output as JSON')
  .action(async (reference: string, path?: string, options?: Record<string, unknown>) => {
    await useWorkflowCommand(path || process.cwd(), reference, options || {});
  });

workflow
  .command('export')
  .description('Export a fully resolved workflow')
  .argument('<workflow>', 'Workflow id or project-relative YAML path')
  .argument('[path]', 'Project path')
  .option('-o, --output <file>', 'Write to a project-relative file')
  .option('--json', 'Output as JSON')
  .action(async (reference: string, path?: string, options?: Record<string, unknown>) => {
    await exportWorkflowCommand(path || process.cwd(), reference, options || {});
  });

const integration = program
  .command('integration')
  .description('Manage official and project-local integrations');

integration
  .command('list')
  .description('List official and local integrations')
  .argument('[path]', 'Project path')
  .option('--json', 'Output as JSON')
  .action(async (path?: string, options?: Record<string, unknown>) => {
    await listIntegrationsCommand(path || process.cwd(), options || {});
  });

integration
  .command('create')
  .description('Create a declarative user-managed local integration')
  .argument('<id>', 'Integration id in lowercase kebab-case')
  .argument('[path]', 'Project path')
  .requiredOption('--capabilities <items>', 'Comma-separated capabilities')
  .requiredOption('--contracts <items>', 'Comma-separated stage contract ids')
  .option('--platforms <items>', 'Comma-separated platform ids or *', '*')
  .option('--json', 'Output as JSON')
  .action(async (id: string, path?: string, options?: Record<string, unknown>) => {
    await createIntegrationCommand(path || process.cwd(), id, options || {});
  });

integration
  .command('validate')
  .description('Validate a local integration and show its digest')
  .argument('<integration>', 'Integration id or project-relative manifest path')
  .argument('[path]', 'Project path')
  .option('--json', 'Output as JSON')
  .action(async (reference: string, path?: string, options?: Record<string, unknown>) => {
    await validateIntegrationCommand(path || process.cwd(), reference, options || {});
  });

integration
  .command('trust')
  .description('Trust the exact digest of a local integration manifest')
  .argument('<integration>', 'Integration id or project-relative manifest path')
  .argument('[path]', 'Project path')
  .requiredOption('--digest <sha256>', 'Exact digest reported by validate')
  .option('--json', 'Output as JSON')
  .action(async (reference: string, path?: string, options?: Record<string, unknown>) => {
    await trustIntegrationCommand(path || process.cwd(), reference, options || {});
  });

integration
  .command('untrust')
  .description('Remove a local integration trust receipt')
  .argument('<id>', 'Integration id')
  .option('--json', 'Output as JSON')
  .action(async (id: string, options?: Record<string, unknown>) => {
    await untrustIntegrationCommand(id, options || {});
  });

const run = program.command('run').description('Manage workflow run state');

run
  .command('init')
  .description('Start a change using the configured workflow')
  .argument('<change>', 'Change name')
  .argument('[path]', 'Project path')
  .option('--route <route>', 'Execution route (standard | bugfix | quick)', 'standard')
  .option('--workflow <workflow>', 'Workflow for this change (defaults to project workflow)')
  .option('--json', 'Output as JSON')
  .action(async (change: string, path?: string, options?: Record<string, unknown>) => {
    await initRunCommand(path || process.cwd(), change, options || {});
  });

run
  .command('status')
  .description('Show state for a workflow run')
  .argument('<change>', 'Change name')
  .argument('[path]', 'Project path')
  .option('--json', 'Output as JSON')
  .action(async (change: string, path?: string, options?: Record<string, unknown>) => {
    await statusRunCommand(path || process.cwd(), change, options || {});
  });

run
  .command('advance')
  .description('Complete a ready stage and select the next one')
  .argument('<change>', 'Change name')
  .argument('[path]', 'Project path')
  .option('--stage <stage>', 'Ready stage to complete')
  .option('--confirmed', 'Confirm a gate or user checkpoint')
  .option('--accept-drift', 'Accept the current workflow definition digest')
  .option('--json', 'Output as JSON')
  .action(async (change: string, path?: string, options?: Record<string, unknown>) => {
    await advanceRunCommand(path || process.cwd(), change, options || {});
  });

run
  .command('block')
  .description('Block a workflow run with a reason')
  .argument('<change>', 'Change name')
  .argument('<reason>', 'Blocking reason')
  .argument('[path]', 'Project path')
  .option('--json', 'Output as JSON')
  .action(
    async (change: string, reason: string, path?: string, options?: Record<string, unknown>) => {
      await blockRunCommand(path || process.cwd(), change, reason, options || {});
    },
  );

run
  .command('evidence')
  .description('Record evidence for a declared workflow artifact')
  .argument('<change>', 'Change name')
  .argument('<artifact>', 'Declared artifact id')
  .argument('<value>', 'Evidence value or project-relative artifact path')
  .argument('[path]', 'Project path')
  .option('--json', 'Output as JSON')
  .action(
    async (
      change: string,
      artifact: string,
      value: string,
      path?: string,
      options?: Record<string, unknown>,
    ) => {
      await evidenceRunCommand(path || process.cwd(), change, artifact, value, options || {});
    },
  );

run
  .command('resume')
  .description('Resume a blocked workflow run')
  .argument('<change>', 'Change name')
  .argument('[path]', 'Project path')
  .option('--json', 'Output as JSON')
  .action(async (change: string, path?: string, options?: Record<string, unknown>) => {
    await resumeRunCommand(path || process.cwd(), change, options || {});
  });

run
  .command('switch')
  .description('Switch an active change to another compatible workflow')
  .argument('<change>', 'Change name')
  .argument('<workflow>', 'Target workflow')
  .argument('[path]', 'Project path')
  .requiredOption('--confirmed', 'Confirm the workflow switch')
  .option('--json', 'Output as JSON')
  .action(
    async (change: string, workflow: string, path?: string, options?: Record<string, unknown>) => {
      await switchRunCommand(path || process.cwd(), change, workflow, options || {});
    },
  );

try {
  await program.parseAsync();
} catch (error) {
  console.error(`Error: ${(error as Error).message}`);
  process.exitCode = 1;
}
