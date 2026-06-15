# Development TODO

Last updated: 2026-06-15

## Done In This Branch

- [x] Add Xtext adapter discovery based on `.xtext` grammars, `.mwe2` workflow files, and Gradle/Maven build signals.
- [x] Separate package-script, Gradle-task, and Maven-goal validation preferences so wrapper planning stays framework-aware.
- [x] Add Xtext project fixtures for Gradle and Maven validation-path coverage.

## Next Recommended Work

- [ ] Add Xtext validation output normalization so common Eclipse/Xtext errors map cleanly into Problems.
- [ ] Expand Xtext context selection beyond sibling grammars to follow imported grammars and referenced EPackages where practical.
- [ ] Run manual VS Code smoke for the new Xtext fixtures and capture release screenshots.
- [ ] Revisit AI scaffold guidance so Xtext workspaces do not default to Langium-oriented suggestions when stronger Xtext signals are present.
