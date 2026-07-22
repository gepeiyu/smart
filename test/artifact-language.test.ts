import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..');

const skillCases = [
  {
    file: 'assets/skills/smart-build/SKILL.md',
    artifacts: ['required_output', 'smart run evidence'],
  },
  {
    file: 'assets/skills-zh/smart-build/SKILL.md',
    artifacts: ['required_output', 'smart run evidence'],
  },
  {
    file: 'assets/skills/smart-verify/SKILL.md',
    artifacts: ['required_output', 'smart run evidence'],
  },
  {
    file: 'assets/skills-zh/smart-verify/SKILL.md',
    artifacts: ['required_output', 'smart run evidence'],
  },
];

describe('workflow artifact language contract', () => {
  it.each(skillCases)(
    '$file defines complete artifact language resolution',
    ({ file, artifacts }) => {
      const content = readFileSync(path.join(root, file), 'utf-8');

      expect(content).toContain('.smart/config.yaml');
      expect(content).toContain('smart_language');
      expect(content).toMatch(/smart_language:\s*zh/);
      expect(content).toMatch(/smart_language:\s*en/);
      expect(content).toMatch(/user request|用户请求/);
      expect(content).toMatch(/dominant.*language|主导语言/);
      expect(content).toMatch(/file names?.*unchanged|文件名.*不变/);

      for (const artifact of artifacts) expect(content).toContain(artifact);
    },
  );
});
