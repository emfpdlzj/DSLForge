import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  buildScaffoldWorkspaceProfile,
  type ScaffoldFrameworkHint
} from '../core/scaffoldWorkspaceProfile';

interface ScaffoldFixtureCase {
  name: string;
  workspaceRoot: string;
  activeFile?: string;
  expectedFrameworkHint: ScaffoldFrameworkHint;
  expectedPackageManager?: string;
  requiredFiles: string[];
}

interface ScaffoldFixtureManifest {
  fixtures: ScaffoldFixtureCase[];
}

async function loadManifest(): Promise<ScaffoldFixtureManifest> {
  const manifestPath = path.resolve(
    process.cwd(),
    'test-fixtures/scaffold/fixtures.json'
  );
  const raw = await fs.readFile(manifestPath, 'utf8');
  return JSON.parse(raw) as ScaffoldFixtureManifest;
}

function resolveFixturePath(workspaceRoot: string, relativePath: string | undefined): string | undefined {
  if (!relativePath) {
    return undefined;
  }

  return path.normalize(path.resolve(workspaceRoot, relativePath));
}

async function runFixture(fixture: ScaffoldFixtureCase): Promise<void> {
  const workspaceRoot = path.resolve(process.cwd(), fixture.workspaceRoot);
  const profile = await buildScaffoldWorkspaceProfile({
    workspaceRoot,
    activeFile: resolveFixturePath(workspaceRoot, fixture.activeFile)
  });

  assert.equal(
    profile.frameworkHint,
    fixture.expectedFrameworkHint,
    `${fixture.name}: framework hint mismatch`
  );

  if (fixture.expectedPackageManager) {
    assert.equal(
      profile.packageManager,
      fixture.expectedPackageManager,
      `${fixture.name}: package manager mismatch`
    );
  }

  for (const requiredFile of fixture.requiredFiles) {
    const resolvedFile = resolveFixturePath(workspaceRoot, requiredFile);
    assert.ok(
      profile.contextFiles.some((file) => file.filePath === resolvedFile),
      `${fixture.name}: missing scaffold context file ${requiredFile}`
    );
  }
}

async function main(): Promise<void> {
  const manifest = await loadManifest();

  for (const fixture of manifest.fixtures) {
    await runFixture(fixture);
    console.log(`ok: ${fixture.name}`);
  }

  console.log(`scaffold fixtures passed: ${manifest.fixtures.length}`);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
