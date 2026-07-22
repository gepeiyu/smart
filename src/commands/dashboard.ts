import { startDashboard } from '../dashboard/server.js';

export async function dashboardCommand(
  targetPath: string,
  opts?: Record<string, unknown>,
): Promise<void> {
  const cwd = targetPath || process.cwd();
  const port =
    typeof opts?.port === 'number'
      ? opts.port
      : typeof opts?.port === 'string'
        ? Number(opts.port)
        : undefined;
  if (port !== undefined && (!Number.isInteger(port) || port < 0 || port > 65535)) {
    throw new Error('Dashboard port must be an integer between 0 and 65535');
  }
  const noOpen = opts?.noOpen === true || opts?.open === false;
  const json = opts?.json === true;
  const language = typeof opts?.language === 'string' ? opts.language : undefined;

  await startDashboard(cwd, { port, noOpen, json, language });
}
