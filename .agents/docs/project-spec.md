# LLM Grammer Project Spec

## 1. Summary

LLM Grammer is a VS Code extension for developers who design domain-specific languages with Langium.
It does not aim to replace Langium or build a new DSL runtime.
Its role is to shorten the grammar authoring and validation loop by combining:

- Langium project context
- VS Code editor integration
- AI-assisted draft generation and explanation
- Langium-oriented validation and feedback

In one sentence:

> Copilot proposes drafts, and this extension structures, validates, and explains them from a Langium perspective.

## 2. Product Positioning

### 2.1 What this project is

- A Langium-compatible assistant
- A workflow tool for DSL authors
- A VS Code extension that helps create, inspect, validate, and explain grammar artifacts

### 2.2 What this project is not

- Not a Langium replacement
- Not a standalone DSL engine
- Not a general-purpose coding agent
- Not a one-shot "generate my whole language" product

## 3. Target Users

Primary users:

- Developers creating a DSL with Langium
- Engineers iterating on grammar files, AST expectations, and validation rules
- Users who want faster feedback while building a language server-backed DSL

Not primary users:

- End users of a finished DSL
- Teams looking for a full interpreter or runtime generator
- Users seeking a general AI coding assistant

## 4. Core Problem

Designing a DSL with Langium already has a strong foundation:

- grammar definition
- parser generation
- AST generation
- validation
- LSP integration

The pain is not the absence of an engine.
The pain is the repeated authoring loop:

1. draft grammar
2. generate artifacts
3. run validation or build
4. inspect errors
5. revise grammar
6. explain intent to collaborators or to yourself later

This project exists to reduce the cost of that loop inside VS Code.

## 5. Product Principles

- Reuse the existing Langium ecosystem instead of recreating it
- Make validation and explanation more valuable than raw code generation
- Keep AI optional but useful
- Prefer transparent suggestions over opaque autonomous mutation
- Optimize for practical authoring workflows, not demo-only generation quality

## 6. Scope

### 6.1 In scope

- Detect Langium project structure
- Read current grammar and related files
- Generate structured scaffold suggestions for a new DSL project
- Generate sample DSL text from an existing grammar
- Validate current grammar via the Langium workflow
- Explain current grammar in human-readable terms
- Turn diagnostics into actionable feedback for the grammar author

### 6.2 Out of scope for MVP

- Building a new parser framework
- Implementing a new DSL runtime or interpreter platform
- Large autonomous self-healing loops
- Full multi-file refactoring agent behavior
- Broad non-Langium coding assistance

## 7. Differentiation

The main differentiation is not "AI can generate grammar text".
Generic chat tools can already do that.

The differentiation is:

- awareness of Langium project layout
- awareness of grammar-specific workflows
- validation-aware suggestions
- explanations tied to the current project context
- a guided loop between draft, build, diagnostics, and revision

## 8. AI Strategy

AI should be used as a supporting capability, not as the product definition.

Recommended approach:

- Use the VS Code Language Model API
- Prefer the user's existing Copilot/VS Code model environment
- Keep core non-AI workflows functional without model access where possible

AI-assisted tasks:

- scaffold draft generation
- grammar explanation
- sample DSL generation
- error explanation from diagnostics

Non-AI core tasks:

- project detection
- file/context selection
- Langium command execution or orchestration
- diagnostics collection
- result presentation in VS Code

## 9. MVP

### 9.1 MVP commands

- `Create DSL Scaffold`
- `Generate Sample DSL`
- `Validate Current Grammar`
- `Explain Current Grammar`

### 9.2 MVP priority order

Recommended build order:

1. `Validate Current Grammar`
2. `Explain Current Grammar`
3. `Create DSL Scaffold`
4. `Generate Sample DSL`

Reason:
Validation and explanation form the sharpest product identity and the clearest difference from generic AI tools.

## 10. UX Expectations

### 10.1 Command behavior

Each command should:

- work on the active workspace or active grammar file
- surface clear status to the user
- show what context was used
- avoid silent destructive changes
- prefer previewable outputs and explicit acceptance

### 10.2 Editing philosophy

- Suggestions first
- Preview before write when changes are non-trivial
- Human-readable explanations for every important action
- No hidden autonomous loops in MVP

## 11. Technical Direction

### 11.1 Language and runtime

- TypeScript
- Node.js
- VS Code extension host

### 11.2 High-level structure

- `src/extension.ts`
  Entry point for activation and command registration
- `src/commands`
  User-facing VS Code commands
- `src/core`
  Shared orchestration and domain logic
- `src/langium`
  Langium-specific project detection and workflow integration
- `src/types`
  Shared domain types

### 11.3 Future package split

If the codebase grows, split into:

- `packages/core`
- `packages/extension`
- `packages/examples`

## 12. Success Criteria

The MVP is successful if a Langium user can:

- open a workspace
- run a validation command on the current grammar
- understand diagnostics more quickly than with raw CLI output alone
- get a useful explanation of the current grammar
- generate a reasonable starting scaffold or sample when needed

## 13. Risks

- Product positioning drifting into a generic AI extension
- Overdependence on model behavior or quotas
- Weak differentiation if output quality is only "grammar text generation"
- Too much automation before the validation loop is solid
- Tight coupling to one vendor experience without a stable non-AI core

## 14. Near-Term Roadmap

### Phase 1

- VS Code extension shell
- command registration
- Langium project detection
- validation command skeleton

### Phase 2

- diagnostics capture and structured presentation
- grammar explanation flow
- prompt/context design for explanation

### Phase 3

- scaffold generation
- sample DSL generation
- preview-oriented write flow

## 15. Open Questions

- How should Langium project detection be defined precisely?
- Which files should be included by default as AI context?
- Should validation call local scripts, Langium CLI, or internal APIs first?
- What is the fallback UX when no language model is available?
- How much automatic file writing is acceptable in the first release?

## 16. Current Decision

Current working decision:

Build a TypeScript-based VS Code extension that acts as a Langium-compatible assistant for DSL authors, with MVP value centered on validation, explanation, and scaffold support rather than engine creation.
