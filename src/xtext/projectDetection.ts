import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { ProjectSignal } from '../types';
import { readWorkspaceBuildToolInfo } from '../core/workspaceBuildTool';
import { readWorkspacePackageInfo } from '../core/workspacePackage';

const XTEXT_SCRIPT_HINTS = [
  'xtext:generate',
  'xtext:validate',
  'generateLanguage',
  'generateXtext'
];

const SKIPPED_DIRECTORIES = new Set(['.git', '.gradle', 'build', 'node_modules', 'target']);

export interface DetectXtextProjectInput {
  workspaceRoot: string;
  activeFile?: string;
  grammarFiles: string[];
}

export interface DetectedXtextProject {
  workspaceRoot: string;
  activeFile?: string;
  grammarFiles: string[];
  confidence: number;
  signals: ProjectSignal[];
}

async function collectFilesWithExtension(rootPath: string, extension: string): Promise<string[]> {
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

async function collectConfigSignals(workspaceRoot: string): Promise<ProjectSignal[]> {
  const workflowFiles = await collectFilesWithExtension(workspaceRoot, '.mwe2');

  return workflowFiles.map((workflowFile) => ({
    kind: 'config-file' as const,
    value: workflowFile,
    detail: 'Xtext workflow definition'
  }));
}

async function collectBuildSignals(workspaceRoot: string): Promise<ProjectSignal[]> {
  const buildInfo = await readWorkspaceBuildToolInfo(workspaceRoot);
  const signals: ProjectSignal[] = [];

  if (buildInfo?.gradle?.buildFilePath) {
    signals.push({
      kind: 'build-file',
      value: buildInfo.gradle.buildFilePath,
      detail: 'Gradle build file'
    });
    const content = await fs.readFile(buildInfo.gradle.buildFilePath, 'utf8').catch(() => '');

    if (content.includes('org.eclipse.xtext')) {
      signals.push({
        kind: 'dependency',
        value: 'org.eclipse.xtext',
        detail: `build-file:${path.basename(buildInfo.gradle.buildFilePath)}`
      });
    }
  }

  if (buildInfo?.gradle?.wrapperScriptPath || buildInfo?.gradle?.wrapperBatchPath) {
    signals.push({
      kind: 'wrapper',
      value: buildInfo.gradle.wrapperScriptPath ?? buildInfo.gradle.wrapperBatchPath ?? 'gradlew',
      detail: 'Gradle wrapper'
    });
  }

  if (buildInfo?.maven?.pomXmlPath) {
    signals.push({
      kind: 'build-file',
      value: buildInfo.maven.pomXmlPath,
      detail: 'Maven pom.xml'
    });
    const content = await fs.readFile(buildInfo.maven.pomXmlPath, 'utf8').catch(() => '');

    if (content.includes('org.eclipse.xtext')) {
      signals.push({
        kind: 'dependency',
        value: 'org.eclipse.xtext',
        detail: `build-file:${path.basename(buildInfo.maven.pomXmlPath)}`
      });
    }
  }

  if (buildInfo?.maven?.wrapperScriptPath || buildInfo?.maven?.wrapperCommandPath) {
    signals.push({
      kind: 'wrapper',
      value: buildInfo.maven.wrapperScriptPath ?? buildInfo.maven.wrapperCommandPath ?? 'mvnw',
      detail: 'Maven wrapper'
    });
  }

  return signals;
}

async function collectPackageSignals(workspaceRoot: string): Promise<ProjectSignal[]> {
  const packageInfo = await readWorkspacePackageInfo(workspaceRoot);

  if (!packageInfo) {
    return [];
  }

  const signals: ProjectSignal[] = [
    {
      kind: 'package-json',
      value: packageInfo.packageJsonPath
    }
  ];
  const dependencies = packageInfo.manifest.dependencies ?? {};
  const devDependencies = packageInfo.manifest.devDependencies ?? {};

  for (const [name, version] of Object.entries(dependencies)) {
    if (!name.toLowerCase().includes('xtext')) {
      continue;
    }

    signals.push({
      kind: 'dependency',
      value: name,
      detail: `dependency:${version}`
    });
  }

  for (const [name, version] of Object.entries(devDependencies)) {
    if (!name.toLowerCase().includes('xtext')) {
      continue;
    }

    signals.push({
      kind: 'dependency',
      value: name,
      detail: `devDependency:${version}`
    });
  }

  const scripts = packageInfo.manifest.scripts ?? {};

  for (const [scriptName, scriptCommand] of Object.entries(scripts)) {
    const loweredCommand = scriptCommand.toLowerCase();
    const isXtextScript =
      XTEXT_SCRIPT_HINTS.includes(scriptName) ||
      loweredCommand.includes('xtext') ||
      loweredCommand.includes('mwe2');

    if (!isXtextScript) {
      continue;
    }

    signals.push({
      kind: 'script',
      value: scriptName,
      detail: scriptCommand
    });
  }

  return signals;
}

function scoreSignals(signals: ProjectSignal[]): number {
  let confidence = 0;

  for (const signal of signals) {
    switch (signal.kind) {
      case 'active-file':
        confidence += signal.value.endsWith('.xtext') ? 70 : 0;
        break;
      case 'grammar-file':
        confidence += signal.value.endsWith('.xtext') ? 15 : 0;
        break;
      case 'config-file':
        confidence += 25;
        break;
      case 'build-file':
        confidence += 15;
        break;
      case 'wrapper':
        confidence += 10;
        break;
      case 'dependency':
        confidence += signal.detail?.startsWith('dependency:') ? 25 : 20;
        break;
      case 'script':
        confidence += signal.value.startsWith('xtext:') ? 20 : 10;
        break;
      case 'package-json':
        confidence += 5;
        break;
      case 'workspace-folder':
      default:
        break;
    }
  }

  return Math.min(confidence, 100);
}

export async function detectXtextProject(
  input: DetectXtextProjectInput
): Promise<DetectedXtextProject | undefined> {
  const signals: ProjectSignal[] = [
    {
      kind: 'workspace-folder',
      value: input.workspaceRoot
    }
  ];

  if (input.activeFile) {
    signals.push({
      kind: 'active-file',
      value: input.activeFile
    });
  }

  for (const grammarFile of input.grammarFiles) {
    signals.push({
      kind: 'grammar-file',
      value: grammarFile
    });
  }

  signals.push(...(await collectConfigSignals(input.workspaceRoot)));
  signals.push(...(await collectPackageSignals(input.workspaceRoot)));
  signals.push(...(await collectBuildSignals(input.workspaceRoot)));

  const confidence = scoreSignals(signals);

  if (confidence < 35) {
    return undefined;
  }

  return {
    workspaceRoot: input.workspaceRoot,
    activeFile: input.activeFile,
    grammarFiles: input.grammarFiles,
    confidence,
    signals
  };
}
