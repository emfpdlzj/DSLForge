# DSLForge Implementation Handover

Last updated: 2026-06-14

## 1. Snapshot

DSLForge is a VS Code extension positioned as a `DSL authoring workflow assistant, starting with Langium`.

Current release target:

- v0.1
- Langium-first
- adapter-ready architecture

Current product stance:

- not a generic AI generator
- validation and diagnostics first
- AI is optional and gated by actual VS Code model access

## 2. What Is Implemented

### 2.1 Identity / Packaging

- extension name: `dslforge`
- display name: `DSLForge`
- command prefix: `dslforge.*`
- icon wired through `media/icon.png`
- repository URLs aligned to `https://github.com/emfpdlzj/DSLForge`
- VS Code engine currently set to `^1.120.0`

### 2.2 Commands

- `DSLForge: Validate Current Grammar`
- `DSLForge: Explain Current Grammar`
- `DSLForge: Create DSL Scaffold`
- `DSLForge: Generate Sample DSL`

### 2.3 Core Architecture

Implemented framework-agnostic core responsibilities:

- project detection orchestration
- adapter resolution
- context selection orchestration
- validation orchestration
- diagnostics presentation
- AI access gate
- shared AI context / output contract handling

Key areas:

- `src/core`
- `src/langium`
- `src/commands`
- `src/types`

### 2.4 Langium Adapter

Langium detection currently uses combined signals:

- active `.langium` file
- workspace `.langium` files
- `langium-config.json`
- `package.json` dependency/devDependency on `langium`
- Langium-related scripts or script commands

Langium context selection currently includes:

- active grammar
- import chain from the active grammar
- `langium-config.json`
- `package.json`
- sibling/configured grammar files when relevant

### 2.5 Validation Flow

`Validate Current Grammar` is intentionally non-AI.

Resolution priority:

1. `dslforge.validation.command`
2. auto-detected supported `package.json` script
3. guidance that validation setup is required

Implemented behavior:

- actual workspace command execution
- cancellable progress
- per-workspace concurrency guard
- stdout/stderr streaming to Output Channel
- bounded in-memory capture for parsing
- structured Problems publication when possible
- Quick Fix guidance for missing configuration

### 2.6 Diagnostics

Implemented:

- generic diagnostics normalization
- Langium-specific diagnostics interpretation
- file/line/column parsing
- TypeScript error code/source extraction
- webpack / `[tsl]` style block parsing
- some unlocated Langium and TypeScript failures

### 2.7 AI Commands

Implemented and gated:

- `Explain Current Grammar`
- `Create DSL Scaffold`
- `Generate Sample DSL`

Current policy:

- requires VS Code model access / Copilot-compatible environment
- if unavailable, command stops and shows guidance
- no fake fallback

Current output mode:

- preview-oriented Markdown documents
- contract-normalized sections per command
- no automatic multi-file write flow

## 3. Manual Smoke Status

Confirmed on local install path:

- VSIX packaging works
- local VS Code install works
- all 4 commands appear in the Command Palette
- unsupported-workspace guidance appears correctly
- `Validate Current Grammar` runs in Langium fixture workspaces
- validation failures surface in notification, Output, and Problems

Known note:

- CLI-driven isolated profile smoke using custom `--extensions-dir` / `--user-data-dir` was not reliable on this machine
- trustworthy manual smoke came from normal local VS Code install

## 4. Fixtures and Tests

Langium fixtures:

- `test-fixtures/langium/configured-command`
- `test-fixtures/langium/package-script`
- `test-fixtures/langium/missing-command`
- `test-fixtures/langium/import-context`

Diagnostics fixtures:

- `test-fixtures/diagnostics/*`

Manual smoke docs:

- `docs/manual-smoke-validation.md`
- `docs/manual-smoke-ai.md`

Regression commands:

- `npm run typecheck`
- `npm run test`
- `npm run test:diagnostics`
- `npm run test:projects`
- `npm run test:manifest`
- `npm exec -- vsce package`

## 5. Important Files

- `package.json`
- `.vscodeignore`
- `README.md`
- `src/extension.ts`
- `src/core/validationOrchestrator.ts`
- `src/core/validationCommandResolver.ts`
- `src/core/diagnosticsPresenter.ts`
- `src/core/aiCommandGate.ts`
- `src/core/grammarAiSupport.ts`
- `src/langium/adapter.ts`
- `src/langium/projectDetection.ts`
- `src/langium/contextSelection.ts`

## 6. Product Decisions Already Locked

- product name is `DSLForge`
- positioning is `DSL authoring workflow assistant, starting with Langium`
- v0.1 supports Langium only
- adapter architecture is the expansion path
- `Validate Current Grammar` must work without AI
- validation is workspace-command-first
- AI commands must stop if model access is unavailable

## 7. Open Decisions

1. Should `Create DSL Scaffold` require Langium workspace detection, or should it work in a broader empty/new-project context
2. Should preview-only AI outputs later gain an explicit accept/write flow
3. How strict should Langium-specific context selection become before ANTLR4 adapter work starts
4. What exact Marketplace positioning/copy should be used for the first public release

## 8. Recommended Next Work

1. polish README / Marketplace copy for public launch
2. run broader manual smoke for AI commands in a model-enabled environment
3. decide `Create DSL Scaffold` execution policy
4. prepare changelog, screenshots, and first release notes
5. after v0.1 feedback, start ANTLR4 adapter discovery and contract validation
