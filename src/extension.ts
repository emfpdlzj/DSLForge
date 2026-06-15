import * as vscode from 'vscode';
import { registerCommands } from './commands';
import { initializeAiCommandGate } from './core/aiCommandGate';
import { registerValidationActionCommands } from './core/validationActions';
import { registerValidationCodeActions } from './core/validationCodeActions';

export function activate(context: vscode.ExtensionContext): void {
  console.log('DSLForge is now active.');
  initializeAiCommandGate(context.languageModelAccessInformation);
  registerCommands(context);
  registerValidationActionCommands(context);
  registerValidationCodeActions(context);
}

export function deactivate(): void {
  // Placeholder for future cleanup hooks.
}
