import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const batsArgs = process.argv.slice(2);
if (batsArgs.length === 0) {
  console.error('Usage: node scripts/run-bats.js <test-glob>');
  process.exit(1);
}

try {
  const result = execFileSync('bats', ['--no-parallel', ...batsArgs], {
    cwd: repoRoot,
    stdio: 'inherit',
    timeout: 120_000,
  });
  process.exit(result.status ?? 0);
} catch (err) {
  const exitCode = (err as { status?: number }).status ?? 1;
  if (exitCode !== 0) {
    console.error(`bats exited with code ${exitCode}`);
  }
  process.exit(exitCode);
}
