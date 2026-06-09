# DSLForge Validation Smoke Test

This document fixes the three Langium validation-resolution paths used by `DSLForge: Validate Current Grammar`.

## Fixtures

- configured command: `/Users/emfpdlzj/Desktop/DSLForge/test-fixtures/langium/configured-command`
- package script: `/Users/emfpdlzj/Desktop/DSLForge/test-fixtures/langium/package-script`
- missing command: `/Users/emfpdlzj/Desktop/DSLForge/test-fixtures/langium/missing-command`

## Launch

Use one of the dedicated VS Code extension launch configurations in `.vscode/launch.json`:

- `Run DSLForge: configured-command fixture`
- `Run DSLForge: package-script fixture`
- `Run DSLForge: missing-command fixture`

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
  - `Configure validation command`
  - `Open workspace package.json`

## Manual Procedure

1. Launch one of the fixture configurations.
2. In the Extension Development Host, open the `.langium` file in `src/language`.
3. Run `DSLForge: Validate Current Grammar`.
4. Check the notification message, Output panel, and Problems view.
5. For the missing-command fixture, open Quick Fix on line 1 and verify both actions appear.
