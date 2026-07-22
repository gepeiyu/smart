import { execSync } from 'child_process';
import type { GitSnapshot, CommitInfo } from '../project/types.js';

export function collectGitSnapshot(projectPath: string): GitSnapshot | null {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: projectPath,
      encoding: 'utf-8',
      stdio: 'pipe',
    }).trimEnd();

    const head = execSync('git rev-parse HEAD', {
      cwd: projectPath,
      encoding: 'utf-8',
      stdio: 'pipe',
    }).trim();

    const headShort = head.slice(0, 7);

    const statusOut = execSync('git status --porcelain', {
      cwd: projectPath,
      encoding: 'utf-8',
      stdio: 'pipe',
    }).trimEnd();

    const dirtyFiles = statusOut
      ? statusOut
          .split('\n')
          .map((l) => l.slice(3).trim())
          .filter(Boolean)
      : [];
    const dirty = dirtyFiles.length > 0;

    const logOut = execSync('git log --oneline --max-count=5 --format="%H|%h|%s|%an|%ai"', {
      cwd: projectPath,
      encoding: 'utf-8',
      stdio: 'pipe',
    }).trim();

    const recentCommits: CommitInfo[] = logOut
      ? logOut.split('\n').map((line) => {
          const [hash, hashShort, message, author, date] = line.split('|');
          return { hash, hashShort, message, author, date };
        })
      : [];

    return { branch, head, headShort, dirty, dirtyFiles, recentCommits };
  } catch {
    return null;
  }
}
