import * as vscode from 'vscode';

export const GENERATE_SAMPLE_DSL_COMMAND = 'dslforge.generateSampleDsl';

export function generateSampleDsl(): vscode.Disposable {
  return vscode.commands.registerCommand(GENERATE_SAMPLE_DSL_COMMAND, async () => {
    await vscode.window.showInformationMessage('Generate Sample DSL is not implemented yet.');
  });
}
