import * as path from 'node:path';
import type { AdapterValidationInterpretationInput } from '../core/adapter';
import { dedupeValidationIssues, parseValidationIssues } from '../core/validationIssueParser';
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

function parseWebpackTslIssues(input: AdapterValidationInterpretationInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const lines = input.rawOutput.split(/\r?\n/);
  let pendingIssue: PendingWebpackIssue | undefined;

  for (const line of lines) {
    const trimmed = line.trim();

    const headerMatch = /^(?<severity>ERROR|WARNING)\s+in\s+(?<file>.+)$/i.exec(trimmed);

    if (headerMatch?.groups) {
      pendingIssue = {
        filePath: normalizeFilePath(input.project.context.workspaceRoot, headerMatch.groups.file),
        severity: headerMatch.groups.severity.toLowerCase() === 'warning' ? 'warning' : 'error'
      };
      continue;
    }

    const rangeMatch = /^(?<line>\d+):(?<column>\d+)-(?<endColumn>\d+)$/i.exec(trimmed);

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
        filePath: normalizeFilePath(input.project.context.workspaceRoot, tslMatch.groups.file),
        line: Number.parseInt(tslMatch.groups.line, 10),
        column: Number.parseInt(tslMatch.groups.column, 10),
        severity: tslMatch.groups.severity.toLowerCase() === 'warning' ? 'warning' : 'error'
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
        message: codeMessageMatch.groups.message.trim(),
        source: 'TypeScript'
      });
      pendingIssue = undefined;
    }
  }

  return issues;
}

function parseLangiumFrameworkIssues(
  input: AdapterValidationInterpretationInput
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const line of input.rawOutput.split(/\r?\n/)) {
    const trimmed = line.trim();

    const generatorFailureMatch =
      /^(?<severity>Error|Warning):\s+(?<message>Failed to (?:load|read|generate).+)$/i.exec(
        trimmed
      );

    if (generatorFailureMatch?.groups) {
      issues.push({
        severity:
          generatorFailureMatch.groups.severity.toLowerCase() === 'warning' ? 'warning' : 'error',
        message: generatorFailureMatch.groups.message.trim(),
        source: 'Langium'
      });
      continue;
    }

    const referenceFailureMatch = /^Error:\s+(?<message>Could not resolve reference to.+)$/i.exec(
      trimmed
    );

    if (referenceFailureMatch?.groups) {
      issues.push({
        severity: 'error',
        message: referenceFailureMatch.groups.message.trim(),
        source: 'Langium'
      });
      continue;
    }

    const configFailureMatch =
      /^(?<severity>Error|Warning):\s+(?<message>.+langium-config\.json.+)$/i.exec(trimmed);

    if (configFailureMatch?.groups) {
      issues.push({
        severity:
          configFailureMatch.groups.severity.toLowerCase() === 'warning' ? 'warning' : 'error',
        message: configFailureMatch.groups.message.trim(),
        source: 'Langium'
      });
    }
  }

  return issues;
}

function filterDuplicateUnlocatedIssues(
  baselineIssues: ValidationIssue[],
  candidateIssues: ValidationIssue[]
): ValidationIssue[] {
  const locatedKeys = new Set(
    baselineIssues
      .filter((issue) => issue.filePath && issue.line && issue.column)
      .map((issue) =>
        [
          issue.severity,
          issue.source ?? '',
          (issue.code ?? '').toUpperCase(),
          issue.message.trim().toLowerCase()
        ].join('::')
      )
  );

  return candidateIssues.filter((issue) => {
    if (issue.filePath || !issue.code) {
      return true;
    }

    const key = [
      issue.severity,
      issue.source ?? '',
      issue.code.toUpperCase(),
      issue.message.trim().toLowerCase()
    ].join('::');

    return !locatedKeys.has(key);
  });
}

export function interpretLangiumValidationOutput(
  input: AdapterValidationInterpretationInput
): ValidationIssue[] {
  const webpackIssues = parseWebpackTslIssues(input);
  const frameworkIssues = parseLangiumFrameworkIssues(input);
  const genericIssues = filterDuplicateUnlocatedIssues(
    webpackIssues,
    parseValidationIssues(input.rawOutput, {
      workspaceRoot: input.project.context.workspaceRoot,
      defaultSource: 'Langium'
    })
  );

  return dedupeValidationIssues([...webpackIssues, ...frameworkIssues, ...genericIssues]);
}
