import type { ValidationPlan } from '../types';
import {
  buildPackageScriptCommand,
  type WorkspacePackageInfo
} from './workspacePackage';
import {
  buildGradleWrapperCommand,
  buildMavenWrapperCommand,
  type WorkspaceBuildToolInfo
} from './workspaceBuildTool';

const COMMON_GRADLE_TASK_NAMES = new Set([
  'assemble',
  'build',
  'check',
  'generateLanguage',
  'generateGrammarSource',
  'generateTestGrammarSource',
  'generateXtext',
  'test'
]);

const COMMON_MAVEN_GOAL_NAMES = new Set([
  'compile',
  'generate-sources',
  'package',
  'test',
  'validate',
  'verify'
]);

export interface ResolveValidationPlanCoreInput {
  configuredCommand?: string;
  adapterDisplayName: string;
  preferredScriptNames: string[];
  preferredGradleTaskNames?: string[];
  preferredMavenGoalNames?: string[];
  packageInfo?: WorkspacePackageInfo;
  buildToolInfo?: WorkspaceBuildToolInfo;
}

function isGradleTaskCandidate(taskName: string): boolean {
  return COMMON_GRADLE_TASK_NAMES.has(taskName) || taskName.startsWith(':');
}

function isMavenGoalCandidate(goalName: string): boolean {
  return COMMON_MAVEN_GOAL_NAMES.has(goalName) || goalName.includes(':');
}

function resolveGradleWrapperPlan(
  input: ResolveValidationPlanCoreInput
): ValidationPlan | undefined {
  if (!input.buildToolInfo?.gradle) {
    return undefined;
  }

  const matchingTaskName = (
    input.preferredGradleTaskNames ?? input.preferredScriptNames
  ).find((taskName) =>
    isGradleTaskCandidate(taskName)
  );

  if (!matchingTaskName) {
    return undefined;
  }

  const commandLine = buildGradleWrapperCommand(
    input.buildToolInfo.gradle,
    matchingTaskName
  );

  if (!commandLine) {
    return undefined;
  }

  return {
    command: {
      source: 'gradle-wrapper',
      commandLine,
      detail: `Using Gradle wrapper task candidate "${matchingTaskName}" via ${commandLine}.`
    },
    rationale: [
      `Adapter selected: ${input.adapterDisplayName}`,
      'Workspace setting dslforge.validation.command is empty.',
      'No preferred package.json validation script was found.',
      `Gradle wrapper was detected and matched the preferred task candidate "${matchingTaskName}".`
    ]
  };
}

function resolveMavenWrapperPlan(
  input: ResolveValidationPlanCoreInput
): ValidationPlan | undefined {
  if (!input.buildToolInfo?.maven) {
    return undefined;
  }

  const matchingGoalName = (
    input.preferredMavenGoalNames ?? input.preferredScriptNames
  ).find((goalName) =>
    isMavenGoalCandidate(goalName)
  );

  if (!matchingGoalName) {
    return undefined;
  }

  const commandLine = buildMavenWrapperCommand(
    input.buildToolInfo.maven,
    matchingGoalName
  );

  if (!commandLine) {
    return undefined;
  }

  return {
    command: {
      source: 'maven-wrapper',
      commandLine,
      detail: `Using Maven wrapper goal candidate "${matchingGoalName}" via ${commandLine}.`
    },
    rationale: [
      `Adapter selected: ${input.adapterDisplayName}`,
      'Workspace setting dslforge.validation.command is empty.',
      'No preferred package.json validation script was found.',
      'No Gradle wrapper task candidate was selected.',
      `Maven wrapper was detected and matched the preferred goal candidate "${matchingGoalName}".`
    ]
  };
}

export function resolveValidationPlanCore(
  input: ResolveValidationPlanCoreInput
): ValidationPlan {
  const configuredCommand = input.configuredCommand?.trim();

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

  if (input.packageInfo) {
    const scripts = input.packageInfo.manifest.scripts ?? {};
    const matchingScriptName = input.preferredScriptNames.find((scriptName) =>
      Object.prototype.hasOwnProperty.call(scripts, scriptName)
    );

    if (matchingScriptName) {
      return {
        command: {
          source: 'package-script',
          commandLine: buildPackageScriptCommand(
            input.packageInfo.packageManager,
            matchingScriptName
          ),
          scriptName: matchingScriptName,
          detail: `Using package.json script "${matchingScriptName}" via ${input.packageInfo.packageManager}.`
        },
        rationale: [
          `Adapter selected: ${input.adapterDisplayName}`,
          'Workspace setting dslforge.validation.command is empty.',
          `Matched package.json script "${matchingScriptName}" from the preferred validation script list.`
        ]
      };
    }
  }

  const gradleWrapperPlan = resolveGradleWrapperPlan(input);

  if (gradleWrapperPlan) {
    return gradleWrapperPlan;
  }

  const mavenWrapperPlan = resolveMavenWrapperPlan(input);

  if (mavenWrapperPlan) {
    return mavenWrapperPlan;
  }

  return {
    command: {
      source: 'missing',
      detail:
        'DSLForge could not find a validation command. Configure dslforge.validation.command or add a supported package.json script, Gradle wrapper task, or Maven wrapper goal.'
    },
    rationale: [
      `Adapter selected: ${input.adapterDisplayName}`,
      'Workspace setting dslforge.validation.command is empty.',
      input.packageInfo
        ? 'No preferred package.json validation script was found.'
        : 'No package.json exists at the workspace root.',
      `No preferred validation source was resolved. Checked candidates: ${input.preferredScriptNames.join(', ')}.`
    ]
  };
}
