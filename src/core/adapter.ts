import type {
  GrammarContextSelection,
  ProjectDetectionResult,
  ValidationIssue,
  ValidationPlan
} from '../types';

export interface AdapterDetectionInput {
  workspaceRoot: string;
  activeFile?: string;
}

export interface AdapterContextSelectionInput {
  project: ProjectDetectionResult;
}

export interface AdapterValidationPlanningInput {
  project: ProjectDetectionResult;
  context: GrammarContextSelection;
}

export interface AdapterValidationPreferences {
  preferredScriptNames: string[];
  preferredGradleTaskNames?: string[];
  preferredMavenGoalNames?: string[];
  rationale: string[];
}

export interface AdapterValidationInterpretationInput {
  project: ProjectDetectionResult;
  context: GrammarContextSelection;
  rawOutput: string;
}

export interface DslAdapter {
  readonly id: string;
  readonly displayName: string;

  detect(input: AdapterDetectionInput): Promise<ProjectDetectionResult | undefined>;
  selectContext(input: AdapterContextSelectionInput): Promise<GrammarContextSelection>;
  getValidationPreferences(
    input: AdapterValidationPlanningInput
  ): Promise<AdapterValidationPreferences>;
  interpretValidationOutput?(
    input: AdapterValidationInterpretationInput
  ): Promise<ValidationIssue[]>;
}
