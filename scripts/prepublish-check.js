#!/usr/bin/env node

import { existsSync } from 'fs';

if (!existsSync('assets/manifest.json')) {
  console.error('ERROR: assets/manifest.json not found');
  process.exit(1);
}

if (!existsSync('dist/cli/index.js')) {
  console.error('ERROR: dist/cli/index.js not found — run build first');
  process.exit(1);
}

console.log('Pre-publish checks passed.');
