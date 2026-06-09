import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { detectLangiumProject } from '../langium/projectDetection';
import { buildLangiumContextSelection } from '../langium/contextSelection';
import { readWorkspacePackageInfo } from '../core/workspacePackage';
import { resolveValidationPlanCore } from '../core/validationPlan';

interface DetectionExpectation {
  minimumConfidence: number;
  requiredSignalKinds: string[];
}

interface ValidationExpectation {
  configuredCommand?: string;
  source: 'user-configured' | 'package-script' | 'missing';
  commandLine?: string;
  scriptName?: string;
}

interface ContextExpectation {
  activeGrammarFile: string;
  contextKinds: string[];
  requiredFiles: string[];
  relatedFileCount: number;
}

interface ProjectFixtureCase {
  name: string;
  workspaceRoot: string;
  activeFile?: string;
  detection: DetectionExpectation;
  validation: ValidationExpectation;
  context?: ContextExpectation;
}

interface ProjectFixtureManifest {
  fixtures: ProjectFixtureCase[];
}

async function collectGrammarFiles(workspaceRoot: string): Promise<string[]> {
  const entries = await fs.readdir(workspaceRoot, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git') {
      continue;
    }

    const fullPath = path.join(workspaceRoot, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectGrammarFiles(fullPath)));
      continue;
    }

    if (entry.isFile() && fullPath.endsWith('.langium')) {
      files.push(path.normalize(fullPath));
    }
  }

  return files.sort();
}

async function loadManifest(): Promise<ProjectFixtureManifest> {
  const manifestPath = path.resolve(
    process.cwd(),
    'test-fixtures/projects/fixtures.json'
  );
  const raw = await fs.readFile(manifestPath, 'utf8');
  return JSON.parse(raw) as ProjectFixtureManifest;
}

function resolveFixturePath(workspaceRoot: string, relativePath: string | undefined): string | undefined {
  if (!relativePath) {
    return undefined;
  }

  return path.normalize(path.resolve(workspaceRoot, relativePath));
}

async function runDetectionCase(fixture: ProjectFixtureCase): Promise<void> {
  const workspaceRoot = path.resolve(process.cwd(), fixture.workspaceRoot);
  const grammarFiles = await collectGrammarFiles(workspaceRoot);
  const activeFile = resolveFixturePath(workspaceRoot, fixture.activeFile);
  const detection = await detectLangiumProject({
    workspaceRoot,
    activeFile,
    grammarFiles
  });

  assert.ok(detection, `${fixture.name}: detection should succeed`);
  assert.ok(
    detection.confidence >= fixture.detection.minimumConfidence,
    `${fixture.name}: expected confidence >= ${fixture.detection.minimumConfidence}, got ${detection.confidence}`
  );

  for (const requiredSignalKind of fixture.detection.requiredSignalKinds) {
    assert.ok(
      detection.signals.some((signal) => signal.kind === requiredSignalKind),
      `${fixture.name}: missing detection signal kind ${requiredSignalKind}`
    );
  }
}

async function runValidationCase(fixture: ProjectFixtureCase): Promise<void> {
  const workspaceRoot = path.resolve(process.cwd(), fixture.workspaceRoot);
  const packageInfo = await readWorkspacePackageInfo(workspaceRoot);
  const plan = resolveValidationPlanCore({
    configuredCommand: fixture.validation.configuredCommand,
    adapterDisplayName: 'Langium',
    preferredScriptNames: ['validate', 'langium:validate', 'langium:check', 'build'],
    packageInfo
  });

  assert.equal(
    plan.command.source,
    fixture.validation.source,
    `${fixture.name}: validation source mismatch`
  );

  if (fixture.validation.commandLine) {
    assert.equal(
      plan.command.commandLine,
      fixture.validation.commandLine,
      `${fixture.name}: validation command line mismatch`
    );
  }

  if (fixture.validation.scriptName) {
    assert.equal(
      plan.command.scriptName,
      fixture.validation.scriptName,
      `${fixture.name}: validation script name mismatch`
    );
  }
}

async function runContextCase(fixture: ProjectFixtureCase): Promise<void> {
  if (!fixture.context) {
    return;
  }

  const workspaceRoot = path.resolve(process.cwd(), fixture.workspaceRoot);
  const grammarFiles = await collectGrammarFiles(workspaceRoot);
  const activeFile = resolveFixturePath(workspaceRoot, fixture.activeFile);
  const context = await buildLangiumContextSelection({
    workspaceRoot,
    activeFile,
    grammarFiles
  });

  assert.equal(
    context.activeGrammarFile,
    resolveFixturePath(workspaceRoot, fixture.context.activeGrammarFile),
    `${fixture.name}: active grammar mismatch`
  );
  assert.equal(
    context.relatedFiles.length,
    fixture.context.relatedFileCount,
    `${fixture.name}: related file count mismatch`
  );

  for (const contextKind of fixture.context.contextKinds) {
    assert.ok(
      context.contextFiles.some((file) => file.kind === contextKind),
      `${fixture.name}: missing context file kind ${contextKind}`
    );
  }

  for (const requiredFile of fixture.context.requiredFiles) {
    const resolvedFile = resolveFixturePath(workspaceRoot, requiredFile);
    assert.ok(
      context.contextFiles.some((file) => file.filePath === resolvedFile),
      `${fixture.name}: missing context file ${requiredFile}`
    );
  }
}

async function main(): Promise<void> {
  const manifest = await loadManifest();

  for (const fixture of manifest.fixtures) {
    await runDetectionCase(fixture);
    await runValidationCase(fixture);
    await runContextCase(fixture);
    console.log(`ok: ${fixture.name}`);
  }

  console.log(`project fixtures passed: ${manifest.fixtures.length}`);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
