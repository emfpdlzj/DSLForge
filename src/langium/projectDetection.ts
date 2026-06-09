export interface DetectLangiumProjectInput {
  workspaceRoot: string;
  activeFile?: string;
  grammarFiles: string[];
}

export interface DetectedLangiumProject {
  workspaceRoot: string;
  activeFile?: string;
  grammarFiles: string[];
}

export function detectLangiumProject(
  input: DetectLangiumProjectInput
): DetectedLangiumProject {
  return {
    workspaceRoot: input.workspaceRoot,
    activeFile: input.activeFile,
    grammarFiles: input.grammarFiles
  };
}
