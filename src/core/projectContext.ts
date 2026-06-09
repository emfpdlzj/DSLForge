export interface ProjectContext {
  workspaceRoot: string;
  grammarFiles: string[];
}

export function createEmptyProjectContext(workspaceRoot: string): ProjectContext {
  return {
    workspaceRoot,
    grammarFiles: []
  };
}
