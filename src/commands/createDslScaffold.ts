import * as vscode from 'vscode';
import { getAiCommandGate } from '../core/aiCommandGate';
import { projectService } from '../core/services';

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

    await vscode.window.showInformationMessage(
      `Create DSL Scaffold is not implemented yet. Resolved adapter: ${projectContext.adapter.displayName}. Selected model: ${gateResult.selectedModel?.name ?? 'unknown'}.`
    );
  });
}
