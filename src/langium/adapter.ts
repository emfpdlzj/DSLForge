import * as vscode from 'vscode';
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
import type {
  GrammarContextSelection,
  ProjectDetectionResult
} from '../types';

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

function selectContext(input: AdapterContextSelectionInput): Promise<GrammarContextSelection> {
  const activeGrammarFile =
    input.project.context.activeFile?.endsWith('.langium')
      ? input.project.context.activeFile
      : input.project.context.grammarFiles[0];

  const relatedFiles = input.project.context.grammarFiles.filter(
    (grammarFile) => grammarFile !== activeGrammarFile
  );

  return Promise.resolve({
    activeGrammarFile,
    relatedFiles,
    notes: [
      'Langium adapter selected grammar context from workspace .langium files.'
    ]
  });
}

function getValidationPreferences(
  input: AdapterValidationPlanningInput
): Promise<AdapterValidationPreferences> {
  return Promise.resolve({
    preferredScriptNames: ['validate', 'langium:validate', 'langium:check', 'build'],
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
