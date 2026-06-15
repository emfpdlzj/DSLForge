import * as vscode from 'vscode';
import type {
  AdapterValidationPreferences,
  AdapterContextSelectionInput,
  AdapterDetectionInput,
  AdapterValidationPlanningInput,
  DslAdapter
} from '../core/adapter';
import { createProjectContext } from '../core/projectContext';
import { buildXtextContextSelection } from './contextSelection';
import { detectXtextProject } from './projectDetection';
import { interpretXtextValidationOutput } from './validationDiagnostics';
import type { GrammarContextSelection, ProjectDetectionResult } from '../types';

async function collectGrammarFiles(workspaceRoot: string): Promise<string[]> {
  const pattern = new vscode.RelativePattern(workspaceRoot, '**/*.xtext');
  const grammarUris = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 200);

  return grammarUris.map((uri) => uri.fsPath);
}

async function detect(input: AdapterDetectionInput): Promise<ProjectDetectionResult | undefined> {
  const grammarFiles = await collectGrammarFiles(input.workspaceRoot);
  const detection = await detectXtextProject({
    workspaceRoot: input.workspaceRoot,
    activeFile: input.activeFile,
    grammarFiles
  });

  if (!detection) {
    return undefined;
  }

  return {
    adapterId: 'xtext',
    framework: 'xtext',
    displayName: 'Xtext',
    confidence: detection.confidence,
    context: createProjectContext({
      adapterId: 'xtext',
      framework: 'xtext',
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
  return buildXtextContextSelection({
    workspaceRoot: input.project.context.workspaceRoot,
    activeFile: input.project.context.activeFile,
    grammarFiles: input.project.context.grammarFiles
  });
}

function getValidationPreferences(
  input: AdapterValidationPlanningInput
): Promise<AdapterValidationPreferences> {
  return Promise.resolve({
    preferredScriptNames: [
      'xtext:validate',
      'xtext:generate',
      'generateLanguage',
      'generateXtext',
      'build'
    ],
    preferredGradleTaskNames: [
      'generateXtext',
      'generateLanguage',
      'build',
      'check',
      'test'
    ],
    preferredMavenGoalNames: ['generate-sources', 'package', 'test', 'verify'],
    rationale: [
      `Adapter selected: ${input.project.displayName}`,
      `Workspace root: ${input.project.context.workspaceRoot}`,
      `Active grammar: ${input.context.activeGrammarFile ?? 'none'}`
    ]
  });
}

export const xtextAdapter: DslAdapter = {
  id: 'xtext',
  displayName: 'Xtext',
  detect,
  selectContext,
  getValidationPreferences,
  interpretValidationOutput: async (input) =>
    interpretXtextValidationOutput(input)
};
