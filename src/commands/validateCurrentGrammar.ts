import * as vscode from 'vscode';
import {
  diagnosticsPresenter,
  projectService,
  validationOrchestrator
} from '../core/services';
import { showUnsupportedWorkspaceGuidance } from '../core/userGuidance';
import { ensureTrustedWorkspace } from '../core/workspaceTrust';

export const VALIDATE_CURRENT_GRAMMAR_COMMAND = 'dslforge.validateCurrentGrammar';

export function validateCurrentGrammar(): vscode.Disposable {
  return vscode.commands.registerCommand(VALIDATE_CURRENT_GRAMMAR_COMMAND, async () => {
    if (!(await ensureTrustedWorkspace('Validate Current Grammar'))) {
      return;
    }

    const projectContext = await projectService.resolveProjectContext();

    if (!projectContext) {
      await showUnsupportedWorkspaceGuidance('Validate Current Grammar');
      return;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'DSLForge is validating the current grammar',
        cancellable: true
      },
      async (_progress, token) => {
        const result = await validationOrchestrator.runValidation(projectContext, token);
        await diagnosticsPresenter.presentValidationResult(projectContext, result);
      }
    );
  });
}
