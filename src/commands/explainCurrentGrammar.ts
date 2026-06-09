import * as vscode from 'vscode';

export const EXPLAIN_CURRENT_GRAMMAR_COMMAND = 'llmGrammer.explainCurrentGrammar';

export function explainCurrentGrammar(): vscode.Disposable {
  return vscode.commands.registerCommand(EXPLAIN_CURRENT_GRAMMAR_COMMAND, async () => {
    await vscode.window.showInformationMessage('Explain Current Grammar is not implemented yet.');
  });
}
