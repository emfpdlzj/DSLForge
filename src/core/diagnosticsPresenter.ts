import * as vscode from 'vscode';
import { appendOutputDivider, appendOutputLine, showOutputChannel } from './outputChannel';
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

interface IssueSummary {
  errors: number;
  warnings: number;
  infos: number;
  files: number;
  unlocated: number;
}

function buildValidationMessageDetail(result: ValidationRunResult): string {
  if (result.status === 'busy') {
    return 'an already-running validation command';
  }

  if (result.plan.command.source === 'user-configured') {
    return `configured command "${result.plan.command.commandLine ?? ''}"`;
  }

  if (result.plan.command.source === 'package-script') {
    return `package.json script "${result.plan.command.scriptName ?? ''}"`;
  }

  if (result.plan.command.source === 'gradle-wrapper') {
    return `Gradle wrapper command "${result.plan.command.commandLine ?? ''}"`;
  }

  if (result.plan.command.source === 'maven-wrapper') {
    return `Maven wrapper command "${result.plan.command.commandLine ?? ''}"`;
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
      message: `${result.plan.command.detail} Quick Fix: configure dslforge.validation.command or review the workspace validation entry point.`
    }
  ];
}

function buildIssueSummary(issues: ValidationIssue[]): IssueSummary {
  const files = new Set<string>();
  let errors = 0;
  let warnings = 0;
  let infos = 0;
  let unlocated = 0;

  for (const issue of issues) {
    if (issue.filePath) {
      files.add(issue.filePath);
    } else {
      unlocated += 1;
    }

    if (issue.severity === 'warning') {
      warnings += 1;
      continue;
    }

    if (issue.severity === 'info') {
      infos += 1;
      continue;
    }

    errors += 1;
  }

  return {
    errors,
    warnings,
    infos,
    files: files.size,
    unlocated
  };
}

function formatIssueLocation(issue: ValidationIssue): string {
  if (!issue.filePath || !issue.line || !issue.column) {
    return 'unlocated';
  }

  return `${issue.filePath}:${issue.line}:${issue.column}`;
}

function formatIssueSummary(summary: IssueSummary): string {
  return `${summary.errors} error(s), ${summary.warnings} warning(s), ${summary.infos} info message(s) across ${summary.files} file(s)`;
}

function appendIssuePreview(issues: ValidationIssue[]): void {
  const previewLimit = 10;

  if (issues.length === 0) {
    appendOutputLine('No structured diagnostics were extracted from the validation output.');
    return;
  }

  for (const issue of issues.slice(0, previewLimit)) {
    const codeLabel = issue.code ? ` [${issue.code}]` : '';
    const sourceLabel = issue.source ? ` <${issue.source}>` : '';
    appendOutputLine(
      `- ${issue.severity.toUpperCase()}${codeLabel}${sourceLabel} ${formatIssueLocation(issue)} ${issue.message}`
    );
  }

  if (issues.length > previewLimit) {
    appendOutputLine(`... ${issues.length - previewLimit} more issue(s) omitted from the preview.`);
  }
}

function appendValidationReport(
  projectContext: ResolvedProjectContext,
  result: ValidationRunResult,
  publishedIssues: ValidationIssue[]
): void {
  const issueSummary = buildIssueSummary(publishedIssues);
  const timestamp = new Date().toISOString();

  appendOutputDivider(`DSLForge Validation Report ${timestamp}`);
  appendOutputLine(`workspace: ${projectContext.workspaceFolder.uri.fsPath}`);
  appendOutputLine(`adapter: ${projectContext.adapter.displayName}`);
  appendOutputLine(`status: ${result.status}`);
  appendOutputLine(`active grammar: ${projectContext.context.activeGrammarFile ?? 'none'}`);
  appendOutputLine(
    `selected context files: ${projectContext.context.contextFiles.length > 0 ? projectContext.context.contextFiles.map((file) => file.filePath).join(', ') : 'none'}`
  );
  appendOutputLine(`command source: ${result.plan.command.source}`);
  appendOutputLine(`command detail: ${result.plan.command.detail}`);

  if (result.plan.command.commandLine) {
    appendOutputLine(`command line: ${result.plan.command.commandLine}`);
  }

  if (typeof result.exitCode !== 'undefined') {
    appendOutputLine(`exit code: ${result.exitCode}`);
  }

  if (typeof result.signal !== 'undefined') {
    appendOutputLine(`signal: ${result.signal ?? 'none'}`);
  }

  if (typeof result.durationMs !== 'undefined') {
    appendOutputLine(`duration: ${result.durationMs}ms`);
  }

  if (result.outputTruncated) {
    appendOutputLine('output: truncated to the in-memory capture limit');
  }

  if (result.executionError) {
    appendOutputLine(`execution error: ${result.executionError}`);
  }

  appendOutputLine(`summary: ${result.summary}`);
  appendOutputLine(`structured diagnostics: ${formatIssueSummary(issueSummary)}`);

  if (issueSummary.unlocated > 0) {
    appendOutputLine(`unlocated diagnostics: ${issueSummary.unlocated}`);
  }

  appendOutputDivider('Context Notes');

  if (projectContext.context.notes.length === 0) {
    appendOutputLine('No context notes recorded.');
  } else {
    for (const note of projectContext.context.notes) {
      appendOutputLine(`- ${note}`);
    }
  }

  appendOutputDivider('Project Signals');

  if (projectContext.detection.context.signals.length === 0) {
    appendOutputLine('No project signals recorded.');
  } else {
    for (const signal of projectContext.detection.context.signals) {
      const detail = signal.detail ? ` (${signal.detail})` : '';
      appendOutputLine(`- ${signal.kind}: ${signal.value}${detail}`);
    }
  }

  appendOutputDivider('Validation Rationale');
  for (const rationaleLine of result.plan.rationale) {
    appendOutputLine(`- ${rationaleLine}`);
  }

  appendOutputDivider('Diagnostic Preview');
  appendIssuePreview(publishedIssues);
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

  await vscode.commands.executeCommand(selectedAction.command, ...(selectedAction.arguments ?? []));
}

export class DiagnosticsPresenter {
  public async presentValidationResult(
    projectContext: ResolvedProjectContext,
    result: ValidationRunResult
  ): Promise<void> {
    const issuesToPublish =
      result.status === 'needs_configuration'
        ? [...result.issues, ...createMissingConfigurationIssue(projectContext, result)]
        : result.issues;

    publishValidationIssues(issuesToPublish);
    appendValidationReport(projectContext, result, issuesToPublish);
    showOutputChannel();

    const outputAction: MessageAction = {
      title: 'Show Output',
      command: 'workbench.action.output.toggleOutput'
    };
    const problemsAction: MessageAction = {
      title: 'Show Problems',
      command: 'workbench.actions.view.problems'
    };
    const settingsAction: MessageAction = {
      title: 'Open Validation Settings',
      command: OPEN_VALIDATION_SETTINGS_COMMAND
    };
    const packageJsonAction: MessageAction = {
      title: 'Open Workspace package.json',
      command: OPEN_WORKSPACE_PACKAGE_JSON_COMMAND,
      arguments: [{ workspaceRoot: projectContext.workspaceFolder.uri.fsPath }]
    };

    if (result.status === 'succeeded') {
      const summary = buildIssueSummary(issuesToPublish);
      const message = `DSLForge validation succeeded using ${buildValidationMessageDetail(result)}. ${formatIssueSummary(summary)}.`;
      const actions =
        result.plan.command.source === 'user-configured'
          ? [problemsAction, outputAction, settingsAction]
          : result.plan.command.source === 'package-script'
            ? [problemsAction, outputAction, packageJsonAction]
            : [problemsAction, outputAction];
      await showMessageWithActions('info', message, actions);
      return;
    }

    if (result.status === 'failed') {
      const summary = buildIssueSummary(issuesToPublish);
      const executionTail = result.executionError
        ? ` Start error: ${result.executionError}.`
        : result.outputTruncated
          ? ' Output capture was truncated.'
          : '';
      const message = `DSLForge validation failed using ${buildValidationMessageDetail(result)}. ${formatIssueSummary(summary)}.${executionTail}`;
      const actions =
        result.plan.command.source === 'user-configured'
          ? [problemsAction, outputAction, settingsAction]
          : result.plan.command.source === 'package-script'
            ? [problemsAction, outputAction, packageJsonAction]
            : [problemsAction, outputAction];
      await showMessageWithActions('warning', message, actions);
      return;
    }

    if (result.status === 'cancelled') {
      const summary = buildIssueSummary(issuesToPublish);
      await showMessageWithActions(
        'warning',
        `DSLForge cancelled validation using ${buildValidationMessageDetail(result)}. ${formatIssueSummary(summary)}.`,
        [problemsAction, outputAction]
      );
      return;
    }

    if (result.status === 'busy') {
      await showMessageWithActions(
        'warning',
        'DSLForge already has a validation run in progress for this workspace.',
        [outputAction]
      );
      return;
    }

    await showMessageWithActions(
      'warning',
      'DSLForge could not resolve a validation command. Configure dslforge.validation.command or add a supported package.json script, Gradle wrapper task, or Maven wrapper goal.',
      [settingsAction, packageJsonAction, problemsAction, outputAction]
    );
  }
}
