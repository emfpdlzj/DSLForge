import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { readWorkspaceBuildToolInfo } from '../core/workspaceBuildTool';
import { readWorkspacePackageInfo } from '../core/workspacePackage';
import type { GrammarContextFileSelection, GrammarContextSelection } from '../types';

const SKIPPED_DIRECTORIES = new Set(['.git', '.gradle', 'build', 'node_modules', 'target']);

export interface XtextContextSelectionInput {
  workspaceRoot: string;
  activeFile?: string;
  grammarFiles: string[];
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

async function collectFilesWithExtension(
  rootPath: string,
  extension: string
): Promise<string[]> {
  const entries = await fs.readdir(rootPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (SKIPPED_DIRECTORIES.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(rootPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectFilesWithExtension(fullPath, extension)));
      continue;
    }

    if (entry.isFile() && fullPath.endsWith(extension)) {
      files.push(path.normalize(fullPath));
    }
  }

  return files.sort();
}

function determineActiveGrammarFile(
  input: XtextContextSelectionInput
): string | undefined {
  if (input.activeFile?.endsWith('.xtext')) {
    return path.normalize(input.activeFile);
  }

  return input.grammarFiles[0];
}

export async function buildXtextContextSelection(
  input: XtextContextSelectionInput
): Promise<GrammarContextSelection> {
  const grammarFiles = input.grammarFiles.map((filePath) => path.normalize(filePath));
  const activeGrammarFile = determineActiveGrammarFile({
    ...input,
    grammarFiles
  });
  const siblingGrammarFiles = grammarFiles.filter(
    (grammarFile) => grammarFile !== activeGrammarFile
  );
  const workflowFiles = await collectFilesWithExtension(input.workspaceRoot, '.mwe2');
  const packageInfo = await readWorkspacePackageInfo(input.workspaceRoot);
  const buildToolInfo = await readWorkspaceBuildToolInfo(input.workspaceRoot);
  const contextSelections: GrammarContextFileSelection[] = [];

  if (activeGrammarFile) {
    contextSelections.push({
      filePath: activeGrammarFile,
      kind: 'active-grammar',
      languageId: 'xtext',
      detail: 'Primary Xtext grammar selected for the command context'
    });
  }

  for (const grammarFile of siblingGrammarFiles) {
    contextSelections.push({
      filePath: grammarFile,
      kind: 'sibling-grammar',
      languageId: 'xtext',
      detail: 'Additional workspace Xtext grammar file'
    });
  }

  for (const workflowFile of workflowFiles) {
    contextSelections.push({
      filePath: workflowFile,
      kind: 'config',
      languageId: 'plaintext',
      detail: 'Xtext MWE2 workflow definition'
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
      detail: 'Gradle build file for Xtext generation or validation'
    });
  }

  if (buildToolInfo?.maven?.pomXmlPath) {
    contextSelections.push({
      filePath: buildToolInfo.maven.pomXmlPath,
      kind: 'build-file',
      languageId: 'xml',
      detail: 'Maven build file for Xtext generation or validation'
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
        ? 'Xtext adapter selected the active grammar from the current editor or first workspace grammar.'
        : 'Xtext adapter could not determine a primary grammar file.',
      workflowFiles.length > 0
        ? `Included ${workflowFiles.length} MWE2 workflow file(s) for generator and runtime context.`
        : 'No MWE2 workflow file was discovered in the workspace.',
      siblingGrammarFiles.length > 0
        ? `Included ${siblingGrammarFiles.length} sibling Xtext grammar file(s) from the workspace.`
        : 'No sibling Xtext grammar files were added to the context.',
      buildToolInfo?.gradle?.buildFilePath || buildToolInfo?.maven?.pomXmlPath
        ? 'Included detected build files so validation planning stays aligned with the workspace toolchain.'
        : 'No build file was added to the Xtext command context.'
    ]
  };
}
