# Development TODO

Last updated: 2026-06-15

## Done In This Branch

- [x] Add Xtext adapter discovery based on `.xtext` grammars, `.mwe2` workflow files, and Gradle/Maven build signals.
- [x] Separate package-script, Gradle-task, and Maven-goal validation preferences so wrapper planning stays framework-aware.
- [x] Add Xtext project fixtures for Gradle and Maven validation-path coverage.

## Next Recommended Work

- [x] Add Xtext validation output normalization so common Eclipse/Xtext errors map cleanly into Problems.
- [x] Expand Xtext context selection beyond sibling grammars to follow imported grammars and referenced EPackages where practical.
- [ ] Run manual VS Code smoke for the new Xtext fixtures and capture release screenshots.
- [x] Revisit AI scaffold guidance so Xtext workspaces do not default to Langium-oriented suggestions when stronger Xtext signals are present.

## Product Follow-Ups

- [x] Align extension messaging across README, package metadata, and restricted-mode copy so DSLForge is described consistently as a multi-framework DSL workflow assistant, not a Langium-first product.
- [x] Add product-facing UI entry points beyond Command Palette, such as Explorer/context menu actions, a status bar entry, or a validation plan preview surface.
- [ ] Define and implement a safe apply flow for AI output so scaffold/sample/explanation results can evolve from preview-only documents toward reviewed edits or generated files.
- [ ] Prepare Marketplace launch assets and onboarding material, including screenshots, short demo flow, positioning copy, and supported workspace examples.

## Product Positioning Notes

- [x] Keep the primary product identity focused on "DSL workflow orchestration for language engineers" rather than a generic AI coding assistant.
- [x] Differentiate against framework-specific editor extensions by emphasizing real workspace validation routing, context-aware grammar selection, and diagnostics normalization.
- [x] Avoid competing head-on with generic AI assistants on broad code generation; treat AI features as constrained authoring support around grammar understanding and DSL sample/scaffold proposals.

## Backlog Added During Implementation

- [ ] Add manual AI smoke coverage for an Xtext fixture so scaffold/sample/explanation prompts are verified against MWE2, imported grammars, and EPackage context.
- [ ] Design a reviewed apply flow for AI preview documents with explicit target-file confirmation, diff preview, and overwrite safeguards.
