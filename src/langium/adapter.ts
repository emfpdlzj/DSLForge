import * as vscode from 'vscode';
import * as path from 'node:path';
import type {
  AdapterValidationPreferences,
  AdapterContextSelectionInput,
  AdapterDetectionInput,
  AdapterValidationPlanningInput,
  DslAdapter
} from '../core/adapter';
import { readWorkspacePackageInfo } from '../core/workspacePackage';
import { createProjectContext } from '../core/projectContext';
import { detectLangiumProject } from './projectDetection';
import { interpretLangiumValidationOutput } from './validationDiagnostics';
import type {
  GrammarContextFileSelection,
  GrammarContextSelection,
  ProjectDetectionResult
} from '../types';

async function collectGrammarFiles(workspaceRoot: string): Promise<string[]> {
  const pattern = new vscode.RelativePattern(workspaceRoot, '**/*.langium');
  const grammarUris = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 100);

  return grammarUris.map((uri) => uri.fsPath);
}

async function readTextFile(filePath: string): Promise<string> {
  const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
  return new TextDecoder('utf-8').decode(bytes);
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
    return true;
  } catch {
    return false;
  }
}

async function readLangiumConfigGrammarFiles(
  workspaceRoot: string
): Promise<string[]> {
  const configPath = path.join(workspaceRoot, 'langium-config.json');

  if (!(await pathExists(configPath))) {
    return [];
  }

  try {
    const rawConfig = await readTextFile(configPath);
    const parsed = JSON.parse(rawConfig) as {
      languages?: Array<{ grammar?: string }>;
    };

    return (parsed.languages ?? [])
      .map((language) => language.grammar)
      .filter((value): value is string => Boolean(value))
      .map((grammarPath) => path.normalize(path.resolve(workspaceRoot, grammarPath)));
  } catch {
    return [];
  }
}

function parseLangiumImports(content: string): string[] {
  const imports = new Set<string>();
  const importPattern = /^\s*import\s+['"](?<specifier>[^'"]+)['"]/gm;

  for (const match of content.matchAll(importPattern)) {
    const specifier = match.groups?.specifier;

    if (specifier) {
      imports.add(specifier);
    }
  }

  return [...imports];
}

async function resolveImportPath(
  fromGrammarFile: string,
  importSpecifier: string
): Promise<string | undefined> {
  const basePath = path.resolve(path.dirname(fromGrammarFile), importSpecifier);
  const candidates = basePath.endsWith('.langium')
    ? [basePath]
    : [basePath, `${basePath}.langium`];

  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return path.normalize(candidate);
    }
  }

  return undefined;
}

async function collectImportedGrammarFiles(
  activeGrammarFile: string | undefined
): Promise<string[]> {
  if (!activeGrammarFile) {
    return [];
  }

  const visited = new Set<string>([activeGrammarFile]);
  const queue = [activeGrammarFile];
  const importedFiles: string[] = [];

  while (queue.length > 0) {
    const currentFile = queue.shift();

    if (!currentFile) {
      continue;
    }

    let content = '';

    try {
      content = await readTextFile(currentFile);
    } catch {
      continue;
    }

    for (const importSpecifier of parseLangiumImports(content)) {
      const resolvedImport = await resolveImportPath(currentFile, importSpecifier);

      if (!resolvedImport || visited.has(resolvedImport)) {
        continue;
      }

      visited.add(resolvedImport);
      importedFiles.push(resolvedImport);
      queue.push(resolvedImport);
    }
  }

  return importedFiles;
}

function dedupeSelections(
  selections: GrammarContextFileSelection[]
): GrammarContextFileSelection[] {
  const seen = new Set<string>();
  const deduped: GrammarContextFileSelection[] = [];

  for (const selection of selections) {
    if (seen.has(selection.filePath)) {
      continue;
    }

    seen.add(selection.filePath);
    deduped.push(selection);
  }

  return deduped;
}

async function buildContextSelections(
  input: AdapterContextSelectionInput,
  activeGrammarFile: string | undefined
): Promise<GrammarContextFileSelection[]> {
  const workspaceRoot = input.project.context.workspaceRoot;
  const configuredGrammarFiles = await readLangiumConfigGrammarFiles(workspaceRoot);
  const importedGrammarFiles = await collectImportedGrammarFiles(activeGrammarFile);
  const siblingGrammarFiles = input.project.context.grammarFiles.filter(
    (grammarFile) =>
      grammarFile !== activeGrammarFile &&
      !importedGrammarFiles.includes(grammarFile)
  );
  const packageInfo = await readWorkspacePackageInfo(workspaceRoot);
  const contextSelections: GrammarContextFileSelection[] = [];

  if (activeGrammarFile) {
    contextSelections.push({
      filePath: activeGrammarFile,
      kind: 'active-grammar',
      languageId: 'langium',
      detail: 'Primary grammar selected for the command context'
    });
  }

  for (const grammarFile of importedGrammarFiles) {
    contextSelections.push({
      filePath: grammarFile,
      kind: 'imported-grammar',
      languageId: 'langium',
      detail: 'Imported by the active grammar'
    });
  }

  const langiumConfigPath = path.join(workspaceRoot, 'langium-config.json');

  if (await pathExists(langiumConfigPath)) {
    contextSelections.push({
      filePath: langiumConfigPath,
      kind: 'config',
      languageId: 'json',
      detail: 'Langium root configuration'
    });
  }

  if (packageInfo) {
    contextSelections.push({
      filePath: packageInfo.packageJsonPath,
      kind: 'package-json',
      languageId: 'json',
      detail: 'Workspace package metadata and scripts'
    });
  }

  for (const grammarFile of configuredGrammarFiles) {
    if (grammarFile === activeGrammarFile || importedGrammarFiles.includes(grammarFile)) {
      continue;
    }

    contextSelections.push({
      filePath: grammarFile,
      kind: 'sibling-grammar',
      languageId: 'langium',
      detail: 'Referenced by langium-config.json'
    });
  }

  for (const grammarFile of siblingGrammarFiles) {
    contextSelections.push({
      filePath: grammarFile,
      kind: 'sibling-grammar',
      languageId: 'langium',
      detail: 'Additional workspace grammar file'
    });
  }

  return dedupeSelections(contextSelections);
}

async function determineActiveGrammarFile(
  input: AdapterContextSelectionInput
): Promise<string | undefined> {
  if (input.project.context.activeFile?.endsWith('.langium')) {
    return input.project.context.activeFile;
  }

  const configuredGrammarFiles = await readLangiumConfigGrammarFiles(
    input.project.context.workspaceRoot
  );

  for (const grammarFile of configuredGrammarFiles) {
    if (input.project.context.grammarFiles.includes(grammarFile)) {
      return grammarFile;
    }
  }

  return input.project.context.grammarFiles[0];
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
  const activeGrammarFile = await determineActiveGrammarFile(input);
  const contextFiles = await buildContextSelections(input, activeGrammarFile);
  const relatedFiles = contextFiles
    .filter((file) => file.filePath !== activeGrammarFile)
    .map((file) => file.filePath);
  const importedFileCount = contextFiles.filter(
    (file) => file.kind === 'imported-grammar'
  ).length;
  const supplementalFileCount = contextFiles.filter(
    (file) => file.kind === 'config' || file.kind === 'package-json'
  ).length;

  return Promise.resolve({
    activeGrammarFile,
    relatedFiles,
    contextFiles,
    notes: [
      activeGrammarFile
        ? 'Langium adapter selected the active grammar from the current editor or langium-config.json.'
        : 'Langium adapter could not determine a primary grammar file.',
      importedFileCount > 0
        ? `Included ${importedFileCount} imported grammar file(s) by following Langium import statements.`
        : 'No imported grammar files were discovered from the active grammar.',
      supplementalFileCount > 0
        ? `Included ${supplementalFileCount} supplemental metadata file(s) for Langium configuration and workspace scripts.`
        : 'No supplemental Langium metadata files were added to the context.'
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
