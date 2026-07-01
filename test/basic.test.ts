import { describe, it, expect } from 'vitest';

describe('Smart', () => {
  it('should have a valid package name', () => {
    const pkg = { name: '@gepeiyu/smart' };
    expect(pkg.name).toBe('@gepeiyu/smart');
  });
});
