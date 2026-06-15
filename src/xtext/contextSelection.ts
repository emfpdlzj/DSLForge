import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { readWorkspaceBuildToolInfo } from '../core/workspaceBuildTool';
import { readWorkspacePackageInfo } from '../core/workspacePackage';
import type { GrammarContextFileSelection, GrammarContextSelection } from '../types';

const SKIPPED_DIRECTORIES = new Set(['.git', '.gradle', 'build', 'node_modules', 'target']);

interface XtextGrammarMetadata {
  filePath: string;
  grammarName?: string;
  mixedInGrammarNames: string[];
  importedNsUris: string[];
  generatedNsUris: string[];
}

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

function parseRepeatedMatches(content: string, pattern: RegExp): string[] {
  const matches = content.matchAll(pattern);
  const values = new Set<string>();

  for (const match of matches) {
    const value = match.groups?.value?.trim();

    if (value) {
      values.add(value);
    }
  }

  return [...values];
}

async function readGrammarMetadata(filePath: string): Promise<XtextGrammarMetadata> {
  const content = await fs.readFile(filePath, 'utf8').catch(() => '');
  const grammarNameMatch =
    /^\s*grammar\s+(?<value>[\w.]+)(?:\s+with\s+[\w.]+)?/im.exec(content);
  const mixinMatch =
    /^\s*grammar\s+[\w.]+\s+with\s+(?<value>[\w.]+)/im.exec(content);

  return {
    filePath,
    grammarName: grammarNameMatch?.groups?.value?.trim(),
    mixedInGrammarNames: mixinMatch?.groups?.value
      ? [mixinMatch.groups.value.trim()]
      : [],
    importedNsUris: parseRepeatedMatches(
      content,
      /^\s*import\s+"(?<value>[^"]+)"\s+as\s+\w+/gim
    ),
    generatedNsUris: parseRepeatedMatches(
      content,
      /^\s*generate\s+\w+\s+"(?<value>[^"]+)"/gim
    )
  };
}

function collectImportedGrammarFiles(
  activeGrammarMetadata: XtextGrammarMetadata | undefined,
  allMetadata: XtextGrammarMetadata[],
  activeGrammarFile: string | undefined
): string[] {
  if (!activeGrammarMetadata) {
    return [];
  }

  const importedFiles = new Set<string>();

  for (const metadata of allMetadata) {
    if (metadata.filePath === activeGrammarFile) {
      continue;
    }

    const matchesMixin =
      metadata.grammarName &&
      activeGrammarMetadata.mixedInGrammarNames.includes(metadata.grammarName);
    const matchesImportedNsUri = metadata.generatedNsUris.some((nsUri) =>
      activeGrammarMetadata.importedNsUris.includes(nsUri)
    );

    if (matchesMixin || matchesImportedNsUri) {
      importedFiles.add(metadata.filePath);
    }
  }

  return [...importedFiles].sort();
}

async function collectReferencedEPackageFiles(
  workspaceRoot: string,
  importedNsUris: string[]
): Promise<string[]> {
  if (importedNsUris.length === 0) {
    return [];
  }

  const ecoreFiles = await collectFilesWithExtension(workspaceRoot, '.ecore');
  const matchedFiles: string[] = [];

  for (const ecoreFile of ecoreFiles) {
    const content = await fs.readFile(ecoreFile, 'utf8').catch(() => '');

    if (importedNsUris.some((nsUri) => content.includes(nsUri))) {
      matchedFiles.push(ecoreFile);
    }
  }

  return matchedFiles.sort();
}

export async function buildXtextContextSelection(
  input: XtextContextSelectionInput
): Promise<GrammarContextSelection> {
  const grammarFiles = input.grammarFiles.map((filePath) => path.normalize(filePath));
  const activeGrammarFile = determineActiveGrammarFile({
    ...input,
    grammarFiles
  });
  const grammarMetadata = await Promise.all(
    grammarFiles.map((grammarFile) => readGrammarMetadata(grammarFile))
  );
  const activeGrammarMetadata = grammarMetadata.find(
    (metadata) => metadata.filePath === activeGrammarFile
  );
  const importedGrammarFiles = collectImportedGrammarFiles(
    activeGrammarMetadata,
    grammarMetadata,
    activeGrammarFile
  );
  const siblingGrammarFiles = grammarFiles.filter(
    (grammarFile) =>
      grammarFile !== activeGrammarFile && !importedGrammarFiles.includes(grammarFile)
  );
  const referencedEPackageFiles = await collectReferencedEPackageFiles(
    input.workspaceRoot,
    activeGrammarMetadata?.importedNsUris ?? []
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

  for (const grammarFile of importedGrammarFiles) {
    contextSelections.push({
      filePath: grammarFile,
      kind: 'imported-grammar',
      languageId: 'xtext',
      detail: 'Xtext grammar matched by a grammar mixin or imported namespace URI'
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

  for (const ecoreFile of referencedEPackageFiles) {
    contextSelections.push({
      filePath: ecoreFile,
      kind: 'config',
      languageId: 'xml',
      detail: 'Referenced EPackage model matched from imported Xtext namespace URIs'
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
      importedGrammarFiles.length > 0
        ? `Followed ${importedGrammarFiles.length} imported or mixed-in Xtext grammar file(s).`
        : 'No imported or mixed-in Xtext grammar files were added to the context.',
      referencedEPackageFiles.length > 0
        ? `Included ${referencedEPackageFiles.length} referenced EPackage file(s) matched from imported namespace URIs.`
        : 'No referenced EPackage file was matched from imported namespace URIs.',
      workflowFiles.length > 0
        ? `Included ${workflowFiles.length} MWE2 workflow file(s) for generator and runtime context.`
        : 'No MWE2 workflow file was discovered in the workspace.',
      siblingGrammarFiles.length > 0
        ? `Included ${siblingGrammarFiles.length} additional sibling Xtext grammar file(s).`
        : 'No extra sibling Xtext grammar files were added to the context.',
      buildToolInfo?.gradle?.buildFilePath || buildToolInfo?.maven?.pomXmlPath
        ? 'Included detected build files so validation planning stays aligned with the workspace toolchain.'
        : 'No build file was added to the Xtext command context.'
    ]
  };
}
