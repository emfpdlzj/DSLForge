import * as vscode from 'vscode';
import { projectService } from '../core/services';

export const EXPLAIN_CURRENT_GRAMMAR_COMMAND = 'dslforge.explainCurrentGrammar';

export function explainCurrentGrammar(): vscode.Disposable {
  return vscode.commands.registerCommand(EXPLAIN_CURRENT_GRAMMAR_COMMAND, async () => {
    const projectContext = await projectService.resolveProjectContext();

    if (!projectContext) {
      await vscode.window.showWarningMessage(
        'DSLForge could not detect a supported DSL project in the current workspace.'
      );
      return;
    }

    await vscode.window.showInformationMessage(
      `Explain Current Grammar is not implemented yet. Resolved adapter: ${projectContext.adapter.displayName}.`
    );
  });
}
