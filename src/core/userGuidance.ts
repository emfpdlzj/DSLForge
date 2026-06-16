import * as vscode from 'vscode';
import { appendOutputDivider, appendOutputLine, showOutputChannel } from './outputChannel';

const OPEN_CHAT_SETTINGS_ACTION = 'Open Chat Settings';
const MANAGE_WORKSPACE_TRUST_ACTION = 'Manage Workspace Trust';
const SHOW_OUTPUT_ACTION = 'Show Output';

async function showMessageWithActions(
  message: string,
  actions: readonly string[]
): Promise<string | undefined> {
  return vscode.window.showWarningMessage(message, ...actions);
}

async function openWorkspaceTrustManagement(): Promise<void> {
  const candidateCommands = ['workbench.trust.manage', 'workbench.trust.configure'];

  for (const command of candidateCommands) {
    try {
      await vscode.commands.executeCommand(command);
      return;
    } catch {
      // Fall through to the next trust-management command.
    }
  }

  await vscode.commands.executeCommand(
    'workbench.action.openSettings',
    'security.workspace.trust.enabled'
  );
}

export async function showUnsupportedWorkspaceGuidance(featureName: string): Promise<void> {
  const message =
    `DSLForge could not detect a supported DSL workspace for ${featureName}. ` +
    'Current supported framework signals are Langium, ANTLR4, and Xtext. Open a workspace with .langium, .g4, or .xtext files, or with related config/build files such as langium-config.json, .mwe2, gradlew, or mvnw, then retry.';

  appendOutputDivider(`DSLForge Workspace Guidance ${featureName}`);
  appendOutputLine(`message: ${message}`);
  showOutputChannel();

  const selection = await showMessageWithActions(message, [SHOW_OUTPUT_ACTION]);

  if (selection === SHOW_OUTPUT_ACTION) {
    await vscode.commands.executeCommand('workbench.action.output.toggleOutput');
  }
}

export async function showFeatureExecutionError(
  featureName: string,
  message: string
): Promise<void> {
  appendOutputDivider(`DSLForge Error ${featureName}`);
  appendOutputLine(`message: ${message}`);
  showOutputChannel();

  const selection = await vscode.window.showErrorMessage(message, SHOW_OUTPUT_ACTION);

  if (selection === SHOW_OUTPUT_ACTION) {
    await vscode.commands.executeCommand('workbench.action.output.toggleOutput');
  }
}

export async function showAiSetupGuidance(featureName: string, message: string): Promise<void> {
  appendOutputDivider(`DSLForge AI Setup Guidance ${featureName}`);
  appendOutputLine(`message: ${message}`);
  showOutputChannel();

  const selection = await showMessageWithActions(message, [
    OPEN_CHAT_SETTINGS_ACTION,
    SHOW_OUTPUT_ACTION
  ]);

  if (selection === OPEN_CHAT_SETTINGS_ACTION) {
    await vscode.commands.executeCommand('workbench.action.openSettings', 'chat');
    return;
  }

  if (selection === SHOW_OUTPUT_ACTION) {
    await vscode.commands.executeCommand('workbench.action.output.toggleOutput');
  }
}

export async function showWorkspaceTrustGuidance(featureName: string): Promise<void> {
  const message =
    `DSLForge cannot run ${featureName} in Restricted Mode. ` +
    'Trust this workspace to allow validation commands and AI-backed grammar actions.';

  appendOutputDivider(`DSLForge Workspace Trust ${featureName}`);
  appendOutputLine(`trusted workspace: ${vscode.workspace.isTrusted}`);
  appendOutputLine(`message: ${message}`);
  showOutputChannel();

  const selection = await showMessageWithActions(message, [
    MANAGE_WORKSPACE_TRUST_ACTION,
    SHOW_OUTPUT_ACTION
  ]);

  if (selection === MANAGE_WORKSPACE_TRUST_ACTION) {
    await openWorkspaceTrustManagement();
    return;
  }

  if (selection === SHOW_OUTPUT_ACTION) {
    await vscode.commands.executeCommand('workbench.action.output.toggleOutput');
  }
}

export async function showMissingWorkspacePackageJsonGuidance(): Promise<void> {
  const message =
    'DSLForge could not open package.json in the workspace root. Confirm that the workspace root is correct, then retry.';

  appendOutputDivider('DSLForge package.json Guidance');
  appendOutputLine(`message: ${message}`);
  showOutputChannel();

  const selection = await showMessageWithActions(message, [SHOW_OUTPUT_ACTION]);

  if (selection === SHOW_OUTPUT_ACTION) {
    await vscode.commands.executeCommand('workbench.action.output.toggleOutput');
  }
}
