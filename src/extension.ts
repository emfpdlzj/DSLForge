import * as vscode from 'vscode';
import { registerCommands } from './commands';
import { registerValidationActionCommands } from './core/validationActions';
import { registerValidationCodeActions } from './core/validationCodeActions';

export function activate(context: vscode.ExtensionContext): void {
  console.log('DSLForge is now active.');
  registerCommands(context);
  registerValidationActionCommands(context);
  registerValidationCodeActions(context);
}

export function deactivate(): void {
  // Placeholder for future cleanup hooks.
}
