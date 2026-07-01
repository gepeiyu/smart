import type { InstallScope } from './types.js';

export interface Platform {
  id: string;
  name: string;
  skillsDir: string;
  globalSkillsDir?: string;
  detectionPaths?: string[];
  openspecToolId: string;
  rulesDir?: string;
  rulesBaseDir?: string;
  rulesFormat?: 'md' | 'mdc' | 'copilot';
  supportsHooks?: boolean;
  hookFormat?: 'claude-code' | 'gemini' | 'windsurf' | 'copilot' | 'qwen' | 'kiro' | 'qoder';
}

export function getPlatformSkillsDir(platform: Platform, scope: InstallScope): string {
  if (scope === 'global' && platform.globalSkillsDir) {
    return platform.globalSkillsDir;
  }
  return platform.skillsDir;
}

export function getPlatformSkillsDirs(platform: Platform, scope: InstallScope): string[] {
  return [getPlatformSkillsDir(platform, scope)];
}

export const PLATFORMS: Platform[] = [
  {
    id: 'claude',
    name: 'Claude Code',
    skillsDir: '.claude',
    globalSkillsDir: '.claude',
    openspecToolId: 'claude',
    rulesDir: 'rules',
    rulesFormat: 'md',
    supportsHooks: true,
    hookFormat: 'claude-code',
  },
  {
    id: 'cursor',
    name: 'Cursor',
    skillsDir: '.cursor',
    globalSkillsDir: '.cursor',
    openspecToolId: 'cursor',
    rulesDir: 'rules',
    rulesFormat: 'mdc',
  },
  {
    id: 'codex',
    name: 'Codex',
    skillsDir: '.codex',
    globalSkillsDir: '.codex',
    openspecToolId: 'codex',
    rulesDir: 'rules',
    rulesFormat: 'md',
    supportsHooks: true,
    hookFormat: 'claude-code',
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    skillsDir: '.opencode',
    globalSkillsDir: '.config/opencode',
    openspecToolId: 'opencode',
    rulesDir: 'rules',
    rulesFormat: 'md',
  },
  {
    id: 'windsurf',
    name: 'Windsurf',
    skillsDir: '.windsurf',
    globalSkillsDir: '.windsurf',
    openspecToolId: 'windsurf',
    rulesDir: 'rules',
    rulesFormat: 'md',
    supportsHooks: true,
    hookFormat: 'windsurf',
  },
  {
    id: 'cline',
    name: 'Cline',
    skillsDir: '.cline',
    globalSkillsDir: '.cline',
    openspecToolId: 'cline',
    rulesBaseDir: '',
    rulesDir: '.clinerules',
    rulesFormat: 'md',
  },
  {
    id: 'roocode',
    name: 'RooCode',
    skillsDir: '.roo',
    globalSkillsDir: '.roo',
    openspecToolId: 'roocode',
    rulesDir: 'rules',
    rulesFormat: 'md',
  },
  {
    id: 'continue',
    name: 'Continue',
    skillsDir: '.continue',
    globalSkillsDir: '.continue',
    openspecToolId: 'continue',
    rulesDir: 'rules',
    rulesFormat: 'md',
  },
  {
    id: 'github-copilot',
    name: 'GitHub Copilot',
    skillsDir: '.github',
    globalSkillsDir: '.github',
    detectionPaths: [
      '.github/copilot-instructions.md',
      '.github/instructions',
      '.github/prompts',
      '.github/skills',
    ],
    openspecToolId: 'github-copilot',
    rulesDir: 'instructions',
    rulesFormat: 'copilot',
    supportsHooks: true,
    hookFormat: 'copilot',
  },
  {
    id: 'gemini',
    name: 'Gemini CLI',
    skillsDir: '.gemini',
    globalSkillsDir: '.gemini',
    openspecToolId: 'gemini',
    supportsHooks: true,
    hookFormat: 'gemini',
  },
  {
    id: 'amazon-q',
    name: 'Amazon Q Developer',
    skillsDir: '.amazonq',
    globalSkillsDir: '.amazonq',
    openspecToolId: 'amazon-q',
    rulesDir: 'rules',
    rulesFormat: 'md',
    supportsHooks: true,
    hookFormat: 'claude-code',
  },
  {
    id: 'qwen',
    name: 'Qwen Code',
    skillsDir: '.qwen',
    globalSkillsDir: '.qwen',
    openspecToolId: 'qwen',
    rulesDir: 'rules',
    rulesFormat: 'md',
    supportsHooks: true,
    hookFormat: 'qwen',
  },
  {
    id: 'kilocode',
    name: 'Kilo Code',
    skillsDir: '.kilocode',
    globalSkillsDir: '.kilocode',
    openspecToolId: 'kilocode',
    rulesDir: 'rules',
    rulesFormat: 'md',
  },
  {
    id: 'auggie',
    name: 'Auggie (Augment CLI)',
    skillsDir: '.augment',
    globalSkillsDir: '.augment',
    openspecToolId: 'auggie',
    rulesDir: 'rules',
    rulesFormat: 'md',
  },
  {
    id: 'kiro',
    name: 'Kiro',
    skillsDir: '.kiro',
    globalSkillsDir: '.kiro',
    openspecToolId: 'kiro',
    rulesDir: 'steering',
    rulesFormat: 'md',
    supportsHooks: true,
    hookFormat: 'kiro',
  },
  {
    id: 'kimicode',
    name: 'Kimi Code',
    skillsDir: '.kimi-code',
    globalSkillsDir: '.kimi-code',
    openspecToolId: 'kimi',
  },
  {
    id: 'lingma',
    name: 'Lingma',
    skillsDir: '.lingma',
    globalSkillsDir: '.lingma',
    openspecToolId: 'lingma',
    rulesDir: 'rules',
    rulesFormat: 'md',
  },
  { id: 'junie', name: 'Junie', skillsDir: '.junie', openspecToolId: 'junie' },
  { id: 'codebuddy', name: 'CodeBuddy Code', skillsDir: '.codebuddy', openspecToolId: 'codebuddy' },
  { id: 'costrict', name: 'CoStrict', skillsDir: '.cospec', openspecToolId: 'costrict' },
  { id: 'crush', name: 'Crush', skillsDir: '.crush', openspecToolId: 'crush' },
  { id: 'factory', name: 'Factory Droid', skillsDir: '.factory', openspecToolId: 'factory' },
  { id: 'iflow', name: 'iFlow', skillsDir: '.iflow', openspecToolId: 'iflow' },
  {
    id: 'pi',
    name: 'Pi',
    skillsDir: '.pi',
    globalSkillsDir: '.pi/agent',
    openspecToolId: 'pi',
  },
  {
    id: 'qoder',
    name: 'Qoder',
    skillsDir: '.qoder',
    globalSkillsDir: '.qoder',
    openspecToolId: 'qoder',
    rulesDir: 'rules',
    rulesFormat: 'md',
    supportsHooks: true,
    hookFormat: 'qoder',
  },
  {
    id: 'antigravity',
    name: 'Antigravity',
    skillsDir: '.agents',
    globalSkillsDir: '.gemini/antigravity',
    openspecToolId: 'antigravity',
  },
  { id: 'bob', name: 'Bob Shell', skillsDir: '.bob', openspecToolId: 'bob' },
  { id: 'forgecode', name: 'ForgeCode', skillsDir: '.forge', openspecToolId: 'forgecode' },
  {
    id: 'trae',
    name: 'Trae',
    skillsDir: '.trae',
    globalSkillsDir: '.trae',
    openspecToolId: 'trae',
    rulesDir: 'rules',
    rulesFormat: 'md',
  },
];
