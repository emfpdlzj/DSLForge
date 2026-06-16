import * as vscode from 'vscode';
import type { ValidationIssue } from '../types';
import { parseValidationIssues, dedupeValidationIssues } from './validationIssueParser';

export { parseValidationIssues, dedupeValidationIssues } from './validationIssueParser';

const diagnosticCollection = vscode.languages.createDiagnosticCollection('dslforge');

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
    const endColumn = Math.max(issue.endColumn ?? issue.column, startColumn + 1);

    const diagnostic = new vscode.Diagnostic(
      new vscode.Range(startLine, startColumn, endLine, endColumn),
      issue.message,
      toSeverity(issue.severity)
    );

    if (issue.code) {
      diagnostic.code = issue.code;
    }

    diagnostic.source = issue.source ?? 'DSLForge';

    const existing = diagnosticsByFile.get(issue.filePath) ?? [];
    existing.push(diagnostic);
    diagnosticsByFile.set(issue.filePath, existing);
  }

  for (const [filePath, diagnostics] of diagnosticsByFile) {
    diagnosticCollection.set(vscode.Uri.file(filePath), diagnostics);
  }
}
