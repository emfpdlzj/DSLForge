import * as vscode from 'vscode';
import type { ValidationPlan } from '../types';
import { readWorkspacePackageInfo } from './workspacePackage';
import { resolveValidationPlanCore } from './validationPlan';

export interface ValidationResolutionInput {
  workspaceRoot: string;
  workspaceUri: vscode.Uri;
  adapterDisplayName: string;
  preferredScriptNames: string[];
}

export async function resolveValidationPlan(
  input: ValidationResolutionInput
): Promise<ValidationPlan> {
  const configuration = vscode.workspace.getConfiguration(
    'dslforge',
    input.workspaceUri
  );
  const configuredCommand = configuration
    .get<string>('validation.command')
    ?.trim();
  const packageInfo = await readWorkspacePackageInfo(input.workspaceRoot);

  return resolveValidationPlanCore({
    configuredCommand,
    adapterDisplayName: input.adapterDisplayName,
    preferredScriptNames: input.preferredScriptNames,
    packageInfo
  });
}
