import * as vscode from 'vscode';
import * as path from 'node:path';
import type {
  AdapterValidationPreferences,
  AdapterContextSelectionInput,
  AdapterDetectionInput,
  AdapterValidationPlanningInput,
  DslAdapter
} from '../core/adapter';
import { createProjectContext } from '../core/projectContext';
import { detectLangiumProject } from './projectDetection';
import { interpretLangiumValidationOutput } from './validationDiagnostics';
import type { GrammarContextSelection, ProjectDetectionResult } from '../types';
import { buildLangiumContextSelection } from './contextSelection';

async function collectGrammarFiles(workspaceRoot: string): Promise<string[]> {
  const pattern = new vscode.RelativePattern(workspaceRoot, '**/*.langium');
  const grammarUris = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 100);

  return grammarUris.map((uri) => uri.fsPath);
}

async function detect(input: AdapterDetectionInput): Promise<ProjectDetectionResult | undefined> {
  const grammarFiles = await collectGrammarFiles(input.workspaceRoot);
  const detection = await detectLangiumProject({
    workspaceRoot: input.workspaceRoot,
    activeFile: input.activeFile,
    grammarFiles
  });

  if (!detection) {
    return undefined;
  }

  return {
    adapterId: 'langium',
    framework: 'langium',
    displayName: 'Langium',
    confidence: detection.confidence,
    context: createProjectContext({
      adapterId: 'langium',
      framework: 'langium',
      workspaceRoot: input.workspaceRoot,
      activeFile: input.activeFile,
      grammarFiles: detection.grammarFiles,
      signals: detection.signals
    })
  };
}

async function selectContext(
  input: AdapterContextSelectionInput
): Promise<GrammarContextSelection> {
  return buildLangiumContextSelection({
    workspaceRoot: input.project.context.workspaceRoot,
    activeFile: input.project.context.activeFile,
    grammarFiles: input.project.context.grammarFiles
  });
}

function getValidationPreferences(
  input: AdapterValidationPlanningInput
): Promise<AdapterValidationPreferences> {
  return Promise.resolve({
    preferredScriptNames: ['validate', 'langium:validate', 'langium:check', 'build'],
    preferredGradleTaskNames: ['build', 'check'],
    preferredMavenGoalNames: ['package', 'test', 'validate', 'verify'],
    rationale: [
      `Adapter selected: ${input.project.displayName}`,
      `Workspace root: ${input.project.context.workspaceRoot}`,
      `Active grammar: ${input.context.activeGrammarFile ?? 'none'}`
    ]
  });
}

export const langiumAdapter: DslAdapter = {
  id: 'langium',
  displayName: 'Langium',
  detect,
  selectContext,
  getValidationPreferences,
  interpretValidationOutput: async (input) =>
    interpretLangiumValidationOutput(input)
};
