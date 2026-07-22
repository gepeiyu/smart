import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { doctorCommand } from '../src/commands/doctor.js';
import { createWorkingDirs } from '../src/core/skills.js';
import { OFFICIAL_INTEGRATION_REGISTRY } from '../src/integrations/catalog.js';
import { collectProjectSnapshot } from '../src/project/inspection.js';
import { resolveProjectWorkflow, setProjectWorkflow } from '../src/workflows/store.js';

const projects: string[] = [];

async function project(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'smart-inspection-'));
  projects.push(dir);
  return dir;
}

async function configuredProject(language: 'en' | 'zh' = 'en'): Promise<string> {
  const dir = await project();
  await createWorkingDirs(dir, language);
  const resolution = await resolveProjectWorkflow(
    dir,
    'official/quick',
    OFFICIAL_INTEGRATION_REGISTRY,
  );
  await setProjectWorkflow(dir, 'official/quick', resolution);
  return dir;
}

describe('collectProjectSnapshot', () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(projects.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('reports an uninitialized project with actionable setup diagnostics', async () => {
    const snapshot = await collectProjectSnapshot(await project());

    expect(snapshot.version).toBe(1);
    expect(snapshot.health).toBe('uninitialized');
    expect(snapshot.initialized).toBe(false);
    expect(snapshot.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'setup.layout', status: 'fail' }),
        expect.objectContaining({ id: 'setup.configuration', status: 'fail' }),
        expect.objectContaining({ id: 'workflow.configuration', status: 'fail' }),
      ]),
    );
  });

  it('uses the configured workflow as the shared status and dashboard source', async () => {
    const snapshot = await collectProjectSnapshot(await configuredProject());

    expect(snapshot.health).toBe('healthy');
    expect(snapshot.workflow).toMatchObject({
      configured: true,
      source: 'official/quick',
      valid: true,
      drifted: false,
    });
    expect(snapshot.integrations.map((integration) => integration.id)).toEqual([
      'openspec',
      'superpowers',
    ]);
  });

  it('uses the language selected during initialization and supports an explicit override', async () => {
    const dir = await configuredProject('zh');

    const automatic = await collectProjectSnapshot(dir);
    const overridden = await collectProjectSnapshot(dir, { language: 'en' });

    expect(automatic.language).toBe('zh');
    expect(automatic.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'setup.configuration', title: 'Smart 配置' }),
      ]),
    );
    expect(overridden.language).toBe('en');
    expect(overridden.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'setup.configuration', title: 'Smart configuration' }),
      ]),
    );
  });

  it('renders doctor output in the initialized project language', async () => {
    const dir = await configuredProject('zh');
    const lines: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((...values: unknown[]) => {
      lines.push(values.join(' '));
    });

    await doctorCommand(dir);

    expect(lines.join('\n')).toContain('Smart 诊断');
    expect(lines.join('\n')).toContain('项目设置');
  });

  it('rejects unsupported display languages', async () => {
    await expect(collectProjectSnapshot(await project(), { language: 'fr' })).rejects.toThrow(
      'Language must be en or zh',
    );
  });

  it('returns the post-repair snapshot from doctor --fix', async () => {
    const dir = await project();
    let output = '';
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
      output += chunk.toString();
      return true;
    });

    await doctorCommand(dir, { fix: true, json: true });

    const result = JSON.parse(output);
    expect(result.fixes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'create-project-layout', status: 'fixed' }),
      ]),
    );
    expect(result.snapshot.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'setup.layout', status: 'pass' }),
        expect.objectContaining({ id: 'setup.configuration', status: 'pass' }),
      ]),
    );
  });

  it('surfaces malformed run state as a blocking diagnostic', async () => {
    const dir = await configuredProject();
    const runDir = path.join(dir, 'smartdocs', 'changes', 'broken');
    await mkdir(runDir, { recursive: true });
    await writeFile(path.join(runDir, '.smart.yaml'), 'version: 1\nstatus: nope\n');

    const snapshot = await collectProjectSnapshot(dir);

    expect(snapshot.health).toBe('blocked');
    expect(snapshot.summary.invalid).toBe(1);
    expect(snapshot.runs[0]).toMatchObject({ name: 'broken', status: 'invalid' });
  });
});
