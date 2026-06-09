import * as vscode from 'vscode';

export const VALIDATE_CURRENT_GRAMMAR_COMMAND = 'dslforge.validateCurrentGrammar';

export function validateCurrentGrammar(): vscode.Disposable {
  return vscode.commands.registerCommand(VALIDATE_CURRENT_GRAMMAR_COMMAND, async () => {
    await vscode.window.showInformationMessage('Validate Current Grammar is not implemented yet.');
  });
}
