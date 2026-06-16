import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { readWorkspaceBuildToolInfo } from '../core/workspaceBuildTool';
import { readWorkspacePackageInfo } from '../core/workspacePackage';
import type { GrammarContextFileSelection, GrammarContextSelection } from '../types';

export interface Antlr4ContextSelectionInput {
  workspaceRoot: string;
  activeFile?: string;
  grammarFiles: string[];
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readTextFile(filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf8');
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

function parseAntlrReferences(content: string): string[] {
  const references = new Set<string>();
  const patterns = [
    /tokenVocab\s*=\s*(?<name>[A-Za-z_][A-Za-z0-9_]*)/g,
    /^\s*import\s+(?<names>[A-Za-z0-9_,\s]+);/gm
  ];

  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      if (match.groups?.name) {
        references.add(match.groups.name.trim());
      }

      if (match.groups?.names) {
        for (const name of match.groups.names.split(',')) {
          const trimmed = name.trim();

          if (trimmed) {
            references.add(trimmed);
          }
        }
      }
    }
  }

  return [...references];
}

async function collectImportedGrammarFiles(
  activeGrammarFile: string | undefined,
  grammarFiles: string[]
): Promise<string[]> {
  if (!activeGrammarFile) {
    return [];
  }

  const byBaseName = new Map<string, string>(
    grammarFiles.map((filePath) => [path.basename(filePath, '.g4'), filePath])
  );
  const visited = new Set<string>([activeGrammarFile]);
  const queue = [activeGrammarFile];
  const importedFiles: string[] = [];

  while (queue.length > 0) {
    const currentFile = queue.shift();

    if (!currentFile || !(await pathExists(currentFile))) {
      continue;
    }

    const content = await readTextFile(currentFile);

    for (const reference of parseAntlrReferences(content)) {
      const referencedFile = byBaseName.get(reference);

      if (!referencedFile || visited.has(referencedFile)) {
        continue;
      }

      visited.add(referencedFile);
      importedFiles.push(referencedFile);
      queue.push(referencedFile);
    }
  }

  return importedFiles;
}

function determineActiveGrammarFile(input: Antlr4ContextSelectionInput): string | undefined {
  if (input.activeFile?.endsWith('.g4')) {
    return path.normalize(input.activeFile);
  }

  return input.grammarFiles[0];
}

export async function buildAntlr4ContextSelection(
  input: Antlr4ContextSelectionInput
): Promise<GrammarContextSelection> {
  const grammarFiles = input.grammarFiles.map((filePath) => path.normalize(filePath));
  const activeGrammarFile = determineActiveGrammarFile({
    ...input,
    grammarFiles
  });
  const importedGrammarFiles = await collectImportedGrammarFiles(activeGrammarFile, grammarFiles);
  const siblingGrammarFiles = grammarFiles.filter(
    (grammarFile) =>
      grammarFile !== activeGrammarFile && !importedGrammarFiles.includes(grammarFile)
  );
  const contextSelections: GrammarContextFileSelection[] = [];
  const packageInfo = await readWorkspacePackageInfo(input.workspaceRoot);
  const buildToolInfo = await readWorkspaceBuildToolInfo(input.workspaceRoot);

  if (activeGrammarFile) {
    contextSelections.push({
      filePath: activeGrammarFile,
      kind: 'active-grammar',
      languageId: 'antlr',
      detail: 'Primary ANTLR4 grammar selected for the command context'
    });
  }

  for (const grammarFile of importedGrammarFiles) {
    contextSelections.push({
      filePath: grammarFile,
      kind: 'imported-grammar',
      languageId: 'antlr',
      detail: 'Referenced by tokenVocab or import declarations'
    });
  }

  for (const grammarFile of siblingGrammarFiles) {
    contextSelections.push({
      filePath: grammarFile,
      kind: 'sibling-grammar',
      languageId: 'antlr',
      detail: 'Additional workspace ANTLR4 grammar file'
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

  if (buildToolInfo?.gradle?.buildFilePath) {
    contextSelections.push({
      filePath: buildToolInfo.gradle.buildFilePath,
      kind: 'build-file',
      languageId: 'plaintext',
      detail: 'Gradle build file for grammar generation or validation'
    });
  }

  if (buildToolInfo?.maven?.pomXmlPath) {
    contextSelections.push({
      filePath: buildToolInfo.maven.pomXmlPath,
      kind: 'build-file',
      languageId: 'xml',
      detail: 'Maven build file for grammar generation or validation'
    });
  }

  const contextFiles = dedupeSelections(contextSelections);

  return {
    activeGrammarFile,
    relatedFiles: contextFiles
      .filter((file) => file.filePath !== activeGrammarFile)
      .map((file) => file.filePath),
    contextFiles,
    notes: [
      activeGrammarFile
        ? 'ANTLR4 adapter selected the active grammar from the current editor or first workspace grammar.'
        : 'ANTLR4 adapter could not determine a primary grammar file.',
      importedGrammarFiles.length > 0
        ? `Included ${importedGrammarFiles.length} referenced grammar file(s) from tokenVocab/import analysis.`
        : 'No referenced ANTLR4 grammar files were discovered from the active grammar.',
      buildToolInfo?.gradle?.buildFilePath || buildToolInfo?.maven?.pomXmlPath
        ? 'Included detected build files so validation and generation context matches the workspace toolchain.'
        : 'No build file was added to the ANTLR4 command context.',
      packageInfo
        ? 'Included package.json when the workspace exposes Node-based scripts around ANTLR4.'
        : 'No package.json was available for additional ANTLR4 script context.'
    ]
  };
}
