# Changelog

All notable changes to this project will be documented in this file.

## 0.2.0 - 2026-06-15

- Added wrapper-based validation resolution for `gradlew` and `mvnw` workspaces after `dslforge.validation.command` and supported `package.json` scripts.
- Added an initial ANTLR4 adapter with project detection, context selection, and adapter registration.
- Added ANTLR4-specific validation diagnostics interpretation and regression fixtures.

## 0.0.1 - 2026-06-14

- Renamed the extension from LangForge to DSLForge.
- Established the core and adapter structure for Langium-first support.
- Added Langium workspace detection, grammar-aware context selection, and validation orchestration.
- Added diagnostics normalization and presentation for validation results.
- Added AI-gated commands for grammar explanation, DSL scaffold proposals, and sample DSL generation.
- Added regression fixture runners for diagnostics, project detection, and manifest checks.
- Added extension packaging support, icon metadata, and local VSIX smoke validation coverage.
