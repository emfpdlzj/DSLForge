import * as vscode from 'vscode';
import type { ValidationPlan } from '../types';
import { readWorkspaceBuildToolInfo } from './workspaceBuildTool';
import { readWorkspacePackageInfo } from './workspacePackage';
import { resolveValidationPlanCore } from './validationPlan';

export interface ValidationResolutionInput {
  workspaceRoot: string;
  workspaceUri: vscode.Uri;
  adapterDisplayName: string;
  preferredScriptNames: string[];
  preferredGradleTaskNames?: string[];
  preferredMavenGoalNames?: string[];
}

export async function resolveValidationPlan(
  input: ValidationResolutionInput
): Promise<ValidationPlan> {
  const configuration = vscode.workspace.getConfiguration('dslforge', input.workspaceUri);
  const configuredCommand = configuration.get<string>('validation.command')?.trim();
  const packageInfo = await readWorkspacePackageInfo(input.workspaceRoot);
  const buildToolInfo = await readWorkspaceBuildToolInfo(input.workspaceRoot);

  return resolveValidationPlanCore({
    configuredCommand,
    adapterDisplayName: input.adapterDisplayName,
    preferredScriptNames: input.preferredScriptNames,
    preferredGradleTaskNames: input.preferredGradleTaskNames,
    preferredMavenGoalNames: input.preferredMavenGoalNames,
    packageInfo,
    buildToolInfo
  });
}
