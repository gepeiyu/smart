import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/core/codegraph.js', () => ({
  hasCodegraphProjectIndex: vi.fn(),
  initializeCodegraph: vi.fn(),
  installCodegraph: vi.fn(),
  resolveCodegraphCommand: vi.fn(),
}));

vi.mock('../src/core/openspec.js', () => ({
  installOpenSpec: vi.fn(),
  resolveOpenSpecCommand: vi.fn(),
}));

vi.mock('../src/core/superpowers.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/core/superpowers.js')>();
  return { ...actual, installSuperpowersForPlatforms: vi.fn() };
});

vi.mock('../src/utils/file-system.js', () => ({ readDir: vi.fn() }));

import {
  hasCodegraphProjectIndex,
  initializeCodegraph,
  installCodegraph,
  resolveCodegraphCommand,
} from '../src/core/codegraph.js';
import { installOpenSpec, resolveOpenSpecCommand } from '../src/core/openspec.js';
import { readDir } from '../src/utils/file-system.js';
import { OFFICIAL_INTEGRATIONS } from '../src/integrations/catalog.js';
import {
  IntegrationRuntimeRegistry,
  OFFICIAL_INTEGRATION_RUNTIMES,
  type IntegrationRuntime,
} from '../src/integrations/runtime.js';

const context = {
  projectPath: '/project',
  baseDir: '/project',
  scope: 'project' as const,
  platformIds: ['claude', 'kimicode'],
};

describe('integration runtime registry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readDir).mockResolvedValue([]);
    vi.mocked(resolveOpenSpecCommand).mockReturnValue(null);
    vi.mocked(resolveCodegraphCommand).mockReturnValue(null);
    vi.mocked(hasCodegraphProjectIndex).mockResolvedValue(false);
  });

  it('registers one runtime for every official integration', () => {
    expect(OFFICIAL_INTEGRATION_RUNTIMES.list().map((runtime) => runtime.manifest.id)).toEqual(
      OFFICIAL_INTEGRATIONS.map((manifest) => manifest.id),
    );
  });

  it('rejects duplicate runtime ids', () => {
    const runtime = OFFICIAL_INTEGRATION_RUNTIMES.require('openspec');
    expect(() => new IntegrationRuntimeRegistry([runtime, runtime])).toThrow(
      'Duplicate integration runtime: openspec',
    );
  });

  it('uses manifest platform mappings when installing OpenSpec', async () => {
    vi.mocked(installOpenSpec).mockResolvedValue('installed');
    const runtime = OFFICIAL_INTEGRATION_RUNTIMES.require('openspec');

    const result = await runtime.install({ ...context, installDependency: true });

    expect(installOpenSpec).toHaveBeenCalledWith('/project', ['claude', 'kimi'], 'project', true);
    expect(result.platformStatuses).toEqual({ claude: 'installed', kimicode: 'installed' });
  });

  it('detects installed skill artifacts per platform', async () => {
    vi.mocked(readDir).mockResolvedValueOnce(['openspec-propose']).mockResolvedValueOnce(['smart']);
    const runtime = OFFICIAL_INTEGRATION_RUNTIMES.require('openspec');

    const detection = await runtime.detect(context);

    expect(detection.installedOnPlatforms).toEqual({ claude: true, kimicode: false });
  });

  it('initializes CodeGraph after installing a missing dependency', async () => {
    vi.mocked(installCodegraph).mockReturnValue(true);
    vi.mocked(initializeCodegraph).mockReturnValue(true);
    const runtime = OFFICIAL_INTEGRATION_RUNTIMES.require('codegraph');

    const result = await runtime.install({ ...context, installDependency: true });

    expect(installCodegraph).toHaveBeenCalledWith('project', '/project');
    expect(initializeCodegraph).toHaveBeenCalledWith('/project');
    expect(result.status).toBe('installed');
  });

  it('does not install an unselected missing dependency', async () => {
    const runtime = OFFICIAL_INTEGRATION_RUNTIMES.require('codegraph');

    const result = await runtime.install({ ...context, installDependency: false });

    expect(installCodegraph).not.toHaveBeenCalled();
    expect(result.status).toBe('skipped');
  });

  it('requires a runtime for every integration used by a workflow', () => {
    const runtime = OFFICIAL_INTEGRATION_RUNTIMES.require('openspec');
    const incomplete = new IntegrationRuntimeRegistry([runtime as IntegrationRuntime]);
    expect(() => incomplete.require('missing')).toThrow('Integration runtime not found: missing');
  });
});
