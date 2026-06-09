import * as vscode from 'vscode';
import type { ValidationIssue } from '../types';

const diagnosticCollection = vscode.languages.createDiagnosticCollection('dslforge');

const diagnosticPattern =
  /^(?<file>.+?)(?::|\()(?<line>\d+)(?:[:,](?<column>\d+))?\)?(?::?\s+|-?\s*)(?<severity>error|warning|info)?\s*(?<message>.+)$/i;

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

function parseIssue(line: string): ValidationIssue | undefined {
  const match = diagnosticPattern.exec(line.trim());

  if (!match?.groups) {
    return undefined;
  }

  const lineNumber = Number.parseInt(match.groups.line, 10);
  const columnNumber = match.groups.column
    ? Number.parseInt(match.groups.column, 10)
    : 1;

  if (!Number.isFinite(lineNumber) || !Number.isFinite(columnNumber)) {
    return undefined;
  }

  return {
    filePath: match.groups.file,
    line: lineNumber,
    column: columnNumber,
    severity: (match.groups.severity?.toLowerCase() as ValidationIssue['severity']) ?? 'error',
    message: match.groups.message.trim()
  };
}

export function parseValidationIssues(rawOutput: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const line of rawOutput.split(/\r?\n/)) {
    const issue = parseIssue(line);

    if (issue) {
      issues.push(issue);
    }
  }

  return issues;
}

export function publishValidationIssues(issues: ValidationIssue[]): void {
  diagnosticCollection.clear();

  const diagnosticsByFile = new Map<string, vscode.Diagnostic[]>();

  for (const issue of issues) {
    if (!issue.filePath || !issue.line || !issue.column) {
      continue;
    }

    const diagnostic = new vscode.Diagnostic(
      new vscode.Range(
        Math.max(issue.line - 1, 0),
        Math.max(issue.column - 1, 0),
        Math.max(issue.line - 1, 0),
        Math.max(issue.column, 1)
      ),
      issue.message,
      toSeverity(issue.severity)
    );

    const existing = diagnosticsByFile.get(issue.filePath) ?? [];
    existing.push(diagnostic);
    diagnosticsByFile.set(issue.filePath, existing);
  }

  for (const [filePath, diagnostics] of diagnosticsByFile) {
    diagnosticCollection.set(vscode.Uri.file(filePath), diagnostics);
  }
}
