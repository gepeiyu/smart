export interface SmartYaml {
  workflow_source?: string;
  workflow_digest?: string;
  support_level?: string;
  route?: 'standard' | 'bugfix' | 'quick';
  status?: 'active' | 'blocked' | 'completed';
  current_stage?: string | null;
  ready_stages?: string[];
  completed_stages?: string[];
  failure?: string | null;
}

export interface ChangeInfo {
  name: string;
  phase: string;
  workflow: string;
  autoTransition: boolean;
  verifyResult: string;
  branchStatus: string;
  archived: boolean;
  designDoc: string | null;
  plan: string | null;
  tasks: TaskSummary | null;
  verification: VerificationSummary | null;
  nextAction: string | null;
  risks: string[];
}

export interface TaskSummary {
  total: number;
  completed: number;
  percent: number;
  items: TaskItem[];
}

export interface TaskItem {
  id: string;
  title: string;
  status: string;
}

export interface VerificationSummary {
  result: string;
  reportPath: string | null;
  items: VerificationItem[];
}

export interface VerificationItem {
  check: string;
  passed: boolean;
  detail: string;
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

export interface NextAction {
  change: string;
  command: string;
  label: string;
  reason: string;
}

export interface Risk {
  change: string | null;
  level: 'low' | 'medium' | 'high';
  message: string;
}

export interface DashboardSnapshot {
  changes: ChangeInfo[];
  archived: ChangeInfo[];
  projectPath: string;
  git?: GitSnapshot;
  nextActions: NextAction[];
  risks: Risk[];
  generatedAt: string;
}
