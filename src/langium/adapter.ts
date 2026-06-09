import * as vscode from 'vscode';
import type {
  AdapterContextSelectionInput,
  AdapterDetectionInput,
  AdapterValidationPlanningInput,
  DslAdapter
} from '../core/adapter';
import { createProjectContext } from '../core/projectContext';
import { detectLangiumProject } from './projectDetection';
import type {
  GrammarContextSelection,
  ProjectDetectionResult,
  ProjectSignal,
  ValidationPlan
} from '../types';

async function collectGrammarFiles(workspaceRoot: string): Promise<string[]> {
  const pattern = new vscode.RelativePattern(workspaceRoot, '**/*.langium');
  const grammarUris = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 100);

  return grammarUris.map((uri) => uri.fsPath);
}

function buildSignals(workspaceRoot: string, activeFile: string | undefined, grammarFiles: string[]): ProjectSignal[] {
  const signals: ProjectSignal[] = [
    {
      kind: 'workspace-folder',
      value: workspaceRoot
    }
  ];

  if (activeFile) {
    signals.push({
      kind: 'active-file',
      value: activeFile
    });
  }

  for (const grammarFile of grammarFiles) {
    signals.push({
      kind: 'grammar-file',
      value: grammarFile
    });
  }

  signals.push({
    kind: 'package-json',
    value: `${workspaceRoot}/package.json`
  });

  return signals;
}

async function detect(input: AdapterDetectionInput): Promise<ProjectDetectionResult | undefined> {
  const grammarFiles = await collectGrammarFiles(input.workspaceRoot);
  const isActiveLangiumFile = input.activeFile?.endsWith('.langium') ?? false;

  if (!isActiveLangiumFile && grammarFiles.length === 0) {
    return undefined;
  }

  const detection = detectLangiumProject({
    workspaceRoot: input.workspaceRoot,
    activeFile: input.activeFile,
    grammarFiles
  });

  return {
    adapterId: 'langium',
    framework: 'langium',
    displayName: 'Langium',
    confidence: isActiveLangiumFile ? 100 : 80,
    context: createProjectContext({
      adapterId: 'langium',
      framework: 'langium',
      workspaceRoot: input.workspaceRoot,
      activeFile: input.activeFile,
      grammarFiles: detection.grammarFiles,
      signals: buildSignals(input.workspaceRoot, input.activeFile, detection.grammarFiles)
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

function planValidation(input: AdapterValidationPlanningInput): Promise<ValidationPlan> {
  return Promise.resolve({
    command: {
      source: 'missing',
      detail:
        'Validation command resolution has not been implemented yet. Next step is user setting and package.json script discovery.'
    },
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
  planValidation
};
