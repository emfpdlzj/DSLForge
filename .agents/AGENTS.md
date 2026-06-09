# DSLForge Agent Notes

## Working Rules

- 부정확한 정보는 추정하지 말고 확인한다.
- 사용자가 명시적으로 요청하지 않으면 `git commit`, `git push` 하지 않는다.
- 임시보완책보다 실무적으로 유지 가능한 방향을 우선한다.

## Product Baseline

- 제품명: `DSLForge`
- 포지셔닝: `DSL authoring workflow assistant, starting with Langium`
- v0.1 지원 범위: Langium only
- 확장 방향:
  - v0.2: ANTLR4
  - v0.3: Xtext
  - v0.4: Generic mode
- 핵심 원칙:
  - generic AI generator로 만들지 않는다
  - validation은 workspace의 실제 command를 우선 사용한다
  - `Validate Current Grammar`는 AI 없이 동작해야 한다
  - AI 기능은 model access가 없으면 즉시 중단하고 안내한다

## Current Implementation Status

### Naming / Identity

- `LangForge/langforge` -> `DSLForge/dslforge` 변경 완료
- package name: `dslforge`
- display name: `DSLForge`
- command prefix: `dslforge.*`
- GitHub URL: `https://github.com/emfpdlzj/DSLForge`

### Commands

- `DSLForge: Validate Current Grammar`
- `DSLForge: Explain Current Grammar`
- `DSLForge: Create DSL Scaffold`
- `DSLForge: Generate Sample DSL`

현재 command title은 `category=DSLForge` + title 본문만 보이도록 정리되어 있다.
이전의 `DSLForge: DSLForge: ...` 중복 표기는 수정 완료.

### Core Architecture

- `src/core`
  - adapter contract
  - project detection / adapter resolution
  - context selection orchestration
  - validation orchestration
  - diagnostics presentation
  - AI gate / AI support services
- `src/langium`
  - Langium project detection
  - Langium context selection
  - Langium diagnostics interpretation
- `src/commands`
  - VS Code command entrypoint
  - 실제 로직은 core/service 경유

### Langium Detection

Langium workspace detection은 아래 신호를 조합한다.

- active `.langium` file
- workspace 내 `.langium` files
- `langium-config.json`
- `package.json`의 `dependencies/devDependencies.langium`
- Langium 관련 script 이름 또는 script command

### Context Selection

Langium context selection은 아래 순서로 구성된다.

- active grammar
- grammar `import` chain으로 연결된 `.langium`
- `langium-config.json`
- `package.json`
- sibling/configured grammar files

### Validation

우선순위:

1. `dslforge.validation.command`
2. auto-detected `package.json` script
3. 설정 필요 안내

추가 구현 상태:

- cancellable progress
- workspace별 concurrent run 방지
- stdout/stderr capture + truncation control
- Output Channel report
- Problems 반영
- Quick Fix
  - validation setting 열기
  - workspace `package.json` 열기

### Diagnostics

- generic parser + Langium-specific parser 구현됨
- `file:line:column`
- `file(line,column)`
- TS error code
- webpack / `[tsl]` block
- unlocated Langium/TypeScript errors 일부 정규화

### AI Features

- gate 구현 완료
  - VS Code LM / Copilot access 확인
  - 없으면 중단 + 안내
- `Explain Current Grammar`
  - Markdown preview 문서 생성
- `Create DSL Scaffold`
  - Markdown preview proposal 생성
- `Generate Sample DSL`
  - Markdown preview example 생성
- output contract normalization 적용됨

중요:

- 현재 `Create DSL Scaffold`도 Langium workspace detection을 통과해야 실행된다.
- 제품적으로 이 요구사항을 완화할지는 추후 판단 대상이다.

## Workspace Trust / VS Code Version

- `package.json`의 `engines.vscode`는 `^1.120.0`
- `capabilities.untrustedWorkspaces.supported = "limited"`
- Restricted Mode에서는 guidance를 띄우고 차단해야 하는 흐름이 들어가 있다

## Packaging / Installation

- `.vscodeignore` 추가 완료
- `LICENSE` 추가 완료
- extension icon 설정 완료
  - `media/icon.png`
  - `package.json`의 `"icon": "media/icon.png"`
- 현재 VSIX 산출물:
  - `dslforge-0.0.1.vsix`

패키징 시 포함되어야 하는 것은 사실상:

- `dist/**`
- `package.json`
- `README.md`
- `LICENSE`
- `media/icon.png`

## Manual Smoke Results

설치형 `.vsix` smoke 기준 확인된 것:

- VSIX 패키징 성공
- 로컬 VS Code 설치 성공
- Command Palette에 DSLForge command 4개 노출 확인
- `Validate Current Grammar` 실행 확인
  - workspace 미감지 안내 정상
  - `configured-command` fixture에서 configured validation command 선택 정상
  - validation failure 진단/알림/Output/Problems 반영 확인

주의:

- `--extensions-dir`, `--user-data-dir`를 강제로 분리하는 CLI smoke는 이 머신에서 VS Code 동작이 일관되지 않았다.
- 신뢰 가능한 설치형 검증은 결국 기본 VS Code extension 경로에 VSIX를 설치해서 확인했다.

## Test Assets

Langium fixture:

- `test-fixtures/langium/configured-command`
- `test-fixtures/langium/package-script`
- `test-fixtures/langium/missing-command`
- `test-fixtures/langium/import-context`

Diagnostics fixture:

- `test-fixtures/diagnostics/*`

Manual smoke docs:

- `docs/manual-smoke-validation.md`
- `docs/manual-smoke-ai.md`

## Validation / Regression Commands

- `npm run typecheck`
- `npm run test`
- `npm run test:diagnostics`
- `npm run test:projects`
- `npm run test:manifest`
- `npm exec -- vsce package`

## Important Files

- `package.json`
- `.vscodeignore`
- `src/extension.ts`
- `src/core/validationOrchestrator.ts`
- `src/core/validationCommandResolver.ts`
- `src/core/diagnosticsPresenter.ts`
- `src/core/aiCommandGate.ts`
- `src/core/grammarAiSupport.ts`
- `src/langium/adapter.ts`
- `src/langium/projectDetection.ts`
- `src/langium/contextSelection.ts`

## Open Product / Engineering Questions

1. `Create DSL Scaffold`가 Langium workspace detection을 반드시 요구해야 하는가
2. AI 결과물을 preview-only에서 accept/write flow로 확장할 것인가
3. Langium 전용 detection/context policy를 어디까지 강화할 것인가
4. v0.2 ANTLR4 adapter 착수 전에 adapter contract를 더 분리할 필요가 있는가

## Suggested Next Steps

1. `Create DSL Scaffold` 실행 전제 완화 여부 결정
2. README에 실제 사용 흐름과 fixture 기반 테스트 방법 보강
3. 설치형 smoke를 기준으로 AI 3개 command의 수동 검증 추가
4. release 전 versioning / changelog / Marketplace metadata 정리
