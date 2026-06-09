export interface GrammarExplanation {
  summary: string;
  keyRules: string[];
}

export interface ValidationIssue {
  message: string;
  severity: 'error' | 'warning' | 'info';
}
