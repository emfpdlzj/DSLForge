import * as vscode from 'vscode';
import type { DslAdapter } from './adapter';
import { AdapterRegistry } from './adapterRegistry';
import { appendOutputLine } from './outputChannel';
import type { GrammarContextSelection, ProjectDetectionResult } from '../types';

export interface ResolvedProject {
  workspaceFolder: vscode.WorkspaceFolder;
  adapter: DslAdapter;
  detection: ProjectDetectionResult;
}

export interface WorkspaceSelection {
  workspaceFolder: vscode.WorkspaceFolder;
  activeFile?: string;
}

export interface ResolvedProjectContext extends ResolvedProject {
  context: GrammarContextSelection;
}

export class ProjectService {
  public constructor(private readonly adapterRegistry: AdapterRegistry) {}

  public resolveWorkspaceSelection(): WorkspaceSelection | undefined {
    const activeEditor = vscode.window.activeTextEditor;
    const activeUri = activeEditor?.document.uri;
    const workspaceFolder = activeUri
      ? vscode.workspace.getWorkspaceFolder(activeUri)
      : vscode.workspace.workspaceFolders?.[0];

    if (!workspaceFolder) {
      return undefined;
    }

    const activeFile =
      activeUri && activeUri.scheme === 'file' ? activeUri.fsPath : undefined;

    return {
      workspaceFolder,
      activeFile
    };
  }

  public async resolveProject(): Promise<ResolvedProject | undefined> {
    const workspaceSelection = this.resolveWorkspaceSelection();

    if (!workspaceSelection) {
      return undefined;
    }

    const { workspaceFolder, activeFile } = workspaceSelection;

    const detections = await Promise.all(
      this.adapterRegistry.all().map(async (adapter) => {
        const detection = await adapter.detect({
          workspaceRoot: workspaceFolder.uri.fsPath,
          activeFile
        });

        return detection ? { adapter, detection } : undefined;
      })
    );

    const rankedDetections = detections
      .filter((entry): entry is { adapter: DslAdapter; detection: ProjectDetectionResult } => Boolean(entry))
      .sort((left, right) => right.detection.confidence - left.detection.confidence);

    const resolved = rankedDetections[0];

    if (!resolved) {
      appendOutputLine(
        `No adapter matched workspace: ${workspaceFolder.uri.fsPath}`
      );
      return undefined;
    }

    return {
      workspaceFolder,
      adapter: resolved.adapter,
      detection: resolved.detection
    };
  }

  public async resolveProjectContext(): Promise<ResolvedProjectContext | undefined> {
    const resolvedProject = await this.resolveProject();

    if (!resolvedProject) {
      return undefined;
    }

    const context = await resolvedProject.adapter.selectContext({
      project: resolvedProject.detection
    });

    return {
      ...resolvedProject,
      context
    };
  }
}
