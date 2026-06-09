# DSLForge Project Spec

## 1. Product Summary

DSLForge is a VS Code extension for DSL authoring workflows.
It starts with Langium in v0.1, but the product direction is adapter-based rather than Langium-only.

Core product promise:

- detect the current DSL authoring workflow
- validate through the workspace's real commands
- diagnose errors in a DSL-aware way
- use AI only for explicit authoring assistance tasks

DSLForge is not a generic AI generator and not a replacement for existing DSL frameworks.

## 2. Positioning

### 2.1 What the product is

- a DSL authoring workflow assistant
- a VS Code extension centered on validation and diagnosis
- a Langium-first MVP with a path to broader framework coverage

### 2.2 What the product is not

- not a general-purpose coding copilot
- not a one-shot "generate my whole language" tool
- not a replacement for Langium, ANTLR4, or Xtext
- not a new parser, runtime, or language workbench

## 3. Target Users

Primary users:

- developers creating or evolving a DSL
- engineers iterating on grammars, validation rules, and example inputs
- teams that want tighter feedback loops inside VS Code

Initial v0.1 focus:

- Langium users working with `.langium` grammars

Future users:

- ANTLR4-based DSL teams
- Xtext-based DSL teams
- projects that need a more generic grammar workflow mode

## 4. Core Problem

DSL frameworks already provide grammar definition, generation, and validation building blocks.
The practical friction is the authoring loop around them:

1. edit grammar
2. choose the relevant context
3. run project validation
4. inspect diagnostics
5. interpret framework-specific errors
6. revise grammar or examples

DSLForge exists to shorten that loop inside VS Code without replacing the underlying framework.

## 5. Product Principles

- prefer real workflow integration over synthetic demos
- keep validation usable without AI
- treat AI as optional assistance, not the product core
- favor diagnostics, explanation, and guided decisions over opaque automation
- design the system so additional DSL frameworks can be added through adapters

## 6. Scope

### 6.1 In scope for v0.1

- VS Code extension shell and command surface
- project detection for Langium workspaces
- context selection around the active grammar and related files
- validation orchestration based on workspace scripts
- diagnostics presentation for validation results
- AI-assisted explanation, scaffold generation, and sample generation

### 6.2 Out of scope for v0.1

- support for ANTLR4 or Xtext in the initial release
- autonomous multi-file edits without review
- fallback pseudo-AI behavior when model access is unavailable
- building a new DSL runtime, parser framework, or interpreter stack

## 7. MVP Definition

### 7.1 Commands

- `DSLForge: Validate Current Grammar`
- `DSLForge: Explain Current Grammar`
- `DSLForge: Create DSL Scaffold`
- `DSLForge: Generate Sample DSL`

### 7.2 MVP priorities

1. `Validate Current Grammar`
2. diagnostics presentation
3. `Explain Current Grammar`
4. `Create DSL Scaffold`
5. `Generate Sample DSL`

Reason:
The durable product identity is workflow detection, validation, and diagnosis, not raw text generation.

## 8. Architecture Direction

### 8.1 Core

Core responsibilities should stay framework-agnostic:

- project detection
- context selection
- validation orchestration
- diagnostics presentation

The core should know how to:

- inspect the active workspace
- select the appropriate adapter
- decide what context to collect
- choose the correct validation execution path
- normalize diagnostics for UI presentation

### 8.2 Adapter: Langium

The v0.1 adapter should handle:

- `.langium` grammar detection
- Langium workspace signal detection
- workspace script-first validation for Langium projects
- interpretation of Langium-related validation output and errors

### 8.3 Future adapters

The architecture should allow additional adapters without rewriting the core:

- v0.2: ANTLR4
- v0.3: Xtext
- v0.4: Generic mode

Adapter contracts should be designed so each framework can provide:

- project detection signals
- relevant context file selection
- validation command hints
- error interpretation logic

## 9. Validation Policy

Validation policy is strict:

- workspace script first
- no fake internal fallback for `Validate Current Grammar`
- no AI dependency for validation

Validation command priority:

1. user-configured validation command
2. auto-detected `package.json` script
3. explicit guidance that validation setup is required

Rationale:

- stays aligned with the repository's real build and CI flow
- respects project-specific validation setups
- avoids coupling the MVP to unstable internal framework mechanics

### 9.1 Validation UX requirements

- show which validation command was selected
- show why that command was selected
- capture stdout and stderr cleanly
- surface structured diagnostics when possible
- if no command is available, explain how to configure one

## 10. AI Policy

AI is limited to these commands:

- `Explain Current Grammar`
- `Create DSL Scaffold`
- `Generate Sample DSL`

These commands require Copilot or another supported VS Code model environment.

If model access is unavailable:

- stop the command
- show that login or model setup is required
- do not provide a fake fallback

`Validate Current Grammar` must work without AI.

## 11. UX Expectations

Each command should:

- operate on the active workspace or grammar context
- explain what inputs and context were used
- avoid silent destructive edits
- prefer preview-oriented output for non-trivial generated content
- present actionable next steps when blocked by configuration or model access

## 12. Technical Direction

### 12.1 Stack

- TypeScript
- Node.js
- VS Code extension host

### 12.2 Current high-level structure

- `src/extension.ts`
  extension activation and command registration
- `src/commands`
  VS Code command entry points
- `src/core`
  shared orchestration logic and framework-agnostic services
- `src/langium`
  Langium adapter logic
- `src/types`
  shared domain types

### 12.3 Naming

- extension/package name: `dslforge`
- display name: `DSLForge`
- command prefix: `dslforge.*`
- planned setting prefix: `dslforge.*`

## 13. Success Criteria

The MVP is successful if a Langium user can:

- open a workspace and have the project recognized as relevant
- validate the current grammar through the workspace's real validation path
- understand diagnostics faster than from raw command output alone
- get an explanation of the current grammar when model access is available
- receive a clear setup message instead of a fake AI fallback when model access is unavailable

## 14. Risks

- product drift toward a generic AI extension
- weak adapter boundaries that make ANTLR4/Xtext expansion expensive
- relying on framework internals instead of workspace commands too early
- unclear validation setup UX when no script is discoverable
- over-automating edits before diagnosis quality is strong enough

## 15. Roadmap

### v0.1 Langium-first

- VS Code extension shell
- command registration
- Langium project detection
- context selection foundations
- validation command discovery and execution
- diagnostics capture and presentation
- AI-gated explanation, scaffold, and sample generation

### v0.2 ANTLR4

- ANTLR4 adapter
- ANTLR4-oriented detection and error interpretation

### v0.3 Xtext

- Xtext adapter
- Xtext-oriented workflow detection and diagnostics

### v0.4 Generic mode

- generic adapter fallback
- broader workflow heuristics for non-framework-specific DSL projects

## 16. Implementation Guidance

### 16.1 Detection

Project detection should identify:

- active grammar file
- workspace root
- framework signals
- related grammar and config files
- package metadata and validation scripts

### 16.2 Context selection

Context selection should prefer:

- current grammar file
- closely related grammar files
- framework config and package metadata only when they improve the task

### 16.3 Diagnostics

Diagnostics presentation should normalize:

- command failures
- parser or generation failures
- framework-specific error hints
- setup problems such as missing validation configuration

## 17. Current Working Decision

Build a TypeScript-based VS Code extension named DSLForge that acts as a DSL authoring workflow assistant, starting with Langium. The MVP should emphasize project detection, validation orchestration, and diagnostics presentation. AI-assisted commands must require Copilot or another supported VS Code model environment, and `Validate Current Grammar` must remain usable without AI.
