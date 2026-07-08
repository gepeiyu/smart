import { Command } from 'commander';
import { initCommand } from '../commands/init.js';
import { statusCommand } from '../commands/status.js';
import { dashboardCommand } from '../commands/dashboard.js';
import { doctorCommand } from '../commands/doctor.js';
import { updateCommand } from '../commands/update.js';
import { uninstallCommand } from '../commands/uninstall.js';

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
  .description('AI Workflow Orchestration — OpenSpec + Superpowers dual-star development pipeline')
  .version('0.1.12', '-v, --version', 'Display version')
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
  .option('--json', 'Output as JSON')
  .option('--lang <lang>', 'Language (en | zh)')
  .option('--language <language>', 'Language (en | zh)')
  .action(async (path?: string, options?: Record<string, unknown>) => {
    const normalizedOptions = { ...(options || {}) };
    if (!normalizedOptions.language && normalizedOptions.lang) normalizedOptions.language = normalizedOptions.lang;
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
    if (!normalizedOptions.language && normalizedOptions.lang) normalizedOptions.language = normalizedOptions.lang;
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

program.parse();
