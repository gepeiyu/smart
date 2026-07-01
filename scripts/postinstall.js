#!/usr/bin/env node

import { execFileSync } from 'child_process';

try {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  execFileSync(npm, ['ls', '@gepeiyu/smart', '-g', '--json'], {
    stdio: 'ignore',
    timeout: 10_000,
  });
} catch {
  // Not installed globally — skip
}
