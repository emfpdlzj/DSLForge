import * as vscode from 'vscode';
import { getAiCommandGate } from '../core/aiCommandGate';
import {
  projectService,
  sampleDslService
} from '../core/services';
import {
  showFeatureExecutionError,
  showUnsupportedWorkspaceGuidance
} from '../core/userGuidance';

export const GENERATE_SAMPLE_DSL_COMMAND = 'dslforge.generateSampleDsl';

export function generateSampleDsl(): vscode.Disposable {
  return vscode.commands.registerCommand(GENERATE_SAMPLE_DSL_COMMAND, async () => {
    const projectContext = await projectService.resolveProjectContext();

    if (!projectContext) {
      await showUnsupportedWorkspaceGuidance('Generate Sample DSL');
      return;
    }

    const gateResult = await getAiCommandGate().ensureAccess(
      'Generate Sample DSL'
    );

    if (gateResult.status !== 'ready') {
      return;
    }

    try {
      await sampleDslService.generateSampleDsl(
        projectContext,
        gateResult.selectedModel!
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'DSLForge could not generate sample DSL text.';
      await showFeatureExecutionError('Generate Sample DSL', message);
    }
  });
}
