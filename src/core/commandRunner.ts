import { spawn } from 'node:child_process';
import type { ExecException } from 'node:child_process';
import { appendOutputLine } from './outputChannel';
import * as vscode from 'vscode';

export interface CommandExecutionResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  combinedOutput: string;
  signal: NodeJS.Signals | null;
  cancelled: boolean;
  outputTruncated: boolean;
  error?: string;
}

export interface CommandExecutionOptions {
  cwd: string;
  token?: vscode.CancellationToken;
  maxCapturedCharacters?: number;
}

function appendChunkLines(prefix: string, chunk: string): void {
  const normalized = chunk.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');

  for (const line of lines) {
    if (!line) {
      continue;
    }

    appendOutputLine(`${prefix}${line}`);
  }
}

function appendCappedOutput(
  existing: string,
  chunk: string,
  maxCapturedCharacters: number
): { value: string; truncated: boolean } {
  if (existing.length >= maxCapturedCharacters) {
    return {
      value: existing,
      truncated: true
    };
  }

  const remaining = maxCapturedCharacters - existing.length;
  const slice = chunk.slice(0, remaining);

  return {
    value: `${existing}${slice}`,
    truncated: slice.length < chunk.length
  };
}

export function runShellCommand(
  commandLine: string,
  options: CommandExecutionOptions
): Promise<CommandExecutionResult> {
  return new Promise((resolve, reject) => {
    const maxCapturedCharacters = options.maxCapturedCharacters ?? 250000;
    const child = spawn(commandLine, {
      cwd: options.cwd,
      env: process.env,
      shell: true
    });

    let stdout = '';
    let stderr = '';
    let outputTruncated = false;
    let cancelled = false;
    let resolved = false;
    let forceKillTimer: NodeJS.Timeout | undefined;

    const finish = (result: CommandExecutionResult): void => {
      if (resolved) {
        return;
      }

      resolved = true;
      if (forceKillTimer) {
        clearTimeout(forceKillTimer);
      }
      resolve(result);
    };

    const cancellationSubscription = options.token?.onCancellationRequested(() => {
      cancelled = true;
      appendOutputLine('[validation] cancellation requested');
      child.kill('SIGTERM');
      forceKillTimer = setTimeout(() => {
        if (!resolved) {
          appendOutputLine('[validation] process did not exit after SIGTERM, sending SIGKILL');
          child.kill('SIGKILL');
        }
      }, 2000);
    });

    child.stdout.on('data', (chunk: Buffer | string) => {
      const text = chunk.toString();
      const captured = appendCappedOutput(stdout, text, maxCapturedCharacters);
      stdout = captured.value;
      outputTruncated = outputTruncated || captured.truncated;
      appendChunkLines('[stdout] ', text);
    });

    child.stderr.on('data', (chunk: Buffer | string) => {
      const text = chunk.toString();
      const captured = appendCappedOutput(stderr, text, maxCapturedCharacters);
      stderr = captured.value;
      outputTruncated = outputTruncated || captured.truncated;
      appendChunkLines('[stderr] ', text);
    });

    child.on('error', (error: ExecException) => {
      cancellationSubscription?.dispose();
      finish({
        exitCode: null,
        stdout,
        stderr,
        combinedOutput: [stdout, stderr].filter(Boolean).join('\n'),
        signal: null,
        cancelled,
        outputTruncated,
        error: error.message
      });
    });

    child.on('close', (exitCode: number | null, signal: NodeJS.Signals | null) => {
      cancellationSubscription?.dispose();
      finish({
        exitCode,
        stdout,
        stderr,
        combinedOutput: [stdout, stderr].filter(Boolean).join('\n'),
        signal,
        cancelled,
        outputTruncated
      });
    });
  });
}
