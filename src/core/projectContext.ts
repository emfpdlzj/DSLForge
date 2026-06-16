import type { FrameworkId, ProjectContext, ProjectSignal } from '../types';

export interface ProjectContextOptions {
  adapterId: string;
  framework: FrameworkId;
  workspaceRoot: string;
  activeFile?: string;
  grammarFiles?: string[];
  signals?: ProjectSignal[];
}

export function createProjectContext(options: ProjectContextOptions): ProjectContext {
  return {
    adapterId: options.adapterId,
    framework: options.framework,
    workspaceRoot: options.workspaceRoot,
    activeFile: options.activeFile,
    grammarFiles: options.grammarFiles ?? [],
    signals: options.signals ?? []
  };
}
