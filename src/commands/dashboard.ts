import { startDashboard } from '../dashboard/server.js';

export async function dashboardCommand(targetPath: string, opts?: Record<string, unknown>): Promise<void> {
  const cwd = targetPath || process.cwd();
  const port = typeof opts?.port === 'number' ? opts.port : typeof opts?.port === 'string' ? parseInt(opts.port, 10) : undefined;
  const noOpen = opts?.noOpen === false ? false : opts?.open === false;
  const json = opts?.json === true;

  await startDashboard(cwd, { port, noOpen, json });
}
