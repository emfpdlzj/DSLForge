import * as path from 'node:path';
import type { AdapterValidationInterpretationInput } from '../core/adapter';
import {
  dedupeValidationIssues,
  parseValidationIssues
} from '../core/validationIssueParser';
import type { ValidationIssue } from '../types';

function normalizeFilePath(workspaceRoot: string, filePath: string): string {
  const unquotedPath = filePath.trim().replace(/^['"]|['"]$/g, '');

  if (path.isAbsolute(unquotedPath)) {
    return path.normalize(unquotedPath);
  }

  return path.normalize(path.resolve(workspaceRoot, unquotedPath));
}

function parseLocatedAntlr4Issues(
  input: AdapterValidationInterpretationInput
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const line of input.rawOutput.split(/\r?\n/)) {
    const trimmed = line.trim();
    const match =
      /^(?<severity>error|warning)\((?<code>\d+)\):\s+(?<file>.+?):(?<line>\d+):(?<column>\d+):\s*(?<message>.+)$/i.exec(
        trimmed
      );

    if (!match?.groups) {
      continue;
    }

    issues.push({
      filePath: normalizeFilePath(
        input.project.context.workspaceRoot,
        match.groups.file
      ),
      line: Number.parseInt(match.groups.line, 10),
      column: Number.parseInt(match.groups.column, 10),
      severity: match.groups.severity.toLowerCase() === 'warning' ? 'warning' : 'error',
      code: `ANTLR${match.groups.code}`,
      message: match.groups.message.trim(),
      source: 'ANTLR4'
    });
  }

  return issues;
}

function parseActiveFileAntlr4Issues(
  input: AdapterValidationInterpretationInput
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const activeGrammarFile = input.context.activeGrammarFile;

  if (!activeGrammarFile) {
    return issues;
  }

  for (const line of input.rawOutput.split(/\r?\n/)) {
    const trimmed = line.trim();
    const match =
      /^line\s+(?<line>\d+):(?<column>\d+)\s+(?<message>.+)$/i.exec(trimmed);

    if (!match?.groups) {
      continue;
    }

    const loweredMessage = match.groups.message.toLowerCase();

    issues.push({
      filePath: activeGrammarFile,
      line: Number.parseInt(match.groups.line, 10) + 1,
      column: Number.parseInt(match.groups.column, 10) + 1,
      severity: loweredMessage.includes('warning') ? 'warning' : 'error',
      message: match.groups.message.trim(),
      source: 'ANTLR4'
    });
  }

  return issues;
}

function filterDuplicateUnlocatedIssues(
  baselineIssues: ValidationIssue[],
  candidateIssues: ValidationIssue[]
): ValidationIssue[] {
  const baselineKeys = new Set(
    baselineIssues.map((issue) =>
      [
        issue.filePath ?? '',
        issue.line ?? '',
        issue.column ?? '',
        issue.severity,
        issue.message.trim().toLowerCase()
      ].join('::')
    )
  );
  const baselineHints = baselineIssues
    .filter((issue) => issue.filePath && issue.line && issue.column)
    .map((issue) => ({
      filePath: issue.filePath!.toLowerCase(),
      relativeFilePath: path
        .relative(process.cwd(), issue.filePath!)
        .replace(/\\/g, '/')
        .toLowerCase(),
      line: String(issue.line),
      column: String(issue.column),
      message: issue.message.trim().toLowerCase()
    }));

  return candidateIssues.filter((issue) => {
    const key = [
      issue.filePath ?? '',
      issue.line ?? '',
      issue.column ?? '',
      issue.severity,
      issue.message.trim().toLowerCase()
    ].join('::');

    if (baselineKeys.has(key)) {
      return false;
    }

    if (issue.filePath) {
      return true;
    }

    const normalizedMessage = issue.message.trim().toLowerCase();
    const duplicatesLocatedIssue = baselineHints.some((hint) => {
      return (
        normalizedMessage.includes(hint.message) &&
        (normalizedMessage.includes(`${hint.relativeFilePath}:${hint.line}:${hint.column}`) ||
          normalizedMessage.includes(`${path.basename(hint.filePath)}:${hint.line}:${hint.column}`))
      );
    });

    if (duplicatesLocatedIssue) {
      return false;
    }

    return true;
  });
}

export function interpretAntlr4ValidationOutput(
  input: AdapterValidationInterpretationInput
): ValidationIssue[] {
  const locatedIssues = parseLocatedAntlr4Issues(input);
  const activeFileIssues = parseActiveFileAntlr4Issues(input);
  const genericIssues = filterDuplicateUnlocatedIssues(
    [...locatedIssues, ...activeFileIssues],
    parseValidationIssues(input.rawOutput, {
      workspaceRoot: input.project.context.workspaceRoot,
      defaultSource: 'ANTLR4'
    })
  );

  return dedupeValidationIssues([
    ...locatedIssues,
    ...activeFileIssues,
    ...genericIssues
  ]);
}
