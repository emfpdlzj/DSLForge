import * as vscode from 'vscode';
import { appendOutputLine, showOutputChannel } from './outputChannel';
import type { ResolvedProjectContext } from './projectService';
import type { ValidationRunResult } from '../types';

export class DiagnosticsPresenter {
  public presentValidationPreparation(
    projectContext: ResolvedProjectContext,
    result: ValidationRunResult
  ): void {
    appendOutputLine(
      `[validation] adapter=${projectContext.adapter.id} workspace=${projectContext.workspaceFolder.uri.fsPath}`
    );
    appendOutputLine(
      `[validation] activeGrammar=${projectContext.context.activeGrammarFile ?? 'none'}`
    );
    appendOutputLine(`[validation] status=${result.status}`);
    appendOutputLine(
      `[validation] commandSource=${result.plan.command.source}`
    );

    if (result.plan.command.commandLine) {
      appendOutputLine(
        `[validation] command=${result.plan.command.commandLine}`
      );
    }

    for (const rationaleLine of result.plan.rationale) {
      appendOutputLine(`[validation] rationale=${rationaleLine}`);
    }

    showOutputChannel();

    const message =
      result.status === 'ready'
        ? `DSLForge prepared validation for ${projectContext.adapter.displayName}. Execution wiring is the next step.`
        : result.summary;

    void vscode.window.showInformationMessage(message);
  }
}
