import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { PackageManager } from './workspacePackage';
import { readWorkspacePackageInfo } from './workspacePackage';
import { readWorkspaceBuildToolInfo } from './workspaceBuildTool';

export type ScaffoldFrameworkHint = 'langium' | 'antlr4' | 'unspecified';

export interface ScaffoldContextFileSelection {
  filePath: string;
  label: string;
  languageId: string;
}

export interface ScaffoldWorkspaceProfile {
  workspaceRoot: string;
  activeFile?: string;
  frameworkHint: ScaffoldFrameworkHint;
  frameworkReason: string;
  packageManager?: PackageManager;
  buildTools: string[];
  contextFiles: ScaffoldContextFileSelection[];
  summaryLines: string[];
}

interface BuildScaffoldWorkspaceProfileInput {
  workspaceRoot: string;
  activeFile?: string;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function isInsideWorkspace(workspaceRoot: string, candidatePath: string): boolean {
  const relativePath = path.relative(workspaceRoot, candidatePath);
  return relativePath.length > 0 && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
}

function inferLanguageId(filePath: string): string {
  const baseName = path.basename(filePath).toLowerCase();
  const extension = path.extname(baseName);

  if (extension === '.langium') {
    return 'langium';
  }

  if (extension === '.g4') {
    return 'antlr';
  }

  if (extension === '.json') {
    return 'json';
  }

  if (extension === '.xml') {
    return 'xml';
  }

  if (extension === '.md' || baseName === 'readme') {
    return 'markdown';
  }

  if (baseName === 'build.gradle' || baseName === 'build.gradle.kts') {
    return 'groovy';
  }

  return 'plaintext';
}

function buildContextFileLabel(
  workspaceRoot: string,
  filePath: string,
  activeFile: string | undefined
): string {
  const relativePath = path.relative(workspaceRoot, filePath);

  switch (relativePath) {
    case 'package.json':
      return 'workspace package manifest';
    case 'langium-config.json':
      return 'Langium configuration';
    case 'README.md':
    case 'README':
      return 'workspace README';
    case 'tsconfig.json':
      return 'TypeScript configuration';
    case 'build.gradle':
    case 'build.gradle.kts':
      return 'Gradle build file';
    case 'pom.xml':
      return 'Maven build file';
    default:
      return filePath === activeFile ? 'active workspace file' : 'workspace file';
  }
}

function detectFrameworkHint(
  activeFile: string | undefined,
  dependencyNames: string[],
  hasLangiumConfig: boolean
): {
  frameworkHint: ScaffoldFrameworkHint;
  frameworkReason: string;
} {
  if (activeFile?.endsWith('.langium')) {
    return {
      frameworkHint: 'langium',
      frameworkReason: 'The active file is a .langium grammar.'
    };
  }

  if (activeFile?.endsWith('.g4')) {
    return {
      frameworkHint: 'antlr4',
      frameworkReason: 'The active file is an ANTLR4 .g4 grammar.'
    };
  }

  if (hasLangiumConfig) {
    return {
      frameworkHint: 'langium',
      frameworkReason: 'The workspace contains langium-config.json.'
    };
  }

  if (dependencyNames.some((dependency) => dependency === 'langium' || dependency.startsWith('langium/'))) {
    return {
      frameworkHint: 'langium',
      frameworkReason: 'The workspace dependencies reference Langium.'
    };
  }

  if (dependencyNames.some((dependency) => dependency.includes('antlr'))) {
    return {
      frameworkHint: 'antlr4',
      frameworkReason: 'The workspace dependencies reference ANTLR.'
    };
  }

  return {
    frameworkHint: 'unspecified',
    frameworkReason:
      'No strong DSL framework signal was detected, so the scaffold should default to a pragmatic Langium-first TypeScript layout.'
  };
}

export async function buildScaffoldWorkspaceProfile(
  input: BuildScaffoldWorkspaceProfileInput
): Promise<ScaffoldWorkspaceProfile> {
  const workspaceRoot = path.normalize(input.workspaceRoot);
  const activeFile =
    input.activeFile && isInsideWorkspace(workspaceRoot, input.activeFile)
      ? path.normalize(input.activeFile)
      : undefined;
  const [packageInfo, buildToolInfo] = await Promise.all([
    readWorkspacePackageInfo(workspaceRoot),
    readWorkspaceBuildToolInfo(workspaceRoot)
  ]);

  const candidateFiles = [
    activeFile,
    path.join(workspaceRoot, 'package.json'),
    path.join(workspaceRoot, 'langium-config.json'),
    path.join(workspaceRoot, 'README.md'),
    path.join(workspaceRoot, 'README'),
    path.join(workspaceRoot, 'tsconfig.json'),
    path.join(workspaceRoot, 'build.gradle'),
    path.join(workspaceRoot, 'build.gradle.kts'),
    path.join(workspaceRoot, 'pom.xml')
  ].filter((candidate): candidate is string => Boolean(candidate));

  const uniqueCandidates = [...new Set(candidateFiles.map((candidate) => path.normalize(candidate)))];
  const existingCandidates = (
    await Promise.all(
      uniqueCandidates.map(async (candidate) =>
        (await pathExists(candidate)) ? candidate : undefined
      )
    )
  ).filter((candidate): candidate is string => Boolean(candidate));

  const dependencyNames = [
    ...Object.keys(packageInfo?.manifest.dependencies ?? {}),
    ...Object.keys(packageInfo?.manifest.devDependencies ?? {})
  ].map((dependency) => dependency.toLowerCase());
  const hasLangiumConfig = existingCandidates.some(
    (candidate) => path.basename(candidate) === 'langium-config.json'
  );
  const framework = detectFrameworkHint(
    activeFile,
    dependencyNames,
    hasLangiumConfig
  );
  const buildTools = [
    buildToolInfo?.gradle ? 'Gradle' : undefined,
    buildToolInfo?.maven ? 'Maven' : undefined
  ].filter((tool): tool is string => Boolean(tool));
  const contextFiles = existingCandidates.map((filePath) => ({
    filePath,
    label: buildContextFileLabel(workspaceRoot, filePath, activeFile),
    languageId: inferLanguageId(filePath)
  }));

  return {
    workspaceRoot,
    activeFile,
    frameworkHint: framework.frameworkHint,
    frameworkReason: framework.frameworkReason,
    packageManager: packageInfo?.packageManager,
    buildTools,
    contextFiles,
    summaryLines: [
      `Workspace root: ${workspaceRoot}`,
      'Mode: bootstrap workspace scaffold',
      `Active file: ${activeFile ?? 'none'}`,
      `Framework hint: ${framework.frameworkHint}`,
      `Framework hint reason: ${framework.frameworkReason}`,
      `Detected package manager: ${packageInfo?.packageManager ?? 'none'}`,
      `Detected build tools: ${buildTools.length > 0 ? buildTools.join(', ') : 'none'}`,
      `Context files: ${contextFiles.length > 0 ? contextFiles.map((file) => file.filePath).join(', ') : 'none'}`
    ]
  };
}
