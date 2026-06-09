import * as vscode from 'vscode';

export const CREATE_DSL_SCAFFOLD_COMMAND = 'langforge.createDslScaffold';

export function createDslScaffold(): vscode.Disposable {
  return vscode.commands.registerCommand(CREATE_DSL_SCAFFOLD_COMMAND, async () => {
    await vscode.window.showInformationMessage('Create DSL Scaffold is not implemented yet.');
  });
}
