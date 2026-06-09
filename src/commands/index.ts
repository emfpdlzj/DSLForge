import * as vscode from 'vscode';
import { createDslScaffold } from './createDslScaffold';
import { explainCurrentGrammar } from './explainCurrentGrammar';
import { generateSampleDsl } from './generateSampleDsl';
import { validateCurrentGrammar } from './validateCurrentGrammar';

export function registerCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(createDslScaffold());
  context.subscriptions.push(generateSampleDsl());
  context.subscriptions.push(validateCurrentGrammar());
  context.subscriptions.push(explainCurrentGrammar());
}
