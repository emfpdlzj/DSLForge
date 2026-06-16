import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { strict as assert } from 'node:assert';
import { interpretAntlr4ValidationOutput } from '../antlr4/validationDiagnostics';
import { parseValidationIssues, dedupeValidationIssues } from '../core/validationIssueParser';
import { interpretLangiumValidationOutput } from '../langium/validationDiagnostics';
import { interpretXtextValidationOutput } from '../xtext/validationDiagnostics';
import type { ProjectDetectionResult, ValidationIssue } from '../types';

interface ExpectedIssue {
  severity: ValidationIssue['severity'];
  source?: string;
  code?: string;
  filePath?: string;
  line?: number;
  column?: number;
  messageIncludes: string;
}

interface DiagnosticsFixture {
  name: string;
  parser: 'generic' | 'langium' | 'antlr4' | 'xtext';
  logFile: string;
  workspaceRoot?: string;
  activeGrammarFile?: string;
  defaultSource?: string;
  expectedIssues: ExpectedIssue[];
}

interface FixtureManifest {
  workspaceRoot: string;
  fixtures: DiagnosticsFixture[];
}

function createLangiumProject(workspaceRoot: string): ProjectDetectionResult {
  return {
    adapterId: 'langium',
    framework: 'langium',
    displayName: 'Langium',
    confidence: 1,
    context: {
      adapterId: 'langium',
      framework: 'langium',
      workspaceRoot,
      grammarFiles: [],
      signals: []
    }
  };
}

function createAntlr4Project(
  workspaceRoot: string,
  activeGrammarFile?: string
): ProjectDetectionResult {
  return {
    adapterId: 'antlr4',
    framework: 'antlr4',
    displayName: 'ANTLR4',
    confidence: 1,
    context: {
      adapterId: 'antlr4',
      framework: 'antlr4',
      workspaceRoot,
      activeFile: activeGrammarFile,
      grammarFiles: activeGrammarFile ? [activeGrammarFile] : [],
      signals: []
    }
  };
}

function createXtextProject(
  workspaceRoot: string,
  activeGrammarFile?: string
): ProjectDetectionResult {
  return {
    adapterId: 'xtext',
    framework: 'xtext',
    displayName: 'Xtext',
    confidence: 1,
    context: {
      adapterId: 'xtext',
      framework: 'xtext',
      workspaceRoot,
      activeFile: activeGrammarFile,
      grammarFiles: activeGrammarFile ? [activeGrammarFile] : [],
      signals: []
    }
  };
}

function resolveExpectedFilePath(
  workspaceRoot: string,
  expectedFilePath: string | undefined
): string | undefined {
  if (!expectedFilePath) {
    return undefined;
  }

  if (path.isAbsolute(expectedFilePath)) {
    return path.normalize(expectedFilePath);
  }

  return path.normalize(path.resolve(workspaceRoot, expectedFilePath));
}

function findMatchingIssue(
  issues: ValidationIssue[],
  expected: ExpectedIssue
): ValidationIssue | undefined {
  return issues.find((issue) => {
    return (
      issue.severity === expected.severity &&
      (typeof expected.source === 'undefined' || issue.source === expected.source) &&
      (typeof expected.code === 'undefined' || issue.code === expected.code) &&
      (typeof expected.filePath === 'undefined' || issue.filePath === expected.filePath) &&
      (typeof expected.line === 'undefined' || issue.line === expected.line) &&
      (typeof expected.column === 'undefined' || issue.column === expected.column) &&
      issue.message.includes(expected.messageIncludes)
    );
  });
}

async function loadManifest(): Promise<FixtureManifest> {
  const manifestPath = path.resolve(process.cwd(), 'test-fixtures/diagnostics/fixtures.json');
  const raw = await fs.readFile(manifestPath, 'utf8');
  return JSON.parse(raw) as FixtureManifest;
}

async function runFixture(manifest: FixtureManifest, fixture: DiagnosticsFixture): Promise<void> {
  const effectiveWorkspaceRoot = path.resolve(
    process.cwd(),
    fixture.workspaceRoot ?? manifest.workspaceRoot
  );
  const logPath = path.resolve(process.cwd(), fixture.logFile);
  const rawOutput = await fs.readFile(logPath, 'utf8');
  const issues =
    fixture.parser === 'langium'
      ? interpretLangiumValidationOutput({
          project: createLangiumProject(effectiveWorkspaceRoot),
          context: {
            activeGrammarFile: undefined,
            relatedFiles: [],
            contextFiles: [],
            notes: []
          },
          rawOutput
        })
      : fixture.parser === 'antlr4'
        ? interpretAntlr4ValidationOutput({
            project: createAntlr4Project(
              effectiveWorkspaceRoot,
              resolveExpectedFilePath(effectiveWorkspaceRoot, fixture.activeGrammarFile)
            ),
            context: {
              activeGrammarFile: resolveExpectedFilePath(
                effectiveWorkspaceRoot,
                fixture.activeGrammarFile
              ),
              relatedFiles: [],
              contextFiles: [],
              notes: []
            },
            rawOutput
          })
        : fixture.parser === 'xtext'
          ? interpretXtextValidationOutput({
              project: createXtextProject(
                effectiveWorkspaceRoot,
                resolveExpectedFilePath(effectiveWorkspaceRoot, fixture.activeGrammarFile)
              ),
              context: {
                activeGrammarFile: resolveExpectedFilePath(
                  effectiveWorkspaceRoot,
                  fixture.activeGrammarFile
                ),
                relatedFiles: [],
                contextFiles: [],
                notes: []
              },
              rawOutput
            })
          : dedupeValidationIssues(
              parseValidationIssues(rawOutput, {
                workspaceRoot: effectiveWorkspaceRoot,
                defaultSource: fixture.defaultSource
              })
            );

  assert.equal(
    issues.length,
    fixture.expectedIssues.length,
    `${fixture.name}: expected ${fixture.expectedIssues.length} issue(s), got ${issues.length}`
  );

  for (const expectedIssue of fixture.expectedIssues) {
    const matched = findMatchingIssue(issues, {
      ...expectedIssue,
      filePath: resolveExpectedFilePath(effectiveWorkspaceRoot, expectedIssue.filePath)
    });
    assert.ok(matched, `${fixture.name}: missing expected issue ${JSON.stringify(expectedIssue)}`);
  }
}

async function main(): Promise<void> {
  const manifest = await loadManifest();

  for (const fixture of manifest.fixtures) {
    await runFixture(manifest, fixture);
    console.log(`ok: ${fixture.name}`);
  }

  console.log(`diagnostics fixtures passed: ${manifest.fixtures.length}`);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
