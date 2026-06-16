import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export interface WorkspaceGradleInfo {
  buildFilePath?: string;
  wrapperScriptPath?: string;
  wrapperBatchPath?: string;
}

export interface WorkspaceMavenInfo {
  pomXmlPath?: string;
  wrapperScriptPath?: string;
  wrapperCommandPath?: string;
}

export interface WorkspaceBuildToolInfo {
  gradle?: WorkspaceGradleInfo;
  maven?: WorkspaceMavenInfo;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readGradleInfo(workspaceRoot: string): Promise<WorkspaceGradleInfo | undefined> {
  const buildFileCandidates = ['build.gradle', 'build.gradle.kts'];
  const wrapperScriptPath = path.join(workspaceRoot, 'gradlew');
  const wrapperBatchPath = path.join(workspaceRoot, 'gradlew.bat');
  const buildFilePath = (
    await Promise.all(
      buildFileCandidates.map(async (fileName) => {
        const fullPath = path.join(workspaceRoot, fileName);
        return (await pathExists(fullPath)) ? fullPath : undefined;
      })
    )
  ).find((candidate) => Boolean(candidate));

  const hasWrapperScript = await pathExists(wrapperScriptPath);
  const hasWrapperBatch = await pathExists(wrapperBatchPath);

  if (!buildFilePath && !hasWrapperScript && !hasWrapperBatch) {
    return undefined;
  }

  return {
    buildFilePath,
    wrapperScriptPath: hasWrapperScript ? wrapperScriptPath : undefined,
    wrapperBatchPath: hasWrapperBatch ? wrapperBatchPath : undefined
  };
}

async function readMavenInfo(workspaceRoot: string): Promise<WorkspaceMavenInfo | undefined> {
  const pomXmlPath = path.join(workspaceRoot, 'pom.xml');
  const wrapperScriptPath = path.join(workspaceRoot, 'mvnw');
  const wrapperCommandPath = path.join(workspaceRoot, 'mvnw.cmd');
  const hasPomXml = await pathExists(pomXmlPath);
  const hasWrapperScript = await pathExists(wrapperScriptPath);
  const hasWrapperCommand = await pathExists(wrapperCommandPath);

  if (!hasPomXml && !hasWrapperScript && !hasWrapperCommand) {
    return undefined;
  }

  return {
    pomXmlPath: hasPomXml ? pomXmlPath : undefined,
    wrapperScriptPath: hasWrapperScript ? wrapperScriptPath : undefined,
    wrapperCommandPath: hasWrapperCommand ? wrapperCommandPath : undefined
  };
}

export async function readWorkspaceBuildToolInfo(
  workspaceRoot: string
): Promise<WorkspaceBuildToolInfo | undefined> {
  const gradle = await readGradleInfo(workspaceRoot);
  const maven = await readMavenInfo(workspaceRoot);

  if (!gradle && !maven) {
    return undefined;
  }

  return {
    gradle,
    maven
  };
}

function toWorkspaceRelativeCommand(filePath: string): string {
  return path.basename(filePath).includes('.cmd') || path.basename(filePath).includes('.bat')
    ? path.basename(filePath)
    : `./${path.basename(filePath)}`;
}

export function buildGradleWrapperCommand(
  gradle: WorkspaceGradleInfo | undefined,
  taskName: string
): string | undefined {
  if (!gradle) {
    return undefined;
  }

  const wrapperPath =
    process.platform === 'win32'
      ? (gradle.wrapperBatchPath ?? gradle.wrapperScriptPath)
      : (gradle.wrapperScriptPath ?? gradle.wrapperBatchPath);

  if (!wrapperPath) {
    return undefined;
  }

  return `${toWorkspaceRelativeCommand(wrapperPath)} ${taskName}`;
}

export function buildMavenWrapperCommand(
  maven: WorkspaceMavenInfo | undefined,
  goalName: string
): string | undefined {
  if (!maven) {
    return undefined;
  }

  const wrapperPath =
    process.platform === 'win32'
      ? (maven.wrapperCommandPath ?? maven.wrapperScriptPath)
      : (maven.wrapperScriptPath ?? maven.wrapperCommandPath);

  if (!wrapperPath) {
    return undefined;
  }

  return `${toWorkspaceRelativeCommand(wrapperPath)} ${goalName}`;
}
