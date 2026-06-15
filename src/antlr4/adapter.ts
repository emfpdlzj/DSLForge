import * as vscode from 'vscode';
import type {
  AdapterValidationPreferences,
  AdapterContextSelectionInput,
  AdapterDetectionInput,
  AdapterValidationPlanningInput,
  DslAdapter
} from '../core/adapter';
import { createProjectContext } from '../core/projectContext';
import { buildAntlr4ContextSelection } from './contextSelection';
import { detectAntlr4Project } from './projectDetection';
import { interpretAntlr4ValidationOutput } from './validationDiagnostics';
import type { GrammarContextSelection, ProjectDetectionResult } from '../types';

async function collectGrammarFiles(workspaceRoot: string): Promise<string[]> {
  const pattern = new vscode.RelativePattern(workspaceRoot, '**/*.g4');
  const grammarUris = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 200);

  return grammarUris.map((uri) => uri.fsPath);
}

async function detect(input: AdapterDetectionInput): Promise<ProjectDetectionResult | undefined> {
  const grammarFiles = await collectGrammarFiles(input.workspaceRoot);
  const detection = await detectAntlr4Project({
    workspaceRoot: input.workspaceRoot,
    activeFile: input.activeFile,
    grammarFiles
  });

  if (!detection) {
    return undefined;
  }

  return {
    adapterId: 'antlr4',
    framework: 'antlr4',
    displayName: 'ANTLR4',
    confidence: detection.confidence,
    context: createProjectContext({
      adapterId: 'antlr4',
      framework: 'antlr4',
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
  return buildAntlr4ContextSelection({
    workspaceRoot: input.project.context.workspaceRoot,
    activeFile: input.project.context.activeFile,
    grammarFiles: input.project.context.grammarFiles
  });
}

function getValidationPreferences(
  input: AdapterValidationPlanningInput
): Promise<AdapterValidationPreferences> {
  return Promise.resolve({
    preferredScriptNames: ['validate', 'antlr:validate', 'antlr4:validate', 'build'],
    preferredGradleTaskNames: [
      'generateGrammarSource',
      'generateTestGrammarSource',
      'build',
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

export const antlr4Adapter: DslAdapter = {
  id: 'antlr4',
  displayName: 'ANTLR4',
  detect,
  selectContext,
  getValidationPreferences,
  interpretValidationOutput: async (input) =>
    interpretAntlr4ValidationOutput(input)
};
