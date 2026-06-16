import * as vscode from 'vscode';
import { diagnosticsPresenter, projectService, validationOrchestrator } from '../core/services';
import { showFeatureExecutionError, showUnsupportedWorkspaceGuidance } from '../core/userGuidance';
import { getTelemetryService } from '../core/telemetry';
import { ensureTrustedWorkspace } from '../core/workspaceTrust';

export const VALIDATE_CURRENT_GRAMMAR_COMMAND = 'dslforge.validateCurrentGrammar';

export function validateCurrentGrammar(): vscode.Disposable {
  return vscode.commands.registerCommand(VALIDATE_CURRENT_GRAMMAR_COMMAND, async () => {
    if (!(await ensureTrustedWorkspace('Validate Current Grammar'))) {
      return;
    }

    const projectContext = await projectService.resolveProjectContext();

    if (!projectContext) {
      await showUnsupportedWorkspaceGuidance('Validate Current Grammar');
      return;
    }

    try {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'DSLForge is validating the current grammar',
          cancellable: true
        },
        async (_progress, token) => {
          const result = await validationOrchestrator.runValidation(projectContext, token);
          getTelemetryService().sendUsage(
            'validation_run',
            {
              status: result.status,
              command_source: result.plan.command.source
            },
            {
              issue_count: result.issues.length,
              duration_ms: result.durationMs,
              exit_code: typeof result.exitCode === 'number' ? result.exitCode : undefined
            }
          );
          await diagnosticsPresenter.presentValidationResult(projectContext, result);
        }
      );
    } catch (error) {
      getTelemetryService().sendError('feature_error', {
        feature_name: 'Validate Current Grammar',
        error_type: error instanceof Error ? error.name : typeof error
      });

      const message =
        error instanceof Error ? error.message : 'DSLForge could not validate the current grammar.';
      await showFeatureExecutionError('Validate Current Grammar', message);
    }
  });
}
