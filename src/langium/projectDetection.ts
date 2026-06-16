import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { ProjectSignal } from '../types';
import { readWorkspacePackageInfo } from '../core/workspacePackage';

const LANGIUM_CONFIG_FILE_NAMES = ['langium-config.json'];
const LANGIUM_SCRIPT_HINTS = [
  'langium:generate',
  'langium:watch',
  'langium:build',
  'langium:validate',
  'langium:check'
];

export interface DetectLangiumProjectInput {
  workspaceRoot: string;
  activeFile?: string;
  grammarFiles: string[];
}

export interface DetectedLangiumProject {
  workspaceRoot: string;
  activeFile?: string;
  grammarFiles: string[];
  confidence: number;
  signals: ProjectSignal[];
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function collectConfigSignals(workspaceRoot: string): Promise<ProjectSignal[]> {
  const signals: ProjectSignal[] = [];

  for (const fileName of LANGIUM_CONFIG_FILE_NAMES) {
    const configPath = path.join(workspaceRoot, fileName);

    if (await pathExists(configPath)) {
      signals.push({
        kind: 'config-file',
        value: configPath,
        detail: 'Langium root configuration'
      });
    }
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

  if (dependencies.langium) {
    signals.push({
      kind: 'dependency',
      value: 'langium',
      detail: `dependency:${dependencies.langium}`
    });
  }

  if (devDependencies.langium) {
    signals.push({
      kind: 'dependency',
      value: 'langium',
      detail: `devDependency:${devDependencies.langium}`
    });
  }

  const scripts = packageInfo.manifest.scripts ?? {};

  for (const [scriptName, scriptCommand] of Object.entries(scripts)) {
    const isLangiumScript =
      LANGIUM_SCRIPT_HINTS.includes(scriptName) || scriptCommand.toLowerCase().includes('langium');

    if (!isLangiumScript) {
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
        confidence += signal.value.endsWith('.langium') ? 70 : 0;
        break;
      case 'grammar-file':
        confidence += 15;
        break;
      case 'config-file':
        confidence += 35;
        break;
      case 'dependency':
        confidence += signal.detail?.startsWith('dependency:') ? 30 : 25;
        break;
      case 'script':
        confidence += signal.value.startsWith('langium:') ? 20 : 10;
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

export async function detectLangiumProject(
  input: DetectLangiumProjectInput
): Promise<DetectedLangiumProject | undefined> {
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
