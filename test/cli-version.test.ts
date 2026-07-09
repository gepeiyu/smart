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
});
