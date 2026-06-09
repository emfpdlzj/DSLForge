import * as path from 'node:path';
import * as vscode from 'vscode';
import type { ValidationIssue } from '../types';

const diagnosticCollection = vscode.languages.createDiagnosticCollection('dslforge');

export interface ParseValidationIssuesOptions {
  workspaceRoot?: string;
}

interface LineIssueMatch {
  file: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  severity: ValidationIssue['severity'];
  code?: string;
  message: string;
}

type IssueLineParser = (line: string) => LineIssueMatch | undefined;

const lineParsers: IssueLineParser[] = [
  (line) => {
    const match =
      /^(?<file>.+)\((?<line>\d+),(?<column>\d+)\):\s*(?<severity>error|warning|info)\s*(?<code>[A-Z]+\d+)?:?\s*(?<message>.+)$/i.exec(
        line
      );

    if (!match?.groups) {
      return undefined;
    }

    return {
      file: match.groups.file,
      line: Number.parseInt(match.groups.line, 10),
      column: Number.parseInt(match.groups.column, 10),
      severity: normalizeIssueSeverity(match.groups.severity),
      code: match.groups.code,
      message: match.groups.message.trim()
    };
  },
  (line) => {
    const match =
      /^(?<file>.+?):(?<line>\d+):(?<column>\d+)(?::(?<endColumn>\d+))?\s*[-:]?\s*(?<severity>error|warning|info)\s*(?<code>[A-Z]+\d+)?:?\s*(?<message>.+)$/i.exec(
        line
      );

    if (!match?.groups) {
      return undefined;
    }

    return {
      file: match.groups.file,
      line: Number.parseInt(match.groups.line, 10),
      column: Number.parseInt(match.groups.column, 10),
      endColumn: match.groups.endColumn
        ? Number.parseInt(match.groups.endColumn, 10)
        : undefined,
      severity: normalizeIssueSeverity(match.groups.severity),
      code: match.groups.code,
      message: match.groups.message.trim()
    };
  },
  (line) => {
    const match =
      /^(?<file>.+?):(?<line>\d+):(?<column>\d+)\s+(?<message>.+)$/i.exec(line);

    if (!match?.groups) {
      return undefined;
    }

    const lowerMessage = match.groups.message.toLowerCase();

    return {
      file: match.groups.file,
      line: Number.parseInt(match.groups.line, 10),
      column: Number.parseInt(match.groups.column, 10),
      severity: lowerMessage.includes('warning') ? 'warning' : 'error',
      message: match.groups.message.trim()
    };
  }
];

function toSeverity(rawSeverity: string | undefined): vscode.DiagnosticSeverity {
  switch ((rawSeverity ?? '').toLowerCase()) {
    case 'warning':
      return vscode.DiagnosticSeverity.Warning;
    case 'info':
      return vscode.DiagnosticSeverity.Information;
    case 'error':
    default:
      return vscode.DiagnosticSeverity.Error;
  }
}

function normalizeIssueSeverity(rawSeverity: string | undefined): ValidationIssue['severity'] {
  switch ((rawSeverity ?? '').toLowerCase()) {
    case 'warning':
      return 'warning';
    case 'info':
      return 'info';
    case 'error':
    default:
      return 'error';
  }
}

function normalizeFilePath(
  rawFilePath: string,
  workspaceRoot: string | undefined
): string {
  const unquotedPath = rawFilePath.trim().replace(/^['"]|['"]$/g, '');

  if (path.isAbsolute(unquotedPath) || !workspaceRoot) {
    return path.normalize(unquotedPath);
  }

  return path.normalize(path.resolve(workspaceRoot, unquotedPath));
}

function toValidationIssue(
  match: LineIssueMatch,
  options: ParseValidationIssuesOptions
): ValidationIssue | undefined {
  if (!Number.isFinite(match.line) || !Number.isFinite(match.column)) {
    return undefined;
  }

  return {
    filePath: normalizeFilePath(match.file, options.workspaceRoot),
    line: match.line,
    column: match.column,
    endLine: match.endLine,
    endColumn: match.endColumn,
    severity: match.severity,
    code: match.code,
    message: match.message
  };
}

function parseIssue(
  line: string,
  options: ParseValidationIssuesOptions
): ValidationIssue | undefined {
  for (const parser of lineParsers) {
    const match = parser(line.trim());

    if (match) {
      return toValidationIssue(match, options);
    }
  }

  return undefined;
}

export function parseValidationIssues(
  rawOutput: string,
  options: ParseValidationIssuesOptions = {}
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const line of rawOutput.split(/\r?\n/)) {
    const issue = parseIssue(line, options);

    if (issue) {
      issues.push(issue);
    }
  }

  return issues;
}

export function dedupeValidationIssues(issues: ValidationIssue[]): ValidationIssue[] {
  const seen = new Set<string>();
  const uniqueIssues: ValidationIssue[] = [];

  for (const issue of issues) {
    const key = [
      issue.filePath ?? '',
      issue.line ?? '',
      issue.column ?? '',
      issue.endLine ?? '',
      issue.endColumn ?? '',
      issue.severity,
      issue.code ?? '',
      issue.message
    ].join('::');

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    uniqueIssues.push(issue);
  }

  return uniqueIssues;
}

export function publishValidationIssues(issues: ValidationIssue[]): void {
  diagnosticCollection.clear();

  const diagnosticsByFile = new Map<string, vscode.Diagnostic[]>();

  for (const issue of issues) {
    if (!issue.filePath || !issue.line || !issue.column) {
      continue;
    }

    const startLine = Math.max(issue.line - 1, 0);
    const startColumn = Math.max(issue.column - 1, 0);
    const endLine = Math.max((issue.endLine ?? issue.line) - 1, 0);
    const endColumn = Math.max(
      issue.endColumn ?? issue.column,
      startColumn + 1
    );

    const diagnostic = new vscode.Diagnostic(
      new vscode.Range(startLine, startColumn, endLine, endColumn),
      issue.message,
      toSeverity(issue.severity)
    );

    if (issue.code) {
      diagnostic.code = issue.code;
    }

    diagnostic.source = 'DSLForge';

    const existing = diagnosticsByFile.get(issue.filePath) ?? [];
    existing.push(diagnostic);
    diagnosticsByFile.set(issue.filePath, existing);
  }

  for (const [filePath, diagnostics] of diagnosticsByFile) {
    diagnosticCollection.set(vscode.Uri.file(filePath), diagnostics);
  }
}
