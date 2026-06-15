import * as fs from 'node:fs';
import * as path from 'node:path';

interface PackageJson {
  name?: string;
  displayName?: string;
  capabilities?: {
    virtualWorkspaces?: boolean | { supported?: boolean | string };
    untrustedWorkspaces?: {
      supported?: boolean | string;
      description?: string;
    };
  };
  contributes?: {
    commands?: Array<{
      command?: string;
      title?: string;
      category?: string;
    }>;
  };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function readPackageJson(): PackageJson {
  const packageJsonPath = path.resolve(__dirname, '../../package.json');
  return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as PackageJson;
}

function run(): void {
  const packageJson = readPackageJson();

  assert(packageJson.name === 'dslforge', 'package name must be dslforge');
  assert(
    packageJson.displayName === 'DSLForge',
    'displayName must be DSLForge'
  );

  assert(
    packageJson.capabilities?.virtualWorkspaces === false,
    'virtualWorkspaces capability must be false'
  );

  assert(
    packageJson.capabilities?.untrustedWorkspaces?.supported === 'limited',
    'untrustedWorkspaces support must be limited'
  );

  assert(
    packageJson.capabilities?.untrustedWorkspaces?.description?.includes(
      'Restricted Mode'
    ) ||
      packageJson.capabilities?.untrustedWorkspaces?.description?.includes(
        'workspace trust'
      ),
    'untrustedWorkspaces description must explain the trust limitation'
  );

  const commands =
    packageJson.contributes?.commands?.map((command) => command.command) ?? [];

  for (const commandId of [
    'dslforge.validateCurrentGrammar',
    'dslforge.explainCurrentGrammar',
    'dslforge.createDslScaffold',
    'dslforge.generateSampleDsl'
  ]) {
    assert(commands.includes(commandId), `missing command contribution: ${commandId}`);
  }

  console.log('manifest fixture checks passed');
}

run();
