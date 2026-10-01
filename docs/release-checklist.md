# DSLForge Release Checklist

Last updated: 2026-10-01

This checklist tracks the `0.3.2` VS Code Marketplace patch release of `DSLForge`.

## Release Goal

Ship `DSLForge` as a DSL authoring workflow assistant with Langium, ANTLR4, and Xtext workspace support.

Non-goals for this release:

- generic AI code generation
- fake fallback behavior for AI commands

## Current Audit Summary

Completed in this audit:

- `npm run typecheck` passed
- `npm run test` passed
- `npm exec -- vsce ls` passed
- `npm exec -- vsce package` passed
- package payload includes compiled runtime files and excludes source/test fixtures
- `LICENSE` exists
- `.vscodeignore` exists
- extension icon exists at `media/icon.png`
- `.agents/` and `AGENTS.md` are ignored for future commits
- `package.json` now includes preview metadata, keywords, and explicit license reference
- `CHANGELOG.md` now exists for the first release
- README now includes installation guidance, a one-minute flow, and explicit adapter/AI limits
- `docs/marketplace-launch.md` now includes launch copy, a short demo flow, and supported workspace examples
- `docs/onboarding-quickstart.md` now provides a short onboarding path for supported workspaces
- current branch packaging still succeeds after the reviewed AI preview apply flow changes
- reviewed AI preview apply logic now has dedicated fixture coverage for file-target parsing, bundle selection, and conflict detection
- telemetry client policy and proxy validation now have automated regression coverage
- pull requests now verify the extension package payload with pinned `@vscode/vsce`
- untagged package versions promoted to `main` now publish automatically and archive the generated VSIX
- `preview: true` remains intentional for `0.3.2`
- `dslforge-0.3.2.vsix` installs successfully in an isolated VS Code profile
- the `VSCE_PAT` secret and `DSLFORGE_TELEMETRY_PROXY_ENDPOINT` repository variable are configured

## Remaining Release-Critical Work

- complete manual VS Code smoke for the Xtext fixtures and AI preview/apply path
- confirm publisher access and Marketplace login path
- review the exact release commit state before merging the version change to `main`
- confirm the automatic Marketplace publish and generated release tag succeed

## Deferred Or Optional For This Workstream

- Marketplace screenshots are deferred by current user instruction and are not treated as an active release blocker unless release policy changes.
- Extra README copy polish is optional as long as the current opening section stays accurate and concrete.
- Additional launch collateral beyond the existing [Marketplace launch pack](marketplace-launch.md) is optional.

## Post-Publish Follow-Up

- announce the release through the intended promotion channels
- re-enable and capture Marketplace screenshots later if the release process requires them
- collect first-user feedback and fold any follow-up items back into the [development backlog](development-todo.md)

## Blocking Checks

These items must be true before `vsce publish`:

- `git status` is reviewed and only intended release changes remain
- no `.agents/` content is tracked in the commit to publish
- `package.json.publisher` matches the actual Marketplace publisher
- `package.json.repository`, `bugs`, and `homepage` point to the final public repository
- `README.md` reflects actual released behavior and does not imply unsupported adapters are available
- `Validate Current Grammar` remains non-AI and follows:
  1. `dslforge.validation.command`
  2. supported `package.json` script auto-detection
  3. supported `gradlew` task auto-detection
  4. supported `mvnw` goal auto-detection
  5. setup guidance
- AI commands stop with guidance when no supported VS Code model environment is available
- README and changelog images use valid non-SVG Marketplace-safe URLs if remote images are added

## Content Review Before Publish

- Confirm extension title and short description are final
- Confirm `keywords` match real discovery terms
- Review the [Marketplace launch pack](marketplace-launch.md) and finalize one short description candidate plus the opening paragraph
- Review the [onboarding quickstart](onboarding-quickstart.md) and keep it aligned with the README quick-start flow
- Keep README opening section short and concrete:
  - what DSLForge is
  - currently documented adapter scope
  - validation is non-AI
  - AI commands require supported model access
- Add an installation or quick-start flow that can be followed in under one minute

## Technical Verification Checklist

- Run `npm run build`
- Run `npm run typecheck`
- Run `npm run test`
- Run `npm run package:check`
- Install the generated `.vsix` into a clean VS Code profile or Extension Development Host
- Verify validation command paths:
  - configured command fixture
  - package script fixture
  - gradle wrapper fixture
  - maven wrapper fixture
  - Xtext gradle wrapper fixture
  - Xtext maven wrapper fixture
  - missing command fixture
- Verify AI command gate paths:
  - missing model environment
  - model present but no request access
- Verify one successful AI preview path if model access is available
- Verify the reviewed AI preview apply flow in VS Code before release

## Git And Repo Checklist

- Confirm no accidental secrets or internal-only docs are staged
- Confirm `.agents/` remains local-only
- Confirm the public repository URL is correct everywhere:
  - `package.json.repository.url`
  - `package.json.bugs.url`
  - `package.json.homepage`
  - git `origin`
- Marketplace publish runs automatically when `main` contains a package version without a matching `v*` tag
- the workflow validates the dated changelog heading, packages and publishes the extension, then keeps the generated tag only when Marketplace publish succeeds

## Publisher Checklist

- Confirm Marketplace publisher exists for `emfpdlzj`
- Confirm you can authenticate with the publisher account
- Confirm the pinned `@vscode/vsce` version installs through `npm ci`
- Confirm the `VSCE_PAT` GitHub Actions secret exists before merging a new package version to `main`
- Prefer an Entra ID-based publishing path when the Marketplace supports it for this publisher
- If doing a one-off manual publish, confirm the current official authentication path you will use before release day

## Execution Log

Audit run on 2026-10-01 for `0.3.2`:

- `npm run ci:check`
  - passed
- `npm test`
  - passed, including telemetry client and proxy fixtures
- `npm audit`
  - passed with no known vulnerabilities
- `npm run package:check`
  - passed
  - package payload excludes source, test, proxy, and build-only files
  - output package: `dslforge-0.3.2.vsix`
- isolated VS Code profile install
  - passed
  - installed extension: `emfpdlzj.dslforge@0.3.2`
- GitHub release configuration
  - `VSCE_PAT` secret exists
  - `DSLFORGE_TELEMETRY_PROXY_ENDPOINT` variable exists

Audit run on 2026-06-15:

- `npm run typecheck`
  - passed
- `npm run test`
  - passed
- `npm exec -- vsce ls`
  - passed
  - packaged file list includes `dist/core/aiPreviewApplyService.js`
- `npm run test:ai-preview-apply`
  - passed
- `npm exec -- vsce package`
  - passed
  - output package: `dslforge-0.2.0.vsix`
  - packaged size: `167 KB`

Earlier audit notes on 2026-06-14:

- `git status --short`
  - `D  .agents/AGENTS.md`
  - `D  .agents/docs/project-spec.md`
  - `M  .gitignore`
  - `M  README.md`
- `npm run typecheck`
  - passed
- `npm run test`
  - passed
- `npm exec -- vsce package`
  - passed
  - output package: `dslforge-0.2.0.vsix`
  - packaged size after README screenshot assets: `2.51 MB`
- `npm exec -- vsce ls`
  - passed
- `git remote -v`
  - `origin` still points to `https://github.com/emfpdlzj/llm-grammer`

## Recommended Release Order

1. Finish the remaining manual VS Code smoke for Xtext and AI preview/apply.
2. Confirm Marketplace publisher access.
3. Re-run technical verification on the exact release candidate.
4. Review `git status` and staged diff for the intended release commit.
5. Package with `npm run package:check`.
6. Install the generated VSIX once more.
7. Publish intentionally with the confirmed publisher account.
8. Run promotion as a post-publish activity.
