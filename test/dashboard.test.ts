import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import os from 'os';
import path from 'path';
import { dashboardCommand } from '../src/commands/dashboard.js';
import { createWorkingDirs } from '../src/core/skills.js';
import { resolveDashboardApiRequest } from '../src/dashboard/server.js';

const projects: string[] = [];

describe('Smart dashboard API', () => {
  afterEach(async () => {
    await Promise.all(projects.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('serves the shared project snapshot contract', async () => {
    const project = await mkdtemp(path.join(os.tmpdir(), 'smart-dashboard-'));
    projects.push(project);

    const response = await resolveDashboardApiRequest(project, 'GET', '/api/snapshot');

    expect(response?.status).toBe(200);
    expect(response?.body).toMatchObject({
      version: 1,
      projectPath: project,
      health: 'uninitialized',
      language: 'en',
    });
  });

  it('serves snapshots in the language selected during initialization', async () => {
    const project = await mkdtemp(path.join(os.tmpdir(), 'smart-dashboard-'));
    projects.push(project);
    await createWorkingDirs(project, 'zh');

    const response = await resolveDashboardApiRequest(project, 'GET', '/api/snapshot');

    expect(response?.body).toMatchObject({ language: 'zh' });
  });

  it('supports a temporary dashboard language override', async () => {
    const project = await mkdtemp(path.join(os.tmpdir(), 'smart-dashboard-'));
    projects.push(project);
    await createWorkingDirs(project, 'zh');

    const response = await resolveDashboardApiRequest(project, 'GET', '/api/snapshot', {
      language: 'en',
    });

    expect(response?.body).toMatchObject({ language: 'en' });
  });

  it('rejects mutating API methods', async () => {
    const project = await mkdtemp(path.join(os.tmpdir(), 'smart-dashboard-'));
    projects.push(project);

    const response = await resolveDashboardApiRequest(project, 'POST', '/api/snapshot');

    expect(response).toEqual({ status: 405, body: { error: 'Method Not Allowed' } });
  });

  it('leaves static routes to the server adapter', async () => {
    const response = await resolveDashboardApiRequest('/project', 'GET', '/');

    expect(response).toBeNull();
  });

  it('rejects partially numeric port values', async () => {
    await expect(dashboardCommand('/project', { port: '5271abc', noOpen: true })).rejects.toThrow(
      'Dashboard port must be an integer between 0 and 65535',
    );
  });

  it('rejects unsupported language overrides', async () => {
    await expect(dashboardCommand('/project', { json: true, language: 'fr' })).rejects.toThrow(
      'Language must be en or zh',
    );
  });
});
