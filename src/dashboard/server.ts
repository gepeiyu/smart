import http from 'http';
import path from 'path';
import { promises as fs } from 'fs';
import { fileExists } from '../utils/file-system.js';
import { collectDashboardSnapshot } from './collector.js';
import { openBrowser } from './open-browser.js';

const DEFAULT_PORT = 4321;
const STATIC_DIR = path.resolve(import.meta.dirname, '..', '..', 'assets', 'dashboard');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

interface ServerOptions {
  port?: number;
  noOpen?: boolean;
  json?: boolean;
}

export async function startDashboard(projectPath: string, options: ServerOptions = {}): Promise<void> {
  const port = options.port ?? DEFAULT_PORT;

  if (options.json) {
    const snapshot = await collectDashboardSnapshot(projectPath);
    process.stdout.write(JSON.stringify(snapshot, null, 2) + '\n');
    return;
  }

  const server = http.createServer(async (req, res) => {
    try {
      if (req.url === '/api/dashboard') {
        const snapshot = await collectDashboardSnapshot(projectPath);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(snapshot));
        return;
      }

      let filePath = req.url === '/' ? '/index.html' : req.url;
      filePath = path.join(STATIC_DIR, filePath || 'index.html');

      if (!filePath.startsWith(STATIC_DIR)) {
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
        res.writeHead(404);
        res.end('Not Found');
      }
    } catch {
      res.writeHead(500);
      res.end('Internal Server Error');
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(port, '127.0.0.1', () => {
      resolve();
    });
    server.on('error', reject);
  });

  const url = `http://127.0.0.1:${port}`;
  console.log(`Smart Dashboard running at ${url}`);

  if (!options.noOpen) {
    openBrowser(url);
  }
}
