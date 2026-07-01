import { promises as fs } from 'fs';
import path from 'path';
import { fileExists } from '../utils/file-system.js';
import type { VerificationSummary, VerificationItem } from './types.js';

export async function readVerification(changeDir: string): Promise<VerificationSummary | null> {
  const reportPath = path.join(changeDir, 'verification_report.md');
  if (!(await fileExists(reportPath))) {
    return null;
  }
  const content = await fs.readFile(reportPath, 'utf-8');
  return parseVerification(content, reportPath);
}

export function parseVerification(content: string, reportPath: string): VerificationSummary {
  const items: VerificationItem[] = [];
  const lines = content.split('\n');

  let result = 'unknown';

  for (const line of lines) {
    const checkMatch = line.match(/^-\s+\[([ xX])\]\s+(.+)/i);
    if (checkMatch) {
      const passed = checkMatch[1].toLowerCase() === 'x';
      const check = checkMatch[2].trim();
      items.push({ check, passed, detail: '' });
      continue;
    }

    const resultMatch = line.match(/#+\s*Result:?\s*(.+)/i);
    if (resultMatch) {
      result = resultMatch[1].trim().toLowerCase();
    }
  }

  if (result === 'unknown') {
    const allPassed = items.length > 0 && items.every(i => i.passed);
    result = allPassed ? 'pass' : items.some(i => i.passed) ? 'partial' : 'fail';
  }

  return { result, reportPath, items };
}
