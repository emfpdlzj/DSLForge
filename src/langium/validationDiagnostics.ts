import * as path from 'node:path';
import type { AdapterValidationInterpretationInput } from '../core/adapter';
import {
  dedupeValidationIssues,
  parseValidationIssues
} from '../core/validationDiagnostics';
import type { ValidationIssue } from '../types';

interface PendingWebpackIssue {
  filePath: string;
  line?: number;
  column?: number;
  endColumn?: number;
  severity: ValidationIssue['severity'];
}

function normalizeFilePath(workspaceRoot: string, filePath: string): string {
  const unquotedPath = filePath.trim().replace(/^['"]|['"]$/g, '');

  if (path.isAbsolute(unquotedPath)) {
    return path.normalize(unquotedPath);
  }

  return path.normalize(path.resolve(workspaceRoot, unquotedPath));
}

function parseWebpackTslIssues(
  input: AdapterValidationInterpretationInput
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const lines = input.rawOutput.split(/\r?\n/);
  let pendingIssue: PendingWebpackIssue | undefined;

  for (const line of lines) {
    const trimmed = line.trim();

    const headerMatch =
      /^(?<severity>ERROR|WARNING)\s+in\s+(?<file>.+)$/i.exec(trimmed);

    if (headerMatch?.groups) {
      pendingIssue = {
        filePath: normalizeFilePath(
          input.project.context.workspaceRoot,
          headerMatch.groups.file
        ),
        severity:
          headerMatch.groups.severity.toLowerCase() === 'warning'
            ? 'warning'
            : 'error'
      };
      continue;
    }

    const rangeMatch = /^(?<line>\d+):(?<column>\d+)-(?<endColumn>\d+)$/i.exec(
      trimmed
    );

    if (rangeMatch?.groups && pendingIssue) {
      pendingIssue = {
        ...pendingIssue,
        line: Number.parseInt(rangeMatch.groups.line, 10),
        column: Number.parseInt(rangeMatch.groups.column, 10),
        endColumn: Number.parseInt(rangeMatch.groups.endColumn, 10)
      };
      continue;
    }

    const tslMatch =
      /^\[tsl\]\s+(?<severity>ERROR|WARNING)\s+in\s+(?<file>.+)\((?<line>\d+),(?<column>\d+)\)$/i.exec(
        trimmed
      );

    if (tslMatch?.groups) {
      pendingIssue = {
        filePath: normalizeFilePath(
          input.project.context.workspaceRoot,
          tslMatch.groups.file
        ),
        line: Number.parseInt(tslMatch.groups.line, 10),
        column: Number.parseInt(tslMatch.groups.column, 10),
        severity:
          tslMatch.groups.severity.toLowerCase() === 'warning'
            ? 'warning'
            : 'error'
      };
      continue;
    }

    const codeMessageMatch = /^(?<code>[A-Z]+\d+):\s+(?<message>.+)$/i.exec(trimmed);

    if (codeMessageMatch?.groups && pendingIssue?.line && pendingIssue.column) {
      issues.push({
        filePath: pendingIssue.filePath,
        line: pendingIssue.line,
        column: pendingIssue.column,
        endColumn: pendingIssue.endColumn,
        severity: pendingIssue.severity,
        code: codeMessageMatch.groups.code,
        message: codeMessageMatch.groups.message.trim()
      });
      pendingIssue = undefined;
    }
  }

  return issues;
}

export function interpretLangiumValidationOutput(
  input: AdapterValidationInterpretationInput
): ValidationIssue[] {
  const genericIssues = parseValidationIssues(input.rawOutput, {
    workspaceRoot: input.project.context.workspaceRoot
  });
  const webpackIssues = parseWebpackTslIssues(input);

  return dedupeValidationIssues([...webpackIssues, ...genericIssues]);
}
