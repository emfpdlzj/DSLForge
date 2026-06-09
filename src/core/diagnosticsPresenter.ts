import * as vscode from 'vscode';
import { appendOutputLine, showOutputChannel } from './outputChannel';
import type { ResolvedProjectContext } from './projectService';
import type { ValidationRunResult } from '../types';
import { publishValidationIssues } from './validationDiagnostics';

export class DiagnosticsPresenter {
  public presentValidationResult(
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
    appendOutputLine(`[validation] commandDetail=${result.plan.command.detail}`);

    if (result.plan.command.commandLine) {
      appendOutputLine(
        `[validation] command=${result.plan.command.commandLine}`
      );
    }

    for (const rationaleLine of result.plan.rationale) {
      appendOutputLine(`[validation] rationale=${rationaleLine}`);
    }

    if (typeof result.exitCode !== 'undefined') {
      appendOutputLine(`[validation] exitCode=${result.exitCode}`);
    }

    appendOutputLine(`[validation] issueCount=${result.issues.length}`);

    publishValidationIssues(result.issues);
    showOutputChannel();

    let message = result.summary;

    if (result.status === 'succeeded') {
      message = `DSLForge validation succeeded via ${result.plan.command.source}.`;
    } else if (result.status === 'failed') {
      message = `DSLForge validation failed via ${result.plan.command.source}. See Output and Problems for details.`;
    }

    void vscode.window.showInformationMessage(message);
  }
}
