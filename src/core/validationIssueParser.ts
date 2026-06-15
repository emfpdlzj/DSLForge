import * as path from 'node:path';
import type { ValidationIssue } from '../types';

export interface ParseValidationIssuesOptions {
  workspaceRoot?: string;
  defaultSource?: string;
}

interface LineIssueMatch {
  file?: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  severity: ValidationIssue['severity'];
  code?: string;
  message: string;
  source?: string;
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
      message: match.groups.message,
      source: inferSource(match.groups.code)
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
      message: match.groups.message,
      source: inferSource(match.groups.code)
    };
  },
  (line) => {
    const match =
      /^(?<file>.+?):(?<line>\d+):(?<column>\d+):\s*(?<severity>error|warning|info)\s+(?<message>.+)$/i.exec(
        line
      );

    if (!match?.groups) {
      return undefined;
    }

    const { code, message } = extractCodeFromMessage(match.groups.message);

    return {
      file: match.groups.file,
      line: Number.parseInt(match.groups.line, 10),
      column: Number.parseInt(match.groups.column, 10),
      severity: normalizeIssueSeverity(match.groups.severity),
      code,
      message,
      source: inferSource(code)
    };
  },
  (line) => {
    const match =
      /^(?<severity>error|warning|info)\s+(?<file>.+?):(?<line>\d+):(?<column>\d+):\s*(?<message>.+)$/i.exec(
        line
      );

    if (!match?.groups) {
      return undefined;
    }

    const { code, message } = extractCodeFromMessage(match.groups.message);

    return {
      file: match.groups.file,
      line: Number.parseInt(match.groups.line, 10),
      column: Number.parseInt(match.groups.column, 10),
      severity: normalizeIssueSeverity(match.groups.severity),
      code,
      message,
      source: inferSource(code)
    };
  },
  (line) => {
    const match =
      /^(?<file>.+?):(?<line>\d+):(?<column>\d+)\s+(?<message>.+)$/i.exec(line);

    if (!match?.groups) {
      return undefined;
    }

    const lowerMessage = match.groups.message.toLowerCase();
    const { code, message } = extractCodeFromMessage(match.groups.message);

    return {
      file: match.groups.file,
      line: Number.parseInt(match.groups.line, 10),
      column: Number.parseInt(match.groups.column, 10),
      severity: lowerMessage.includes('warning') ? 'warning' : 'error',
      code,
      message,
      source: inferSource(code)
    };
  },
  (line) => {
    const match =
      /^(?<severity>error|warning|info)\s*(?<code>[A-Z]+\d+)?:?\s*(?<message>.+)$/i.exec(
        line
      );

    if (!match?.groups) {
      return undefined;
    }

    return {
      severity: normalizeIssueSeverity(match.groups.severity),
      code: match.groups.code,
      message: match.groups.message,
      source: inferSource(match.groups.code)
    };
  },
  (line) => {
    const match = /^(?<code>[A-Z]+\d+):\s*(?<message>.+)$/i.exec(line);

    if (!match?.groups) {
      return undefined;
    }

    return {
      severity: inferSeverityFromMessage(match.groups.message),
      code: match.groups.code,
      message: match.groups.message,
      source: inferSource(match.groups.code)
    };
  },
  (line) => {
    const match =
      /^(?<severity>Error|Warning|Info):\s*(?<message>.+)$/i.exec(line);

    if (!match?.groups) {
      return undefined;
    }

    const { code, message } = extractCodeFromMessage(match.groups.message);

    return {
      severity: normalizeIssueSeverity(match.groups.severity),
      code,
      message,
      source: inferSource(code)
    };
  }
];

function normalizeIssueSeverity(
  rawSeverity: string | undefined
): ValidationIssue['severity'] {
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

function inferSeverityFromMessage(message: string): ValidationIssue['severity'] {
  const normalized = message.toLowerCase();

  if (normalized.includes('warning')) {
    return 'warning';
  }

  if (normalized.includes('info')) {
    return 'info';
  }

  return 'error';
}

function inferSource(code: string | undefined): string | undefined {
  if (!code) {
    return undefined;
  }

  if (code.startsWith('TS')) {
    return 'TypeScript';
  }

  return 'DSLForge';
}

function extractCodeFromMessage(message: string): {
  code?: string;
  message: string;
} {
  const trimmed = message.trim();
  const codeMatch = /^(?<code>[A-Z]+\d+):?\s+(?<rest>.+)$/i.exec(trimmed);

  if (!codeMatch?.groups) {
    return {
      message: trimmed
    };
  }

  return {
    code: codeMatch.groups.code,
    message: codeMatch.groups.rest.trim()
  };
}

function normalizeWhitespace(message: string): string {
  return message.replace(/\s+/g, ' ').trim();
}

export function normalizeValidationMessage(message: string): string {
  let normalized = normalizeWhitespace(message);
  normalized = normalized.replace(/^\[tsl\]\s*/i, '');
  normalized = normalized.replace(/^(error|warning|info):\s*/i, '');
  return normalized.trim();
}

function normalizeFilePath(
  rawFilePath: string,
  workspaceRoot: string | undefined
): string {
  const unquotedPath = rawFilePath
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/^\.\//, '');

  if (path.isAbsolute(unquotedPath) || !workspaceRoot) {
    return path.normalize(unquotedPath);
  }

  return path.normalize(path.resolve(workspaceRoot, unquotedPath));
}

function toValidationIssue(
  match: LineIssueMatch,
  options: ParseValidationIssuesOptions
): ValidationIssue | undefined {
  const hasLocation =
    typeof match.line !== 'undefined' && typeof match.column !== 'undefined';

  if (
    hasLocation &&
    (!Number.isFinite(match.line) || !Number.isFinite(match.column))
  ) {
    return undefined;
  }

  const normalized = extractCodeFromMessage(
    normalizeValidationMessage(match.message)
  );

  return {
    filePath:
      match.file ? normalizeFilePath(match.file, options.workspaceRoot) : undefined,
    line: match.line,
    column: match.column,
    endLine: match.endLine,
    endColumn: match.endColumn,
    severity: match.severity,
    code: match.code ?? normalized.code,
    message: normalized.message,
    source: match.source ?? options.defaultSource
  };
}

function parseIssue(
  line: string,
  options: ParseValidationIssuesOptions
): ValidationIssue | undefined {
  const trimmed = line.trim();

  if (!trimmed) {
    return undefined;
  }

  if (/^(error|warning)\s+in\s+.+$/i.test(trimmed)) {
    return undefined;
  }

  for (const parser of lineParsers) {
    const match = parser(trimmed);

    if (match) {
      return toValidationIssue(match, options);
    }
  }

  return undefined;
}

function sortValidationIssues(issues: ValidationIssue[]): ValidationIssue[] {
  return [...issues].sort((left, right) => {
    const leftLocated = left.filePath && left.line && left.column ? 0 : 1;
    const rightLocated = right.filePath && right.line && right.column ? 0 : 1;

    if (leftLocated !== rightLocated) {
      return leftLocated - rightLocated;
    }

    const leftSeverity = left.severity === 'error' ? 0 : left.severity === 'warning' ? 1 : 2;
    const rightSeverity =
      right.severity === 'error' ? 0 : right.severity === 'warning' ? 1 : 2;

    if (leftSeverity !== rightSeverity) {
      return leftSeverity - rightSeverity;
    }

    const leftFile = (left.filePath ?? '').toLowerCase();
    const rightFile = (right.filePath ?? '').toLowerCase();

    if (leftFile !== rightFile) {
      return leftFile.localeCompare(rightFile);
    }

    if ((left.line ?? 0) !== (right.line ?? 0)) {
      return (left.line ?? 0) - (right.line ?? 0);
    }

    if ((left.column ?? 0) !== (right.column ?? 0)) {
      return (left.column ?? 0) - (right.column ?? 0);
    }

    return left.message.localeCompare(right.message);
  });
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

  return sortValidationIssues(issues);
}

export function dedupeValidationIssues(issues: ValidationIssue[]): ValidationIssue[] {
  const seen = new Set<string>();
  const uniqueIssues: ValidationIssue[] = [];

  for (const issue of sortValidationIssues(issues)) {
    const key = [
      (issue.filePath ?? '').toLowerCase(),
      issue.line ?? '',
      issue.column ?? '',
      issue.endLine ?? '',
      issue.endColumn ?? '',
      issue.severity,
      (issue.code ?? '').toUpperCase(),
      normalizeValidationMessage(issue.message).toLowerCase()
    ].join('::');

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    uniqueIssues.push({
      ...issue,
      message: normalizeValidationMessage(issue.message)
    });
  }

  return uniqueIssues;
}
