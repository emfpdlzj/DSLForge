import type { ProjectContext } from '../core/projectContext';
import { createEmptyProjectContext } from '../core/projectContext';

export function detectLangiumProject(workspaceRoot: string): ProjectContext {
  return createEmptyProjectContext(workspaceRoot);
}
