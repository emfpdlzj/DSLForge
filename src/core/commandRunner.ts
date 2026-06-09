import { spawn } from 'node:child_process';
import type { ExecException } from 'node:child_process';
import { appendOutputLine } from './outputChannel';

export interface CommandExecutionResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  combinedOutput: string;
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

export function runShellCommand(
  commandLine: string,
  cwd: string
): Promise<CommandExecutionResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(commandLine, {
      cwd,
      env: process.env,
      shell: true
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer | string) => {
      const text = chunk.toString();
      stdout += text;
      appendChunkLines('[stdout] ', text);
    });

    child.stderr.on('data', (chunk: Buffer | string) => {
      const text = chunk.toString();
      stderr += text;
      appendChunkLines('[stderr] ', text);
    });

    child.on('error', (error: ExecException) => {
      reject(error);
    });

    child.on('close', (exitCode: number | null) => {
      resolve({
        exitCode,
        stdout,
        stderr,
        combinedOutput: [stdout, stderr].filter(Boolean).join('\n')
      });
    });
  });
}
