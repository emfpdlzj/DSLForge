import * as vscode from 'vscode';
import {
  diagnosticsPresenter,
  projectService,
  validationOrchestrator
} from '../core/services';

export const VALIDATE_CURRENT_GRAMMAR_COMMAND = 'dslforge.validateCurrentGrammar';

export function validateCurrentGrammar(): vscode.Disposable {
  return vscode.commands.registerCommand(VALIDATE_CURRENT_GRAMMAR_COMMAND, async () => {
    const projectContext = await projectService.resolveProjectContext();

    if (!projectContext) {
      await vscode.window.showWarningMessage(
        'DSLForge could not detect a supported DSL project in the current workspace.'
      );
      return;
    }

    const result = await validationOrchestrator.runValidation(projectContext);
    await diagnosticsPresenter.presentValidationResult(projectContext, result);
  });
}
