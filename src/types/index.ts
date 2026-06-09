export type FrameworkId = 'langium';

export type ValidationCommandSource = 'user-configured' | 'package-script' | 'missing';

export interface ProjectSignal {
  kind: 'workspace-folder' | 'active-file' | 'grammar-file' | 'package-json';
  value: string;
  detail?: string;
}

export interface ProjectContext {
  adapterId: string;
  framework: FrameworkId;
  workspaceRoot: string;
  activeFile?: string;
  grammarFiles: string[];
  signals: ProjectSignal[];
}

export interface ProjectDetectionResult {
  adapterId: string;
  framework: FrameworkId;
  displayName: string;
  confidence: number;
  context: ProjectContext;
}

export interface GrammarContextSelection {
  activeGrammarFile?: string;
  relatedFiles: string[];
  notes: string[];
}

export interface ValidationCommandSuggestion {
  source: ValidationCommandSource;
  commandLine?: string;
  scriptName?: string;
  detail: string;
}

export interface GrammarExplanation {
  summary: string;
  keyRules: string[];
}

export interface ValidationIssue {
  message: string;
  severity: 'error' | 'warning' | 'info';
  filePath?: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  code?: string;
}

export interface ValidationPlan {
  command: ValidationCommandSuggestion;
  rationale: string[];
}

export interface ValidationRunResult {
  status: 'succeeded' | 'failed' | 'needs_configuration';
  summary: string;
  plan: ValidationPlan;
  issues: ValidationIssue[];
  rawOutput?: string;
  exitCode?: number | null;
  durationMs?: number;
}
