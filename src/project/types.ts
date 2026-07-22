import type { WorkflowRunRoute, WorkflowRunStatus } from '../workflows/run-state.js';

export type ProjectHealth = 'healthy' | 'attention' | 'blocked' | 'uninitialized';
export type ProjectLanguage = 'en' | 'zh';
export type DiagnosticStatus = 'pass' | 'warn' | 'fail' | 'skip';
export type DiagnosticArea = 'setup' | 'workflow' | 'platform' | 'integration' | 'run';

export interface DiagnosticFix {
  kind: 'create-project-layout' | 'install-integration';
  integrationId?: string;
}

export interface ProjectDiagnostic {
  id: string;
  area: DiagnosticArea;
  status: DiagnosticStatus;
  title: string;
  message: string;
  remediation?: string;
  fix?: DiagnosticFix;
}

export interface WorkflowSnapshot {
  configured: boolean;
  source: string | null;
  supportLevel: string | null;
  configuredDigest: string | null;
  resolvedDigest: string | null;
  valid: boolean;
  drifted: boolean;
  issues: string[];
}

export interface PlatformSnapshot {
  id: string;
  name: string;
  skillsScope: 'project' | 'global' | 'both' | 'missing';
}

export interface IntegrationSnapshot {
  id: string;
  displayName: string;
  source: 'official' | 'local';
  management: 'smart' | 'user';
  status: 'ready' | 'missing' | 'untrusted' | 'unsupported' | 'not-checked';
  dependencyAvailable: boolean;
  platforms: Record<string, boolean>;
  message: string;
}

export interface TaskItem {
  id: string;
  title: string;
  status: string;
}

export interface TaskSummary {
  total: number;
  completed: number;
  percent: number;
  items: TaskItem[];
}

export interface VerificationItem {
  check: string;
  passed: boolean;
  detail: string;
}

export interface VerificationSummary {
  result: string;
  reportPath: string | null;
  items: VerificationItem[];
}

export interface RunNextAction {
  command: string;
  label: string;
  reason: string;
}

export interface ProjectRunSnapshot {
  name: string;
  workflowSource: string | null;
  supportLevel: string | null;
  route: WorkflowRunRoute | null;
  status: WorkflowRunStatus | 'invalid';
  currentStage: string | null;
  readyStages: string[];
  completedStages: string[];
  stageCount: number | null;
  progressPercent: number | null;
  evidenceCount: number;
  failure: string | null;
  drifted: boolean;
  updatedAt: string | null;
  nextAction: RunNextAction | null;
  tasks: TaskSummary | null;
  verification: VerificationSummary | null;
  errors: string[];
}

export interface GitSnapshot {
  branch: string;
  head: string;
  headShort: string;
  dirty: boolean;
  dirtyFiles: string[];
  recentCommits: CommitInfo[];
}

export interface CommitInfo {
  hash: string;
  hashShort: string;
  message: string;
  author: string;
  date: string;
}

export interface ProjectSummary {
  active: number;
  blocked: number;
  completed: number;
  invalid: number;
  warnings: number;
  failures: number;
}

export interface ProjectSnapshot {
  version: 1;
  projectPath: string;
  generatedAt: string;
  language: ProjectLanguage;
  initialized: boolean;
  health: ProjectHealth;
  summary: ProjectSummary;
  workflow: WorkflowSnapshot;
  platforms: PlatformSnapshot[];
  integrations: IntegrationSnapshot[];
  runs: ProjectRunSnapshot[];
  diagnostics: ProjectDiagnostic[];
  git: GitSnapshot | null;
}
