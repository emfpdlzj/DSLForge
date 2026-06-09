import * as vscode from 'vscode';
import { getAiCommandGate } from '../core/aiCommandGate';
import { projectService } from '../core/services';

export const GENERATE_SAMPLE_DSL_COMMAND = 'dslforge.generateSampleDsl';

export function generateSampleDsl(): vscode.Disposable {
  return vscode.commands.registerCommand(GENERATE_SAMPLE_DSL_COMMAND, async () => {
    const projectContext = await projectService.resolveProjectContext();

    if (!projectContext) {
      await vscode.window.showWarningMessage(
        'DSLForge could not detect a supported DSL project in the current workspace.'
      );
      return;
    }

    const gateResult = await getAiCommandGate().ensureAccess(
      'Generate Sample DSL'
    );

    if (gateResult.status !== 'ready') {
      return;
    }

    await vscode.window.showInformationMessage(
      `Generate Sample DSL is not implemented yet. Resolved adapter: ${projectContext.adapter.displayName}. Selected model: ${gateResult.selectedModel?.name ?? 'unknown'}.`
    );
  });
}
