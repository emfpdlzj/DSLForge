import * as vscode from 'vscode';
import { appendOutputLine, showOutputChannel } from './outputChannel';
import type { ResolvedProjectContext } from './projectService';
import type { ValidationIssue, ValidationRunResult } from '../types';
import { publishValidationIssues } from './validationDiagnostics';
import {
  OPEN_VALIDATION_SETTINGS_COMMAND,
  OPEN_WORKSPACE_PACKAGE_JSON_COMMAND
} from './validationActions';

const VALIDATION_MISSING_CODE = 'dslforge.validation.missing';

interface MessageAction {
  title: string;
  command?: string;
  arguments?: unknown[];
}

function buildValidationMessageDetail(result: ValidationRunResult): string {
  if (result.plan.command.source === 'user-configured') {
    return `configured command "${result.plan.command.commandLine ?? ''}"`;
  }

  if (result.plan.command.source === 'package-script') {
    return `package.json script "${result.plan.command.scriptName ?? ''}"`;
  }

  return 'missing validation configuration';
}

function createMissingConfigurationIssue(
  projectContext: ResolvedProjectContext,
  result: ValidationRunResult
): ValidationIssue[] {
  const activeGrammarFile = projectContext.context.activeGrammarFile;

  if (!activeGrammarFile) {
    return [];
  }

  return [
    {
      filePath: activeGrammarFile,
      line: 1,
      column: 1,
      severity: 'warning',
      code: VALIDATION_MISSING_CODE,
      message: `${result.plan.command.detail} Quick Fix: configure dslforge.validation.command or open package.json.`
    }
  ];
}

async function showMessageWithActions(
  severity: 'info' | 'warning' | 'error',
  message: string,
  actions: MessageAction[]
): Promise<void> {
  const titles = actions.map((action) => action.title);
  const selected =
    severity === 'warning'
      ? await vscode.window.showWarningMessage(message, ...titles)
      : severity === 'error'
        ? await vscode.window.showErrorMessage(message, ...titles)
        : await vscode.window.showInformationMessage(message, ...titles);

  const selectedAction = actions.find((action) => action.title === selected);

  if (!selectedAction?.command) {
    return;
  }

  await vscode.commands.executeCommand(
    selectedAction.command,
    ...(selectedAction.arguments ?? [])
  );
}

export class DiagnosticsPresenter {
  public async presentValidationResult(
    projectContext: ResolvedProjectContext,
    result: ValidationRunResult
  ): Promise<void> {
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

    const issuesToPublish =
      result.status === 'needs_configuration'
        ? [...result.issues, ...createMissingConfigurationIssue(projectContext, result)]
        : result.issues;

    publishValidationIssues(issuesToPublish);
    showOutputChannel();

    const outputAction: MessageAction = {
      title: 'Show Output',
      command: 'workbench.action.output.toggleOutput'
    };
    const settingsAction: MessageAction = {
      title: 'Open Settings',
      command: OPEN_VALIDATION_SETTINGS_COMMAND
    };
    const packageJsonAction: MessageAction = {
      title: 'Open package.json',
      command: OPEN_WORKSPACE_PACKAGE_JSON_COMMAND,
      arguments: [{ workspaceRoot: projectContext.workspaceFolder.uri.fsPath }]
    };

    if (result.status === 'succeeded') {
      const message = `DSLForge validation succeeded using ${buildValidationMessageDetail(result)}.`;
      const actions =
        result.plan.command.source === 'user-configured'
          ? [outputAction, settingsAction]
          : result.plan.command.source === 'package-script'
            ? [outputAction, packageJsonAction]
            : [outputAction];
      await showMessageWithActions('info', message, actions);
      return;
    }

    if (result.status === 'failed') {
      const message = `DSLForge validation failed using ${buildValidationMessageDetail(result)}. See Output and Problems for details.`;
      const actions =
        result.plan.command.source === 'user-configured'
          ? [outputAction, settingsAction]
          : result.plan.command.source === 'package-script'
            ? [outputAction, packageJsonAction]
            : [outputAction];
      await showMessageWithActions('warning', message, actions);
      return;
    }

    await showMessageWithActions(
      'warning',
      'DSLForge could not resolve a validation command. Configure dslforge.validation.command or add a supported package.json script.',
      [settingsAction, packageJsonAction, outputAction]
    );
  }
}
