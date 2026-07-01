import { promises as fs } from 'fs';
import path from 'path';
import { fileExists } from '../utils/file-system.js';
import type { TaskSummary, TaskItem } from './types.js';

export async function readTasks(changeDir: string): Promise<TaskSummary | null> {
  const tasksPath = path.join(changeDir, 'tasks.md');
  if (!(await fileExists(tasksPath))) {
    return null;
  }
  const content = await fs.readFile(tasksPath, 'utf-8');
  return parseTasks(content);
}

export function parseTasks(content: string): TaskSummary {
  const items: TaskItem[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const match = line.match(/^-\s+\[([ xX])\]\s+(.+)/);
    if (match) {
      const status = match[1].toLowerCase() === 'x' ? 'completed' : 'pending';
      const title = match[2].trim();
      const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      items.push({ id, title, status });
    }
  }

  const total = items.length;
  const completed = items.filter(i => i.status === 'completed').length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return { total, completed, percent, items };
}
