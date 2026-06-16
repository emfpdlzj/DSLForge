import * as vscode from 'vscode';
import { registerAiPreviewApplyCommands } from './core/aiPreviewApplyService';
import { registerCommands } from './commands';
import { initializeAiCommandGate } from './core/aiCommandGate';
import { initializeTelemetry } from './core/telemetry';
import { registerValidationActionCommands } from './core/validationActions';
import { registerValidationCodeActions } from './core/validationCodeActions';

export function activate(context: vscode.ExtensionContext): void {
  console.log('DSLForge is now active.');
  context.subscriptions.push(initializeTelemetry(context));
  initializeAiCommandGate(context.languageModelAccessInformation);
  registerCommands(context);
  registerAiPreviewApplyCommands(context);
  registerValidationActionCommands(context);
  registerValidationCodeActions(context);
}

export function deactivate(): void {
  // Placeholder for future cleanup hooks.
}
