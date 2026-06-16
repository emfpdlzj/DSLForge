import * as vscode from 'vscode';
import type { ResolvedProjectContext } from './projectService';
import type { ValidationRunResult } from '../types';
import { appendOutputLine } from './outputChannel';
import { runShellCommand } from './commandRunner';
import { dedupeValidationIssues, parseValidationIssues } from './validationDiagnostics';
import { resolveValidationPlan } from './validationCommandResolver';

const activeValidationRuns = new Set<string>();

export class ValidationOrchestrator {
  public async runValidation(
    projectContext: ResolvedProjectContext,
    token?: vscode.CancellationToken
  ): Promise<ValidationRunResult> {
    const startedAt = Date.now();
    const workspaceKey = projectContext.workspaceFolder.uri.fsPath;

    if (activeValidationRuns.has(workspaceKey)) {
      return {
        status: 'busy',
        summary: 'Validation is already running for this workspace.',
        plan: {
          command: {
            source: 'missing',
            detail: 'Another validation run is already active for this workspace.'
          },
          rationale: [
            `Workspace root: ${workspaceKey}`,
            'Concurrent validation runs are blocked to avoid overlapping process output and stale diagnostics.'
          ]
        },
        issues: [],
        durationMs: Date.now() - startedAt
      };
    }

    const preferences = await projectContext.adapter.getValidationPreferences({
      project: projectContext.detection,
      context: projectContext.context
    });
    const plan = await resolveValidationPlan({
      workspaceRoot: projectContext.workspaceFolder.uri.fsPath,
      workspaceUri: projectContext.workspaceFolder.uri,
      adapterDisplayName: projectContext.adapter.displayName,
      preferredScriptNames: preferences.preferredScriptNames,
      preferredGradleTaskNames: preferences.preferredGradleTaskNames,
      preferredMavenGoalNames: preferences.preferredMavenGoalNames
    });
    plan.rationale.push(...preferences.rationale);

    if (plan.command.source === 'missing') {
      return {
        status: 'needs_configuration',
        summary: 'Validation command configuration is required before validation can run.',
        plan,
        issues: [],
        durationMs: Date.now() - startedAt
      };
    }

    activeValidationRuns.add(workspaceKey);
    const configuration = vscode.workspace.getConfiguration(
      'dslforge',
      projectContext.workspaceFolder.uri
    );
    const maxCapturedOutputCharacters = Math.max(
      configuration.get<number>('validation.maxCapturedOutputCharacters') ?? 250000,
      10000
    );
    appendOutputLine(`[validation] executing=${plan.command.commandLine ?? 'unknown'}`);

    try {
      const execution = await runShellCommand(plan.command.commandLine!, {
        cwd: projectContext.workspaceFolder.uri.fsPath,
        token,
        maxCapturedCharacters: maxCapturedOutputCharacters
      });
      const interpretedIssues = projectContext.adapter.interpretValidationOutput
        ? await projectContext.adapter.interpretValidationOutput({
            project: projectContext.detection,
            context: projectContext.context,
            rawOutput: execution.combinedOutput
          })
        : [];
      const genericIssues = parseValidationIssues(execution.combinedOutput, {
        workspaceRoot: projectContext.workspaceFolder.uri.fsPath,
        defaultSource: projectContext.adapter.displayName
      });
      const issues = dedupeValidationIssues([...interpretedIssues, ...genericIssues]);

      if (execution.cancelled) {
        return {
          status: 'cancelled',
          summary: 'Validation was cancelled before completion.',
          plan,
          issues,
          rawOutput: execution.combinedOutput,
          exitCode: execution.exitCode,
          signal: execution.signal,
          outputTruncated: execution.outputTruncated,
          durationMs: Date.now() - startedAt,
          executionError: execution.error
        };
      }

      if (execution.error) {
        return {
          status: 'failed',
          summary: 'Validation command could not be started successfully.',
          plan,
          issues,
          rawOutput: execution.combinedOutput,
          exitCode: execution.exitCode,
          signal: execution.signal,
          outputTruncated: execution.outputTruncated,
          durationMs: Date.now() - startedAt,
          executionError: execution.error
        };
      }

      if (execution.exitCode === 0) {
        return {
          status: 'succeeded',
          summary: 'Validation completed successfully.',
          plan,
          issues,
          rawOutput: execution.combinedOutput,
          exitCode: execution.exitCode,
          signal: execution.signal,
          outputTruncated: execution.outputTruncated,
          durationMs: Date.now() - startedAt
        };
      }

      return {
        status: 'failed',
        summary: 'Validation failed. Review diagnostics and output for details.',
        plan,
        issues,
        rawOutput: execution.combinedOutput,
        exitCode: execution.exitCode,
        signal: execution.signal,
        outputTruncated: execution.outputTruncated,
        durationMs: Date.now() - startedAt
      };
    } finally {
      activeValidationRuns.delete(workspaceKey);
    }
  }
}
