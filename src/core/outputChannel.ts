import * as vscode from 'vscode';

const OUTPUT_CHANNEL_NAME = 'DSLForge';
const OUTPUT_DIVIDER = '============================================================';

let outputChannel: vscode.OutputChannel | undefined;

export function getOutputChannel(): vscode.OutputChannel {
  outputChannel ??= vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
  return outputChannel;
}

export function appendOutputLine(message: string): void {
  getOutputChannel().appendLine(message);
}

export function appendOutputDivider(label?: string): void {
  if (label) {
    appendOutputLine(`${OUTPUT_DIVIDER}`);
    appendOutputLine(label);
    appendOutputLine(`${OUTPUT_DIVIDER}`);
    return;
  }

  appendOutputLine(OUTPUT_DIVIDER);
}

export function showOutputChannel(preserveFocus = true): void {
  getOutputChannel().show(preserveFocus);
}
