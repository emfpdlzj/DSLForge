import * as path from 'node:path';
import type { AdapterValidationInterpretationInput } from '../core/adapter';
import { dedupeValidationIssues, parseValidationIssues } from '../core/validationIssueParser';
import type { ValidationIssue } from '../types';

function normalizeFilePath(workspaceRoot: string, filePath: string): string {
  const unquotedPath = filePath.trim().replace(/^['"]|['"]$/g, '');

  if (path.isAbsolute(unquotedPath)) {
    return path.normalize(unquotedPath);
  }

  return path.normalize(path.resolve(workspaceRoot, unquotedPath));
}

function parseLocatedXtextIssues(input: AdapterValidationInterpretationInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const line of input.rawOutput.split(/\r?\n/)) {
    const trimmed = line.trim();
    const match =
      /^(?<severity>error|warning):\s+(?<file>.+?):(?<line>\d+):(?<column>\d+)\s*[:-]?\s*(?<message>.+)$/i.exec(
        trimmed
      );

    if (!match?.groups) {
      continue;
    }

    issues.push({
      filePath: normalizeFilePath(input.project.context.workspaceRoot, match.groups.file),
      line: Number.parseInt(match.groups.line, 10),
      column: Number.parseInt(match.groups.column, 10) + 1,
      severity: match.groups.severity.toLowerCase() === 'warning' ? 'warning' : 'error',
      message: match.groups.message.trim(),
      source: 'Xtext'
    });
  }

  return issues;
}

function parseActiveGrammarLineIssues(
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
      /^(?:(?<severity>error|warning):\s+)?line\s+(?<line>\d+):(?<column>\d+)\s+(?<message>.+)$/i.exec(
        trimmed
      );

    if (!match?.groups) {
      continue;
    }

    const normalizedMessage = match.groups.message.trim();
    const loweredMessage = normalizedMessage.toLowerCase();

    issues.push({
      filePath: activeGrammarFile,
      line: Number.parseInt(match.groups.line, 10),
      column: Number.parseInt(match.groups.column, 10) + 1,
      severity:
        match.groups.severity?.toLowerCase() === 'warning' || loweredMessage.includes('warning')
          ? 'warning'
          : 'error',
      message: normalizedMessage,
      source: 'Xtext'
    });
  }

  return issues;
}

function parseFrameworkIssues(input: AdapterValidationInterpretationInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const line of input.rawOutput.split(/\r?\n/)) {
    const trimmed = line.trim();

    const ePackageIssue =
      /^(?<severity>error|warning):\s+(?<message>(?:Couldn't resolve reference to EPackage|The EPackage registry could not resolve|Imported namespace URI).+)$/i.exec(
        trimmed
      );

    if (ePackageIssue?.groups) {
      issues.push({
        severity: ePackageIssue.groups.severity.toLowerCase() === 'warning' ? 'warning' : 'error',
        message: ePackageIssue.groups.message.trim(),
        source: 'Xtext'
      });
      continue;
    }

    const generatorIssue =
      /^(?<severity>error|warning):\s+(?<message>(?:Resource contains errors|Xtext generator failed|Failed to load MWE2 workflow).+)$/i.exec(
        trimmed
      );

    if (generatorIssue?.groups) {
      issues.push({
        severity: generatorIssue.groups.severity.toLowerCase() === 'warning' ? 'warning' : 'error',
        message: generatorIssue.groups.message.trim(),
        source: 'Xtext'
      });
    }
  }

  return issues;
}

function filterDuplicateUnlocatedIssues(
  baselineIssues: ValidationIssue[],
  candidateIssues: ValidationIssue[]
): ValidationIssue[] {
  const locatedMessages = new Set(
    baselineIssues
      .filter((issue) => issue.filePath && issue.line && issue.column)
      .map((issue) => issue.message.trim().toLowerCase())
  );
  const unlocatedMessages = new Set(
    baselineIssues
      .filter((issue) => !issue.filePath)
      .map((issue) => issue.message.trim().toLowerCase())
  );

  return candidateIssues.filter((issue) => {
    const normalizedMessage = issue.message.trim().toLowerCase();

    if (!issue.filePath && unlocatedMessages.has(normalizedMessage)) {
      return false;
    }

    if (issue.filePath && locatedMessages.has(normalizedMessage)) {
      return false;
    }

    return true;
  });
}

export function interpretXtextValidationOutput(
  input: AdapterValidationInterpretationInput
): ValidationIssue[] {
  const locatedIssues = parseLocatedXtextIssues(input);
  const activeGrammarIssues = parseActiveGrammarLineIssues(input);
  const frameworkIssues = parseFrameworkIssues(input);
  const genericIssues = filterDuplicateUnlocatedIssues(
    [...locatedIssues, ...activeGrammarIssues, ...frameworkIssues],
    parseValidationIssues(input.rawOutput, {
      workspaceRoot: input.project.context.workspaceRoot,
      defaultSource: 'Xtext'
    })
  );

  return dedupeValidationIssues([
    ...locatedIssues,
    ...activeGrammarIssues,
    ...frameworkIssues,
    ...genericIssues
  ]);
}
