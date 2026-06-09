import * as vscode from 'vscode';
import { getAiCommandGate } from '../core/aiCommandGate';
import {
  dslScaffoldService,
  projectService
} from '../core/services';

export const CREATE_DSL_SCAFFOLD_COMMAND = 'dslforge.createDslScaffold';

export function createDslScaffold(): vscode.Disposable {
  return vscode.commands.registerCommand(CREATE_DSL_SCAFFOLD_COMMAND, async () => {
    const projectContext = await projectService.resolveProjectContext();

    if (!projectContext) {
      await vscode.window.showWarningMessage(
        'DSLForge could not detect a supported DSL project in the current workspace.'
      );
      return;
    }

    const gateResult = await getAiCommandGate().ensureAccess(
      'Create DSL Scaffold'
    );

    if (gateResult.status !== 'ready') {
      return;
    }

    try {
      await dslScaffoldService.createDslScaffold(
        projectContext,
        gateResult.selectedModel!
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'DSLForge could not create a DSL scaffold proposal.';
      await vscode.window.showErrorMessage(message);
    }
  });
}
