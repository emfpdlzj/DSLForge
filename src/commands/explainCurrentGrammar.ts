import * as vscode from 'vscode';
import { getAiCommandGate } from '../core/aiCommandGate';
import { grammarExplanationService, projectService } from '../core/services';
import { showFeatureExecutionError, showUnsupportedWorkspaceGuidance } from '../core/userGuidance';
import { getTelemetryService } from '../core/telemetry';
import { ensureTrustedWorkspace } from '../core/workspaceTrust';

export const EXPLAIN_CURRENT_GRAMMAR_COMMAND = 'dslforge.explainCurrentGrammar';

export function explainCurrentGrammar(): vscode.Disposable {
  return vscode.commands.registerCommand(EXPLAIN_CURRENT_GRAMMAR_COMMAND, async () => {
    if (!(await ensureTrustedWorkspace('Explain Current Grammar'))) {
      return;
    }

    const projectContext = await projectService.resolveProjectContext();

    if (!projectContext) {
      await showUnsupportedWorkspaceGuidance('Explain Current Grammar');
      return;
    }

    const gateResult = await getAiCommandGate().ensureAccess('Explain Current Grammar');

    if (gateResult.status !== 'ready') {
      return;
    }

    try {
      await grammarExplanationService.explainCurrentGrammar(
        projectContext,
        gateResult.selectedModel!
      );
    } catch (error) {
      getTelemetryService().sendError('feature_error', {
        feature_name: 'Explain Current Grammar',
        error_type: error instanceof Error ? error.name : typeof error
      });
      const message =
        error instanceof Error ? error.message : 'DSLForge could not explain the current grammar.';
      await showFeatureExecutionError('Explain Current Grammar', message);
    }
  });
}
