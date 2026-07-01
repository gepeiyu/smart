import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('module', () => ({
  createRequire: () => (id: string) => {
    if (id.endsWith('package.json')) return { version: '0.5.0' };
    return {};
  },
}));

vi.mock('https', () => ({
  default: { get: vi.fn() },
  get: vi.fn(),
}));

import https from 'https';
import { compareVersions, getCurrentVersion, checkForUpdate, printVersionInfo } from '../src/core/version.js';

describe('version', () => {
  it('compareVersions returns 0 for equal versions', () => {
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
  });

  it('compareVersions returns negative when a < b', () => {
    expect(compareVersions('1.2.3', '2.0.0')).toBeLessThan(0);
  });

  it('compareVersions returns positive when a > b', () => {
    expect(compareVersions('2.0.0', '1.9.9')).toBeGreaterThan(0);
  });

  it('compareVersions handles v prefix', () => {
    expect(compareVersions('v1.2.3', '1.2.3')).toBe(0);
  });

  it('compareVersions handles different lengths', () => {
    expect(compareVersions('1.2', '1.2.0')).toBe(0);
  });

  it('getCurrentVersion returns the mock version', () => {
    expect(getCurrentVersion()).toBe('0.5.0');
  });
});

describe('checkForUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns hasUpdate=false when latest is null', async () => {
    vi.mocked(https.get).mockImplementation((_url: string | URL, _options: unknown, callback?: (res: unknown) => void): unknown => {
      const res = {
        statusCode: 500,
        resume: vi.fn(),
        on: vi.fn(),
      };
      if (callback) callback(res);
      return { on: vi.fn(), destroy: vi.fn() };
    });
    const result = await checkForUpdate();
    expect(result.hasUpdate).toBe(false);
    expect(result.checked).toBe(false);
  });

  it('returns hasUpdate when latest > current', async () => {
    vi.mocked(https.get).mockImplementation((_url: string | URL, _options: unknown, callback?: (res: unknown) => void): unknown => {
      const res = {
        statusCode: 200,
        resume: vi.fn(),
        on: function (this: unknown, _event: string, cb: (chunk: string) => void) {
          if (_event === 'data') cb(JSON.stringify({ version: '99.0.0' }));
          if (_event === 'end') (cb as () => void)('');
          return this;
        },
      };
      if (callback) callback(res);
      return { on: vi.fn(), destroy: vi.fn() };
    });
    const result = await checkForUpdate();
    expect(result.hasUpdate).toBe(true);
    expect(result.checked).toBe(true);
  });
});

describe('printVersionInfo', () => {
  it('logs version info', async () => {
    vi.mocked(https.get).mockImplementation((_url: string | URL, _options: unknown, callback?: (res: unknown) => void): unknown => {
      const res = {
        statusCode: 500,
        resume: vi.fn(),
        on: vi.fn(),
      };
      if (callback) callback(res);
      return { on: vi.fn(), destroy: vi.fn() };
    });
    const logs: string[] = [];
    const log = (msg: string) => { logs.push(msg); };
    const result = await printVersionInfo(log);
    expect(logs[0]).toContain('Smart v0.5.0');
    expect(result.currentVersion).toBe('0.5.0');
  });
});
