import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

export interface WorkspacePackageManifest {
  packageManager?: string;
  scripts?: Record<string, string>;
}

export interface WorkspacePackageInfo {
  packageJsonPath: string;
  manifest: WorkspacePackageManifest;
  packageManager: PackageManager;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function normalizePackageManager(rawValue: string | undefined): PackageManager | undefined {
  if (!rawValue) {
    return undefined;
  }

  const normalized = rawValue.trim().toLowerCase();

  if (normalized.startsWith('pnpm@')) {
    return 'pnpm';
  }

  if (normalized.startsWith('yarn@')) {
    return 'yarn';
  }

  if (normalized.startsWith('bun@')) {
    return 'bun';
  }

  if (normalized.startsWith('npm@')) {
    return 'npm';
  }

  return undefined;
}

async function detectPackageManagerFromFiles(workspaceRoot: string): Promise<PackageManager> {
  const knownFiles: Array<{ fileName: string; packageManager: PackageManager }> = [
    { fileName: 'pnpm-lock.yaml', packageManager: 'pnpm' },
    { fileName: 'yarn.lock', packageManager: 'yarn' },
    { fileName: 'bun.lockb', packageManager: 'bun' },
    { fileName: 'bun.lock', packageManager: 'bun' },
    { fileName: 'package-lock.json', packageManager: 'npm' }
  ];

  for (const candidate of knownFiles) {
    if (await pathExists(path.join(workspaceRoot, candidate.fileName))) {
      return candidate.packageManager;
    }
  }

  return 'npm';
}

export async function readWorkspacePackageInfo(
  workspaceRoot: string
): Promise<WorkspacePackageInfo | undefined> {
  const packageJsonPath = path.join(workspaceRoot, 'package.json');

  if (!(await pathExists(packageJsonPath))) {
    return undefined;
  }

  const manifestContent = await fs.readFile(packageJsonPath, 'utf8');
  const manifest = JSON.parse(manifestContent) as WorkspacePackageManifest;
  const packageManager =
    normalizePackageManager(manifest.packageManager) ??
    (await detectPackageManagerFromFiles(workspaceRoot));

  return {
    packageJsonPath,
    manifest,
    packageManager
  };
}

export function buildPackageScriptCommand(
  packageManager: PackageManager,
  scriptName: string
): string {
  switch (packageManager) {
    case 'pnpm':
      return `pnpm run ${scriptName}`;
    case 'yarn':
      return `yarn run ${scriptName}`;
    case 'bun':
      return `bun run ${scriptName}`;
    case 'npm':
    default:
      return `npm run ${scriptName}`;
  }
}
