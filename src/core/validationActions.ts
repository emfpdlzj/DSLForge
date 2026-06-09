import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';

export const OPEN_VALIDATION_SETTINGS_COMMAND =
  'dslforge.openValidationSettings';
export const OPEN_WORKSPACE_PACKAGE_JSON_COMMAND =
  'dslforge.openWorkspacePackageJson';

export interface OpenWorkspacePackageJsonArgs {
  workspaceRoot: string;
}

export function registerValidationActionCommands(
  context: vscode.ExtensionContext
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(OPEN_VALIDATION_SETTINGS_COMMAND, async () => {
      await vscode.commands.executeCommand(
        'workbench.action.openSettings',
        'dslforge.validation.command'
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      OPEN_WORKSPACE_PACKAGE_JSON_COMMAND,
      async (args?: OpenWorkspacePackageJsonArgs) => {
        if (!args?.workspaceRoot) {
          return;
        }

        const packageJsonPath = path.join(args.workspaceRoot, 'package.json');

        if (!fs.existsSync(packageJsonPath)) {
          await vscode.window.showWarningMessage(
            'DSLForge could not find package.json in the workspace root.'
          );
          return;
        }

        const document = await vscode.workspace.openTextDocument(packageJsonPath);
        await vscode.window.showTextDocument(document, {
          preview: false
        });
      }
    )
  );
}
