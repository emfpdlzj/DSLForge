import type { ResolvedProjectContext } from './projectService';
import type { ValidationRunResult } from '../types';
import { appendOutputLine } from './outputChannel';
import { runShellCommand } from './commandRunner';
import {
  dedupeValidationIssues,
  parseValidationIssues
} from './validationDiagnostics';
import { resolveValidationPlan } from './validationCommandResolver';

export class ValidationOrchestrator {
  public async runValidation(
    projectContext: ResolvedProjectContext
  ): Promise<ValidationRunResult> {
    const preferences = await projectContext.adapter.getValidationPreferences({
      project: projectContext.detection,
      context: projectContext.context
    });
    const plan = await resolveValidationPlan({
      workspaceRoot: projectContext.workspaceFolder.uri.fsPath,
      workspaceUri: projectContext.workspaceFolder.uri,
      adapterDisplayName: projectContext.adapter.displayName,
      preferredScriptNames: preferences.preferredScriptNames
    });
    plan.rationale.push(...preferences.rationale);

    if (plan.command.source === 'missing') {
      return {
        status: 'needs_configuration',
        summary: 'Validation command configuration is required before validation can run.',
        plan,
        issues: []
      };
    }

    appendOutputLine(
      `[validation] executing=${plan.command.commandLine ?? 'unknown'}`
    );

    const execution = await runShellCommand(
      plan.command.commandLine!,
      projectContext.workspaceFolder.uri.fsPath
    );
    const interpretedIssues = projectContext.adapter.interpretValidationOutput
      ? await projectContext.adapter.interpretValidationOutput({
          project: projectContext.detection,
          context: projectContext.context,
          rawOutput: execution.combinedOutput
        })
      : [];
    const genericIssues = parseValidationIssues(execution.combinedOutput, {
      workspaceRoot: projectContext.workspaceFolder.uri.fsPath
    });
    const issues = dedupeValidationIssues([
      ...interpretedIssues,
      ...genericIssues
    ]);

    if (execution.exitCode === 0) {
      return {
        status: 'succeeded',
        summary: 'Validation completed successfully.',
        plan,
        issues,
        rawOutput: execution.combinedOutput,
        exitCode: execution.exitCode
      };
    }

    return {
      status: 'failed',
      summary: 'Validation failed. Review diagnostics and output for details.',
      plan,
      issues,
      rawOutput: execution.combinedOutput,
      exitCode: execution.exitCode
    };
  }
}
