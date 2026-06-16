# DSLForge

DSLForge is a VS Code extension for Copilot-assisted DSL authoring across Langium, ANTLR4, and Xtext workspaces.

It helps language engineers generate, explain, and iterate on DSL grammars inside VS Code without pretending to replace the underlying DSL engine. DSLForge detects the active grammar context, keeps AI features focused on explicit authoring tasks, and routes validation through the workspace's real command path so generated ideas can be checked against the actual project workflow.

## Current Status

DSLForge is currently a pre-release extension.

- current branch work supports Langium, ANTLR4, and Xtext workflows
- AI commands are the primary authoring-assistance surface for scaffold, explanation, and sample generation
- `Validate Current Grammar` is intentionally non-AI
- AI commands require GitHub Copilot or another supported VS Code model environment
- if AI access is unavailable, DSLForge stops and shows guidance instead of inventing a fake fallback

## Features

- explains current grammars and generates scaffold or sample proposals through supported VS Code model access
- detects the current Langium, ANTLR4, or Xtext workspace and grammar context
- follows import-aware grammar context selection for Langium, reference-aware context selection for ANTLR4, and workflow-aware context selection for Xtext
- resolves validation from the real workspace in this order:
  1. `dslforge.validation.command`
  2. auto-detected supported `package.json` script
  3. auto-detected `gradlew` task
  4. auto-detected `mvnw` goal
  5. setup guidance
- publishes normalized diagnostics into Problems
- uses AI only for explicit DSL authoring tasks instead of generic coding assistance
- exposes grammar actions from editor and Explorer context menus in addition to the Command Palette
- lets reviewed AI preview documents move toward workspace files through an explicit diff-and-apply flow

## What DSLForge Does Not Do

- it does not replace Langium, ANTLR4, or Xtext
- it does not try to be a generic AI coding copilot
- it does not fake a validation engine when the workspace has not defined one
- it does not fake AI output when no supported model environment is available

## Install

After the Marketplace listing is live, install `DSLForge` from VS Code Marketplace.

Until then, you can evaluate it locally:

1. run `npm install`
2. run `npm exec -- vsce package`
3. install the generated `dslforge-0.2.0.vsix` in VS Code

## One-Minute Flow

1. Open a Langium, ANTLR4, or Xtext workspace.
2. Open the grammar file you are working on.
3. Run `DSLForge: Explain Current Grammar`, `Create DSL Scaffold`, or `Generate Sample DSL` when GitHub Copilot or another supported model is available.
4. Run `DSLForge: Validate Current Grammar` to check the grammar through the workspace's real validation command path.
5. If DSLForge cannot resolve validation, set `dslforge.validation.command` or add a supported `package.json` script, `gradlew` task, or `mvnw` goal.

Scaffold-only bootstrap flow:

1. Open any trusted workspace folder, even if it does not contain a detected DSL yet.
2. Run `DSLForge: Create DSL Scaffold`.
3. Review the proposal before creating files manually.

Recommended first local check from this repository:

1. open `test-fixtures/langium/configured-command`
2. open `src/language/configured.langium`
3. run `DSLForge: Validate Current Grammar`

Expected result:

- DSLForge selects the configured validation command first
- validation output is streamed to the Output panel
- normalized diagnostics are surfaced in Problems

## Commands

Non-AI:

- `DSLForge: Validate Current Grammar`

AI-backed authoring assistance:

- `DSLForge: Explain Current Grammar`
- `DSLForge: Create DSL Scaffold`
- `DSLForge: Generate Sample DSL`

`Create DSL Scaffold` can run in two modes:

- detected-workspace mode when DSLForge recognizes a Langium, ANTLR4, or Xtext context
- bootstrap mode when the workspace is open but no supported DSL framework has been detected yet

## Validation Behavior

`Validate Current Grammar` is intentionally non-AI.

Validation priority:

1. `dslforge.validation.command`
2. supported `package.json` script auto-detection
3. supported `gradlew` task auto-detection
4. supported `mvnw` goal auto-detection
5. setup guidance

This keeps DSLForge aligned with the workspace's real build and CI behavior instead of inventing an internal validation path that does not match the project.

## AI Limits

The following commands require GitHub Copilot or another supported VS Code model environment:

- `Explain Current Grammar`
- `Create DSL Scaffold`
- `Generate Sample DSL`

If model access is unavailable, DSLForge:

- stops before making any model request
- shows setup or sign-in guidance
- records the AI gate result in the Output channel
- does not create a fake preview document

## Adapter Scope

Current implemented adapters in this branch:

- Langium
- ANTLR4
- Xtext

Current responsibilities:

- project detection
- context selection
- validation orchestration
- diagnostics presentation

Next adapter work after this branch:

- later target: Generic mode

## Settings

Current extension settings:

- `dslforge.validation.command`
- `dslforge.validation.maxCapturedOutputCharacters`
- `dslforge.ai.maxContextFiles`
- `dslforge.ai.maxCharactersPerFile`
- `dslforge.ai.maxContextCharacters`

## Development

Useful commands:

- `npm run build`
- `npm run typecheck`
- `npm run test`
- `npm run test:diagnostics`
- `npm run test:projects`
- `npm run test:manifest`
- `npm exec -- vsce package`

Release notes live in [CHANGELOG.md](CHANGELOG.md).
