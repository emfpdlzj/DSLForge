import * as vscode from 'vscode';
import { registerCommands } from './commands';

export function activate(context: vscode.ExtensionContext): void {
  console.log('LLM Grammer is now active.');
  registerCommands(context);
}

export function deactivate(): void {
  // Placeholder for future cleanup hooks.
}
