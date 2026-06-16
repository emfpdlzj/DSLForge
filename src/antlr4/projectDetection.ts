import * as fs from 'node:fs/promises';
import type { ProjectSignal } from '../types';
import { readWorkspaceBuildToolInfo } from '../core/workspaceBuildTool';
import { readWorkspacePackageInfo } from '../core/workspacePackage';

const ANTLR_SCRIPT_HINTS = [
  'antlr',
  'antlr4',
  'generateGrammarSource',
  'generateTestGrammarSource'
];

export interface DetectAntlr4ProjectInput {
  workspaceRoot: string;
  activeFile?: string;
  grammarFiles: string[];
}

export interface DetectedAntlr4Project {
  workspaceRoot: string;
  activeFile?: string;
  grammarFiles: string[];
  confidence: number;
  signals: ProjectSignal[];
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
    if (!name.toLowerCase().includes('antlr')) {
      continue;
    }

    signals.push({
      kind: 'dependency',
      value: name,
      detail: `dependency:${version}`
    });
  }

  for (const [name, version] of Object.entries(devDependencies)) {
    if (!name.toLowerCase().includes('antlr')) {
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
    const isAntlrScript =
      ANTLR_SCRIPT_HINTS.includes(scriptName) ||
      loweredCommand.includes('antlr') ||
      loweredCommand.includes('generategrammarsource');

    if (!isAntlrScript) {
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
        confidence += signal.value.endsWith('.g4') ? 70 : 0;
        break;
      case 'grammar-file':
        confidence += signal.value.endsWith('.g4') ? 15 : 0;
        break;
      case 'build-file':
        confidence += 20;
        break;
      case 'wrapper':
        confidence += 15;
        break;
      case 'dependency':
        confidence += signal.detail?.startsWith('dependency:') ? 25 : 20;
        break;
      case 'script':
        confidence += signal.value.includes('antlr') ? 20 : 10;
        break;
      case 'package-json':
        confidence += 5;
        break;
      case 'workspace-folder':
      case 'config-file':
      default:
        break;
    }
  }

  return Math.min(confidence, 100);
}

export async function detectAntlr4Project(
  input: DetectAntlr4ProjectInput
): Promise<DetectedAntlr4Project | undefined> {
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
