# DSLForge Marketplace Launch Pack

Last updated: 2026-06-15

This document collects the copy and onboarding material needed for the first Marketplace-facing release.

## Positioning Copy

### Extension title

- `DSLForge`

### Short description candidates

- `Multi-framework DSL workflow assistant for validation, diagnostics, and guided grammar iteration.`
- `VS Code assistant for Langium, ANTLR4, and Xtext grammar workflows.`
- `DSL workflow orchestration in VS Code with real validation routing and AI-gated authoring support.`

### Opening paragraph

`DSLForge` is a VS Code extension for language engineers working on DSL grammars across Langium, ANTLR4, and Xtext workspaces. It detects the active grammar context, routes validation through the workspace's real command path, normalizes diagnostics into Problems, and keeps AI features constrained to explicit authoring support.

### Marketplace bullets

- Detects Langium, ANTLR4, and Xtext grammar workspaces from real project signals.
- Runs validation through configured commands, package scripts, Gradle wrappers, or Maven wrappers instead of inventing a fake validation path.
- Normalizes validation output into actionable VS Code Problems.
- Keeps AI features gated behind supported VS Code model access and explicit user actions.
- Supports reviewed AI preview apply flows so generated drafts stay preview-first until confirmed.

## One-Minute Demo Flow

1. Open a supported workspace and focus a grammar file.
2. Run `DSLForge: Validate Current Grammar`.
3. Review normalized diagnostics in Problems and the Output panel.
4. Run one AI command such as `Explain Current Grammar`.
5. If the preview is useful, run `DSLForge: Apply AI Preview to Workspace`, review the draft, and explicitly complete the apply.

## Supported Workspace Examples

### Langium

- `test-fixtures/langium/configured-command`
- `test-fixtures/langium/package-script`
- `test-fixtures/langium/import-context`

### ANTLR4

- `test-fixtures/antlr4/package-script`
- `test-fixtures/antlr4/gradle-wrapper`
- `test-fixtures/antlr4/maven-wrapper`

### Xtext

- `test-fixtures/xtext/gradle-wrapper`
- `test-fixtures/xtext/maven-wrapper`
- `test-fixtures/xtext/import-context`

## Screenshot Shot List

These are the minimum Marketplace-safe screenshots still to capture:

1. Validation diagnostics on a supported grammar with Problems visible.
2. AI gate blocked state showing setup guidance.
3. AI preview markdown document after a successful explain/scaffold/sample command.
4. Reviewed AI apply flow showing the diff or draft review step before write.
5. Xtext workspace context example showing `.mwe2`, build file, and related grammar context in Output.

## Capture Targets

### Validation screenshot

- Launch `Run DSLForge: xtext-gradle-wrapper fixture`
- Open `src/main/java/com/acme/Orders.xtext`
- Run `DSLForge: Validate Current Grammar`
- Keep the grammar editor, Problems panel, and Output panel visible

### AI gate screenshot

- Launch `Run DSLForge: import-context fixture`
- Ensure no supported model access is available
- Run `DSLForge: Explain Current Grammar`
- Capture the warning guidance and Output panel

### AI preview screenshot

- Launch `Run DSLForge: xtext-import-context fixture`
- Open `src/main/java/com/acme/Main.xtext`
- Run `DSLForge: Create DSL Scaffold` or `Explain Current Grammar`
- Capture the markdown preview and Output panel context block

### Reviewed apply screenshot

- From an AI preview document, run `DSLForge: Apply AI Preview to Workspace`
- Choose a code block or preview body
- Capture the diff or draft review surface before `Complete AI Preview Apply`

## Onboarding Notes

- Keep the README opening section aligned with the short description and opening paragraph above.
- Show at least one example from each supported framework family across docs or screenshots.
- Avoid messaging that implies generic AI coding assistance or autonomous workspace writes.
