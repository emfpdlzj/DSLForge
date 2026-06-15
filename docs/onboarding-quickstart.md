# DSLForge Quickstart

Last updated: 2026-06-15

This guide is the short onboarding path for the current pre-release branch.

## What DSLForge Helps With

- detect the active Langium, ANTLR4, or Xtext grammar workspace
- run validation through the workspace's real command path
- normalize validation output into actionable VS Code Problems
- keep AI help constrained to explicit grammar explanation, scaffold drafting, and sample generation

## One-Minute Start

1. Open one of the supported fixture workspaces or your own supported DSL workspace.
2. Focus a `.langium`, `.g4`, or `.xtext` grammar file.
3. Run `DSLForge: Validate Current Grammar`.
4. Review Problems and the DSLForge Output panel.
5. If a supported model environment is available, run one AI command such as `DSLForge: Explain Current Grammar`.
6. If the preview is useful, run `DSLForge: Apply AI Preview to Workspace`, review the draft or diff, and explicitly complete the apply.

## Validation Resolution Order

`Validate Current Grammar` stays non-AI and resolves commands in this order:

1. `dslforge.validation.command`
2. supported `package.json` script
3. supported `gradlew` task
4. supported `mvnw` goal
5. setup guidance

## Supported Example Workspaces

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

## Notes

- AI commands require GitHub Copilot or another supported VS Code model environment.
- AI preview documents do not write workspace files until the reviewed apply flow is explicitly completed.
- Marketplace screenshots are intentionally not captured in the current workstream.
