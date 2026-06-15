# DSLForge Validation Smoke Test

This document fixes the validation-resolution paths used by `DSLForge: Validate Current Grammar` across Langium and Xtext fixtures.

## Fixtures

- configured command: `/Users/emfpdlzj/Desktop/DSLForge/test-fixtures/langium/configured-command`
- package script: `/Users/emfpdlzj/Desktop/DSLForge/test-fixtures/langium/package-script`
- missing command: `/Users/emfpdlzj/Desktop/DSLForge/test-fixtures/langium/missing-command`
- import context: `/Users/emfpdlzj/Desktop/DSLForge/test-fixtures/langium/import-context`
- xtext gradle wrapper: `/Users/emfpdlzj/Desktop/DSLForge/test-fixtures/xtext/gradle-wrapper`
- xtext maven wrapper: `/Users/emfpdlzj/Desktop/DSLForge/test-fixtures/xtext/maven-wrapper`

## Launch

Use one of the dedicated VS Code extension launch configurations in `.vscode/launch.json`:

- `Run DSLForge: configured-command fixture`
- `Run DSLForge: package-script fixture`
- `Run DSLForge: missing-command fixture`
- `Run DSLForge: import-context fixture`
- `Run DSLForge: xtext-gradle-wrapper fixture`
- `Run DSLForge: xtext-maven-wrapper fixture`
- `Run DSLForge: xtext-import-context fixture`

## Case 1: Configured Command

Workspace:

- `test-fixtures/langium/configured-command`

Expected behavior:

- DSLForge chooses `dslforge.validation.command`
- it does not use the `package.json` `validate` script
- message mentions configured command selection
- Problems includes `CFG001`
- Output contains `Configured command path selected by DSLForge`

## Case 2: Package Script

Workspace:

- `test-fixtures/langium/package-script`

Expected behavior:

- DSLForge auto-detects the `validate` script
- message mentions package script selection
- Problems includes `PKG001`
- Output contains `Package script validation path selected by DSLForge`

## Case 3: Missing Command

Workspace:

- `test-fixtures/langium/missing-command`

Expected behavior:

- DSLForge does not run any shell command
- warning message explains that validation command resolution failed
- Problems contains a warning with code `dslforge.validation.missing`
- Quick Fix offers:
  - `Open Validation Settings`
  - `Open Workspace package.json`

## Case 4: Import-Aware Context Selection

Workspace:

- `test-fixtures/langium/import-context`

Expected behavior:

- open `src/language/main.langium` before running the command
- DSLForge auto-detects the `validate` script
- Problems includes `IMP001`
- Output report `selected context files` includes:
  - `src/language/main.langium`
  - `src/language/shared.langium`
  - `src/language/tokens.langium`
  - `langium-config.json`
  - `package.json`
- Output report `Context Notes` or file list shows imported grammar files were selected because they are transitively imported by the active grammar

## Manual Procedure

1. Launch one of the fixture configurations.
2. In the Extension Development Host, open the `.langium` file in `src/language`.
3. Run `DSLForge: Validate Current Grammar`.
4. Check the notification message, Output panel, and Problems view.
5. For the missing-command fixture, open Quick Fix on line 1 and verify both actions appear.
6. For the import-context fixture, verify that the Output panel includes imported grammar files from the active grammar chain.
7. For the Xtext fixtures, open the `.xtext` grammar before running the command and verify that the Output panel includes the `.mwe2` workflow file together with the Gradle or Maven build file.
8. For the Xtext import-context fixture, verify that the Output panel includes the mixed-in grammar and the referenced `.ecore` file in addition to the `.mwe2` workflow and build file.
