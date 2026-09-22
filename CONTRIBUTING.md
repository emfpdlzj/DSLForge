# Contributing to DSLForge

Thank you for helping improve DSLForge. Contributions should stay focused on
reliable DSL authoring workflows for Langium, ANTLR4, and Xtext workspaces.

By participating in this project, you agree to follow the
[Code of Conduct](CODE_OF_CONDUCT.md).

## Before You Start

- Search existing issues and pull requests before starting duplicate work.
- Open an issue before making a large behavioral, architectural, dependency,
  or API change.
- Keep pull requests focused on one purpose.
- Never include credentials, private workspace contents, generated VSIX files,
  or local editor state in a contribution.

## Development Setup

Development and CI use Node.js 24 LTS and npm. The extension itself targets
VS Code 1.120 or later and therefore uses Node.js 22-compatible type
definitions for extension-host APIs.

```bash
git clone https://github.com/emfpdlzj/DSLForge.git
cd DSLForge
npm ci
npm test
```

Open the repository in VS Code and use the Extension Development Host when a
change needs manual extension testing.

## Branch Workflow

The repository uses `main` for releasable code and `develop` for integration.
Do not commit directly to either branch.

1. Update your local `develop` branch.
2. Create a focused branch from `develop` using one of these prefixes:
   `feat/`, `fix/`, `docs/`, `test/`, `refactor/`, or `chore/`.
3. Commit and push the work branch.
4. Open a pull request from the work branch into `develop`.
5. After review and successful CI, squash-merge the pull request and delete
   the work branch.

Use an English kebab-case branch description, for example:

```text
feat/generic-dsl-adapter
fix/xtext-diagnostic-location
docs/validation-guide
chore/update-dependencies
```

Commit subjects and pull request titles use the following English format:

```text
feat: add Generic DSL adapter
fix: correct Xtext diagnostic locations
docs: add validation configuration guide
chore: update development dependencies
```

## Making Changes

- Follow the existing TypeScript naming, error handling, and directory
  structure.
- Fix the underlying cause instead of adding a fixture-specific workaround.
- Keep AI-backed behavior explicitly gated. Do not add fabricated fallback
  responses when model access is unavailable.
- Preserve the non-AI validation path and its command selection priority.
- Add or update fixtures when project detection, context selection,
  diagnostics, scaffolding, or manifest behavior changes.
- Avoid unrelated refactors and new dependencies in a focused pull request.

## Validation

Run the complete local checks before opening or updating a pull request:

```bash
npm run typecheck
npm run build
npm test
npm audit
```

For faster iteration, the repository also provides focused fixture commands:

```bash
npm run test:ai-preview-apply
npm run test:diagnostics
npm run test:projects
npm run test:scaffold
npm run test:manifest
```

When behavior depends on VS Code APIs or UI, describe the manual verification
steps and tested VS Code version in the pull request.

## Pull Requests

Pull requests target `develop` and must include:

- the purpose and background of the change;
- the main implementation details;
- automated and manual verification performed;
- the affected commands, adapters, settings, or workflows;
- related issue links, or a note that there is no related issue.

At least one reviewer must approve the pull request, all CI checks must pass,
and all review comments must be resolved before merge. Authors must not approve
and merge their own pull request without another review.

## Reporting Bugs

Include the DSL framework, operating system, VS Code version, minimal project
layout or reproduction fixture, expected behavior, actual behavior, and any
relevant DSLForge Output logs. Remove secrets and private source content before
sharing logs or examples.
