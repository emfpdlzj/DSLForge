# DSLForge AI Command Smoke Test

This document fixes the manual smoke criteria for the three AI-gated commands:

- `DSLForge: Explain Current Grammar`
- `DSLForge: Create DSL Scaffold`
- `DSLForge: Generate Sample DSL`

The goal is to verify four things:

1. AI gate blocks correctly when no supported model environment is available
2. AI gate blocks correctly when a model exists but request access is not granted
3. import-aware context selection reaches the model
4. result documents follow the expected output contract and stay preview-only

## Workspace Fixture

Use this workspace unless a case explicitly says otherwise:

- `/Users/emfpdlzj/Desktop/DSLForge/test-fixtures/langium/import-context`

Open this file before running commands:

- `src/language/main.langium`

The fixture intentionally includes this import chain:

- `main.langium`
- `shared.langium`
- `tokens.langium`

Expected selected context set for AI commands:

- `src/language/main.langium`
- `src/language/shared.langium`
- `src/language/tokens.langium`
- `langium-config.json`
- `package.json`

## Launch

Use the dedicated extension host configuration in [.vscode/launch.json](/Users/emfpdlzj/Desktop/DSLForge/.vscode/launch.json:1):

- `Run DSLForge: import-context fixture`

## Case 1: Missing Model Environment

Precondition:

- no GitHub Copilot or other supported VS Code chat model is available in the Extension Development Host

Procedure:

1. Launch `Run DSLForge: import-context fixture`
2. Open `src/language/main.langium`
3. Run each command once:
4. `DSLForge: Explain Current Grammar`
5. `DSLForge: Create DSL Scaffold`
6. `DSLForge: Generate Sample DSL`

Expected behavior:

- each command stops before any model request is sent
- a warning message explains that login or model setup is required
- the warning offers `Open Settings`
- Output includes an `DSLForge AI Gate ...` section
- Output shows:
  - `status: missing_model`
  - `selected model: none`
- no preview markdown document is opened
- no fake fallback result is produced

## Case 2: Model Present But No Access

Precondition:

- at least one supported chat model is visible
- request access is not granted for this extension or current environment

Procedure:

1. Launch `Run DSLForge: import-context fixture`
2. Open `src/language/main.langium`
3. Run each AI command once

Expected behavior:

- each command stops before explanation or generation starts
- warning message explains that a supported model exists but request access is unavailable
- Output includes an `DSLForge AI Gate ...` section
- Output shows:
  - `status: no_access`
  - `available models:` greater than `0`
  - `selected model:` with vendor/family/version
- no preview markdown document is opened
- no fallback content is produced

## Case 3: Explain Current Grammar

Precondition:

- a supported chat model is available
- request access is granted

Procedure:

1. Launch `Run DSLForge: import-context fixture`
2. Open `src/language/main.langium`
3. Run `DSLForge: Explain Current Grammar`

Expected behavior:

- Output includes `DSLForge AI Gate Explain Current Grammar`
- Output includes `DSLForge Explain Current Grammar`
- Output includes `DSLForge Explain Current Grammar Contract`
- Output file list includes the import chain and config/package files
- a new markdown document opens

Expected document header:

- `DSLForge Grammar Explanation`
- `Contract sections: Summary, Key Rules, Likely Intent, Risks or Ambiguities, Suggested Next Checks`
- `Contract status: exact` or `Contract status: normalized`

Expected document sections:

- `## Summary`
- `## Key Rules`
- `## Likely Intent`
- `## Risks or Ambiguities`
- `## Suggested Next Checks`

Acceptance criteria:

- content refers to visible grammar structure, not generic DSL advice
- imports or shared terminals are mentioned if relevant
- if the model drifted, the normalized document still preserves the required section set

## Case 4: Create DSL Scaffold

Precondition:

- a supported chat model is available
- request access is granted

Procedure:

1. Launch `Run DSLForge: import-context fixture`
2. Open `src/language/main.langium`
3. Run `DSLForge: Create DSL Scaffold`

Expected behavior:

- Output includes `DSLForge AI Gate Create DSL Scaffold`
- Output includes `DSLForge Create DSL Scaffold`
- Output includes `DSLForge Create DSL Scaffold Contract`
- a new markdown document opens

Expected document header:

- `DSLForge DSL Scaffold Proposal`
- `Preview only: DSLForge has not written any files.`
- `Contract sections: Scaffold Overview, Suggested Files, package.json Scripts, Starter Grammar, Implementation Notes, Next Steps`

Expected document sections:

- `## Scaffold Overview`
- `## Suggested Files`
- `## package.json Scripts`
- `## Starter Grammar`
- `## Implementation Notes`
- `## Next Steps`

Acceptance criteria:

- output is proposal-oriented and does not pretend files were already created
- file suggestions are practical for Langium-first v0.1
- `package.json Scripts` contains concrete script names/commands
- `Starter Grammar` includes fenced code blocks

## Case 5: Generate Sample DSL

Precondition:

- a supported chat model is available
- request access is granted

Procedure:

1. Launch `Run DSLForge: import-context fixture`
2. Open `src/language/main.langium`
3. Run `DSLForge: Generate Sample DSL`

Expected behavior:

- Output includes `DSLForge AI Gate Generate Sample DSL`
- Output includes `DSLForge Generate Sample DSL`
- Output includes `DSLForge Generate Sample DSL Contract`
- a new markdown document opens

Expected document header:

- `DSLForge Sample DSL Generation`
- `Preview only: review the samples before using them.`
- `Contract sections: Reading of the Grammar, Sample 1, Sample 2, Sample 3, Edge Cases to Try`

Expected document sections:

- `## Reading of the Grammar`
- `## Sample 1`
- `## Sample 2`
- `## Sample 3`
- `## Edge Cases to Try`

Acceptance criteria:

- each sample is in a fenced code block
- the three samples differ in complexity
- sample text is plausible for the visible grammar
- edge cases mention ambiguity or incompleteness when visible

## Output Panel Checks

For all successful AI command runs, verify:

- `context files: 5`
- active grammar is `src/language/main.langium`
- file list includes imported grammars with their context kind
- contract status is either `exact` or `normalized`

If contract status is `normalized`, verify:

- all required sections are still present
- any drift is visible in the `DSLForge ... Contract` output block

## Failure Criteria

Treat the smoke test as failed if any of these happen:

- an AI command produces content without passing the AI gate
- a blocked AI command opens a preview markdown document
- imported grammar files are missing from the successful-run context file list
- required contract sections are absent from the final document
- scaffold output implies that files were written automatically
- sample DSL output is not copyable as fenced code blocks
