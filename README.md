# LangForge

LangForge is a Visual Studio Code extension for developers building DSLs with Langium.

Current focus:

- validate the current grammar
- explain the current grammar
- generate scaffold suggestions
- generate sample DSL text

## Product direction

LangForge is not a Langium replacement or a generic coding agent.
It is a workflow assistant for grammar authors who want a tighter loop between editing, validation, diagnostics, and explanation inside VS Code.

## MVP commands

- `LangForge: Validate Current Grammar`
- `LangForge: Explain Current Grammar`
- `LangForge: Create DSL Scaffold`
- `LangForge: Generate Sample DSL`

## Current decisions

- Validation is non-AI and should follow the workspace's own validation script first.
- AI commands require Copilot or another supported VS Code model environment.
- If model access is unavailable, LangForge should explain the requirement and stop instead of pretending to provide an AI fallback.
- Non-trivial generated output should be previewed before writing.

## Validation strategy

LangForge should validate using the project's real workflow in this order:

1. User-configured validation command
2. Auto-detected `package.json` script
3. Clear guidance that the workspace needs a validation command

This keeps VS Code behavior aligned with the actual project build and CI flow.

## Repository

- GitHub: [emfpdlzj/LangForge](https://github.com/emfpdlzj/LangForge)
