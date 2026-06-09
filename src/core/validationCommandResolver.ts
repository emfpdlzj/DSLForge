import * as vscode from 'vscode';
import type { ValidationPlan } from '../types';
import {
  buildPackageScriptCommand,
  readWorkspacePackageInfo
} from './workspacePackage';

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

  if (configuredCommand) {
    return {
      command: {
        source: 'user-configured',
        commandLine: configuredCommand,
        detail: 'Using the user-configured validation command from dslforge.validation.command.'
      },
      rationale: [
        `Adapter selected: ${input.adapterDisplayName}`,
        'Validation source priority matched the workspace setting first.'
      ]
    };
  }

  const packageInfo = await readWorkspacePackageInfo(input.workspaceRoot);

  if (!packageInfo) {
    return {
      command: {
        source: 'missing',
        detail:
          'No package.json was found in the workspace root, so DSLForge could not auto-detect a validation script.'
      },
      rationale: [
        `Adapter selected: ${input.adapterDisplayName}`,
        'Workspace setting dslforge.validation.command is empty.',
        'No package.json exists at the workspace root.'
      ]
    };
  }

  const scripts = packageInfo.manifest.scripts ?? {};
  const matchingScriptName = input.preferredScriptNames.find((scriptName) =>
    Object.prototype.hasOwnProperty.call(scripts, scriptName)
  );

  if (matchingScriptName) {
    return {
      command: {
        source: 'package-script',
        commandLine: buildPackageScriptCommand(
          packageInfo.packageManager,
          matchingScriptName
        ),
        scriptName: matchingScriptName,
        detail: `Using package.json script "${matchingScriptName}" via ${packageInfo.packageManager}.`
      },
      rationale: [
        `Adapter selected: ${input.adapterDisplayName}`,
        'Workspace setting dslforge.validation.command is empty.',
        `Matched package.json script "${matchingScriptName}" from the preferred validation script list.`
      ]
    };
  }

  return {
    command: {
      source: 'missing',
      detail:
        'DSLForge could not find a validation command. Configure dslforge.validation.command or add a supported package.json script.'
    },
    rationale: [
      `Adapter selected: ${input.adapterDisplayName}`,
      'Workspace setting dslforge.validation.command is empty.',
      `No preferred validation script was found in package.json. Checked: ${input.preferredScriptNames.join(', ')}.`
    ]
  };
}
