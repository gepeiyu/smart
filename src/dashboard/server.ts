import http from 'http';
import path from 'path';
import { promises as fs } from 'fs';
import { fileExists } from '../utils/file-system.js';
import {
  localize,
  parseProjectLanguage,
  readConfiguredProjectLanguage,
  requireProjectLanguage,
} from '../project/language.js';
import type { ProjectLanguage } from '../project/types.js';
import { collectDashboardSnapshot } from './collector.js';
import { openBrowser } from './open-browser.js';

const DEFAULT_PORT = 5271;
const STATIC_DIR = path.resolve(import.meta.dirname, 'web');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

export interface ServerOptions {
  port?: number;
  noOpen?: boolean;
  json?: boolean;
  language?: string;
}

function sendJson(res: http.ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(JSON.stringify(value));
}

export interface DashboardApiResponse {
  status: number;
  body: unknown;
}

export async function resolveDashboardApiRequest(
  projectPath: string,
  method: string | undefined,
  pathname: string,
  options: { language?: ProjectLanguage } = {},
): Promise<DashboardApiResponse | null> {
  if (!pathname.startsWith('/api/')) return null;
  if (method !== 'GET') return { status: 405, body: { error: 'Method Not Allowed' } };
  if (pathname === '/api/snapshot') {
    return {
      status: 200,
      body: await collectDashboardSnapshot(projectPath, { language: options.language }),
    };
  }
  if (pathname === '/api/health') return { status: 200, body: { status: 'ok' } };
  return { status: 404, body: { error: 'Not Found' } };
}

export async function startDashboard(
  projectPath: string,
  options: ServerOptions = {},
): Promise<http.Server | null> {
  const port = options.port ?? DEFAULT_PORT;
  const language =
    requireProjectLanguage(options.language) ?? (await readConfiguredProjectLanguage(projectPath));

  if (options.json) {
    const snapshot = await collectDashboardSnapshot(projectPath, { language });
    process.stdout.write(JSON.stringify(snapshot, null, 2) + '\n');
    return null;
  }

  const server = http.createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
      const requestedLanguage = requestUrl.searchParams.get('lang');
      if (requestedLanguage && !parseProjectLanguage(requestedLanguage)) {
        sendJson(res, 400, { error: 'Language must be en or zh' });
        return;
      }
      const apiResponse = await resolveDashboardApiRequest(
        projectPath,
        req.method,
        requestUrl.pathname,
        { language: parseProjectLanguage(requestedLanguage) ?? language },
      );
      if (apiResponse) {
        sendJson(res, apiResponse.status, apiResponse.body);
        return;
      }

      if (req.method !== 'GET') {
        sendJson(res, 405, { error: 'Method Not Allowed' });
        return;
      }

      const urlPath = requestUrl.pathname;
      const relativePath = urlPath === '/' ? 'index.html' : urlPath.slice(1);
      const filePath = path.resolve(STATIC_DIR, relativePath);

      const relative = path.relative(STATIC_DIR, filePath);
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      if (await fileExists(filePath)) {
        const ext = path.extname(filePath);
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        const content = await fs.readFile(filePath);
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      } else {
        sendJson(res, 404, { error: 'Not Found' });
      }
    } catch (error) {
      sendJson(res, 500, { error: (error as Error).message });
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(port, '127.0.0.1', () => {
      resolve();
    });
    server.on('error', reject);
  });

  const address = server.address();
  const actualPort = typeof address === 'object' && address ? address.port : port;
  const url = `http://127.0.0.1:${actualPort}`;
  console.log(localize(language, `Smart Dashboard running at ${url}`, `Smart 仪表盘运行于 ${url}`));

  if (!options.noOpen) {
    openBrowser(url);
  }
  return server;
}
