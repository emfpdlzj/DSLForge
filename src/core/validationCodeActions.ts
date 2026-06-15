import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import {
  OPEN_VALIDATION_SETTINGS_COMMAND,
  OPEN_WORKSPACE_PACKAGE_JSON_COMMAND
} from './validationActions';

const VALIDATION_MISSING_CODE = 'dslforge.validation.missing';

function hasMissingValidationDiagnostic(
  context: vscode.CodeActionContext
): boolean {
  return context.diagnostics.some((diagnostic) => {
    if (typeof diagnostic.code === 'string') {
      return diagnostic.code === VALIDATION_MISSING_CODE;
    }

    if (
      diagnostic.code &&
      typeof diagnostic.code === 'object' &&
      'value' in diagnostic.code
    ) {
      return diagnostic.code.value === VALIDATION_MISSING_CODE;
    }

    return false;
  });
}

function createOpenSettingsAction(): vscode.CodeAction {
  const action = new vscode.CodeAction(
    'Open Validation Settings',
    vscode.CodeActionKind.QuickFix
  );
  action.command = {
    command: OPEN_VALIDATION_SETTINGS_COMMAND,
    title: 'Open Validation Settings'
  };
  return action;
}

function createOpenPackageJsonAction(
  workspaceRoot: string
): vscode.CodeAction | undefined {
  const packageJsonPath = path.join(workspaceRoot, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    return undefined;
  }

  const action = new vscode.CodeAction(
    'Open Workspace package.json',
    vscode.CodeActionKind.QuickFix
  );
  action.command = {
    command: OPEN_WORKSPACE_PACKAGE_JSON_COMMAND,
    title: 'Open Workspace package.json',
    arguments: [{ workspaceRoot }]
  };
  return action;
}

class ValidationCodeActionProvider implements vscode.CodeActionProvider {
  public provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext
  ): vscode.CodeAction[] {
    if (!hasMissingValidationDiagnostic(context)) {
      return [];
    }

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);

    if (!workspaceFolder) {
      return [createOpenSettingsAction()];
    }

    const actions = [createOpenSettingsAction()];
    const openPackageJsonAction = createOpenPackageJsonAction(
      workspaceFolder.uri.fsPath
    );

    if (openPackageJsonAction) {
      actions.push(openPackageJsonAction);
    }

    return actions;
  }
}

export function registerValidationCodeActions(
  context: vscode.ExtensionContext
): void {
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      {
        scheme: 'file',
        pattern: '**/*.langium'
      },
      new ValidationCodeActionProvider(),
      {
        providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
      }
    )
  );
}
