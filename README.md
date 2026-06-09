# DSLForge

DSLForge is a VS Code extension for DSL authoring workflows. It starts with Langium in v0.1 and is designed to expand through adapters instead of becoming a generic AI code generator.

## What It Is

DSLForge helps DSL authors work inside the real authoring loop:

- detect the current DSL project context
- choose the right grammar-related context
- run validation through the workspace's actual workflow
- present diagnostics in a form that is easier to act on
- use AI only for explicitly AI-scoped authoring tasks

## Product Positioning

DSLForge is:

- a DSL authoring workflow assistant
- a VS Code extension with Langium-first MVP support
- a product that emphasizes detection, validation, and diagnosis

DSLForge is not:

- a replacement for Langium, ANTLR4, or Xtext
- a generic AI coding copilot
- a fake one-click language generator

## v0.1 Scope

The first release supports Langium only.

Core responsibilities:

- project detection
- context selection
- validation orchestration
- diagnostics presentation

Langium adapter responsibilities:

- detect `.langium` grammars
- prefer workspace validation scripts over internal fallback logic
- interpret Langium-related validation errors

## Commands

- `DSLForge: Validate Current Grammar`
- `DSLForge: Explain Current Grammar`
- `DSLForge: Create DSL Scaffold`
- `DSLForge: Generate Sample DSL`

## Validation Policy

`Validate Current Grammar` must work without AI.

Validation command priority:

1. user-configured validation command
2. auto-detected `package.json` script
3. clear guidance that validation setup is required

This keeps the extension aligned with the workspace's real build and CI behavior.

## AI Policy

The following commands require Copilot or another supported VS Code model environment:

- `Explain Current Grammar`
- `Create DSL Scaffold`
- `Generate Sample DSL`

If model access is unavailable, DSLForge must stop and show setup or sign-in guidance. It must not pretend to provide an AI fallback.

## Roadmap

- v0.1: Langium-first adapter
- v0.2: ANTLR4 adapter
- v0.3: Xtext adapter
- v0.4: Generic mode

## Repository

- GitHub: [emfpdlzj/DSLForge](https://github.com/emfpdlzj/DSLForge)
