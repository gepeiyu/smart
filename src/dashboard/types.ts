export interface SmartYaml {
  workflow?: 'full' | 'hotfix' | 'tweak';
  phase?: string;
  auto_transition?: boolean;
  build_mode?: string;
  build_pause?: string | null;
  isolation?: string;
  tdd_mode?: string | null;
  subagent_dispatch?: string | null;
  review_mode?: string;
  verify_mode?: string | null;
  verify_result?: string;
  verification_report?: string | null;
  branch_status?: string;
  design_doc?: string | null;
  plan?: string | null;
  handoff_context?: string | null;
  handoff_hash?: string | null;
  build_command?: string | null;
  verify_command?: string | null;
  direct_override?: boolean;
  archived?: boolean;
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
