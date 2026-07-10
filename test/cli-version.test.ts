import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const repoRoot = path.resolve(import.meta.dirname, '..');

describe('CLI version wiring', () => {
  it('uses the package version instead of a hardcoded literal', () => {
    const source = readFileSync(path.join(repoRoot, 'src', 'cli', 'index.ts'), 'utf8');

    expect(source).toContain('getCurrentVersion');
    expect(source).not.toMatch(/\.version\(['"]\d+\.\d+\.\d+['"]/);
  });

  it('keeps every release version source synchronized', () => {
    const packageJson = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as { version: string };
    const packageLock = JSON.parse(readFileSync(path.join(repoRoot, 'package-lock.json'), 'utf8')) as {
      version: string;
      packages: Record<string, { version: string }>;
    };
    const manifest = JSON.parse(readFileSync(path.join(repoRoot, 'assets', 'manifest.json'), 'utf8')) as {
      version: string;
    };

    expect(packageLock.version).toBe(packageJson.version);
    expect(packageLock.packages[''].version).toBe(packageJson.version);
    expect(manifest.version).toBe(packageJson.version);
  });
});
