import * as vscode from 'vscode';
import { getAiCommandGate } from '../core/aiCommandGate';
import { dslScaffoldService, projectService } from '../core/services';
import { showFeatureExecutionError } from '../core/userGuidance';
import { getTelemetryService } from '../core/telemetry';
import { ensureTrustedWorkspace } from '../core/workspaceTrust';

export const CREATE_DSL_SCAFFOLD_COMMAND = 'dslforge.createDslScaffold';

export function createDslScaffold(): vscode.Disposable {
  return vscode.commands.registerCommand(CREATE_DSL_SCAFFOLD_COMMAND, async () => {
    if (!(await ensureTrustedWorkspace('Create DSL Scaffold'))) {
      return;
    }

    const workspaceSelection = projectService.resolveWorkspaceSelection();

    if (!workspaceSelection) {
      await showFeatureExecutionError(
        'Create DSL Scaffold',
        'DSLForge needs an open workspace folder to create a scaffold proposal.'
      );
      return;
    }

    const projectContext = await projectService.resolveProjectContext();
    const gateResult = await getAiCommandGate().ensureAccess('Create DSL Scaffold');

    if (gateResult.status !== 'ready') {
      return;
    }

    try {
      await dslScaffoldService.createDslScaffold(
        projectContext ?? workspaceSelection,
        gateResult.selectedModel!
      );
    } catch (error) {
      getTelemetryService().sendError('feature_error', {
        feature_name: 'Create DSL Scaffold',
        error_type: error instanceof Error ? error.name : typeof error
      });
      const message =
        error instanceof Error
          ? error.message
          : 'DSLForge could not create a DSL scaffold proposal.';
      await showFeatureExecutionError('Create DSL Scaffold', message);
    }
  });
}
