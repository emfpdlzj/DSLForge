import * as vscode from 'vscode';
import { aiPreviewApplyService } from './aiPreviewApplyService';
import {
  appendAiContractReport,
  appendGrammarAiReport,
  buildAiContractPrompt,
  buildAiDocumentHeader,
  buildGrammarContextBlock,
  collectGrammarModelContext,
  getFrameworkPromptProfile,
  normalizeAiContractMarkdown,
  requestTextFromModel,
  type GrammarContextFile,
  type GrammarModelContext
} from './grammarAiSupport';
import { appendOutputDivider, appendOutputLine } from './outputChannel';
import type { ResolvedProjectContext, WorkspaceSelection } from './projectService';
import {
  buildScaffoldWorkspaceProfile,
  type ScaffoldWorkspaceProfile
} from './scaffoldWorkspaceProfile';

function createScaffoldContract(projectContext: ResolvedProjectContext) {
  const profile = getFrameworkPromptProfile(projectContext);

  return {
    outputTitle: 'DSLForge DSL Scaffold Proposal',
    progressTitle: 'DSLForge is creating a DSL scaffold proposal',
    justification: `Create a ${profile.frameworkLabel}-aware DSL scaffold proposal for the user inside DSLForge.`,
    previewOnly: true,
    systemIntent: [
      `You are helping design a ${profile.frameworkLabel}-aware DSL scaffold inside VS Code.`,
      'Produce a practical scaffold proposal for a DSL authoring project.',
      'Do not claim files already exist unless they are shown in context.',
      'Do not ask follow-up questions. Make reasonable assumptions and label them clearly.'
    ],
    sections: [
      'Scaffold Overview',
      'Suggested Files',
      'package.json Scripts',
      'Starter Grammar',
      'Implementation Notes',
      'Next Steps'
    ],
    requirements: [
      'This is a preview proposal, not an instruction to write files automatically.',
      'Keep file suggestions practical and minimal for an early implementation milestone.',
      'Include fenced code blocks for important starter file contents.',
      'When a fenced code block represents a proposed file, add a preceding line in the form `File Target: relative/path`.',
      'Suggested Files should explain each file purpose in one sentence.',
      'package.json Scripts should propose concrete script names and commands.',
      ...profile.scaffoldFocus
    ]
  } as const;
}

const BOOTSTRAP_SCAFFOLD_CONTRACT = {
  outputTitle: 'DSLForge DSL Scaffold Proposal',
  progressTitle: 'DSLForge is creating a DSL scaffold proposal',
  justification: 'Create a practical DSL scaffold proposal for the user inside DSLForge.',
  previewOnly: true,
  systemIntent: [
    'You are helping design a DSL scaffold inside VS Code.',
    'Produce a practical scaffold proposal for a DSL authoring project.',
    'Prefer the visible framework and toolchain when the workspace provides clear signals.',
    'If the workspace does not show a clear DSL framework, default to a pragmatic Langium-first TypeScript scaffold and state that assumption plainly.',
    'Do not claim files already exist unless they are shown in context.',
    'Do not ask follow-up questions. Make reasonable assumptions and label them clearly.'
  ],
  sections: [
    'Scaffold Overview',
    'Suggested Files',
    'Suggested Commands',
    'Starter Grammar',
    'Implementation Notes',
    'Next Steps'
  ],
  requirements: [
    'This is a preview proposal, not an instruction to write files automatically.',
    'Focus on a practical DSL project structure and authoring workflow.',
    'Keep file suggestions practical and minimal for an early implementation milestone.',
    'Include fenced code blocks for important starter file contents.',
    'Suggested Files should explain each file purpose in one sentence.',
    'Suggested Commands should propose concrete commands or scripts that match the visible package manager or build tool when possible.'
  ]
} as const;

const MAX_CONTEXT_FILES = 5;
const MAX_CHARACTERS_PER_FILE = 8000;
const MAX_TOTAL_CHARACTERS = 20000;

type ScaffoldTarget = ResolvedProjectContext | WorkspaceSelection;

function isResolvedProjectContext(
  target: ScaffoldTarget
): target is ResolvedProjectContext {
  return 'adapter' in target;
}

function getBootstrapContextLimits(
  workspaceFolder: vscode.WorkspaceFolder
): {
  maxContextFiles: number;
  maxCharactersPerFile: number;
  maxTotalCharacters: number;
} {
  const configuration = vscode.workspace.getConfiguration(
    'dslforge',
    workspaceFolder.uri
  );

  return {
    maxContextFiles: Math.max(
      configuration.get<number>('ai.maxContextFiles') ?? MAX_CONTEXT_FILES,
      1
    ),
    maxCharactersPerFile: Math.max(
      configuration.get<number>('ai.maxCharactersPerFile') ??
        MAX_CHARACTERS_PER_FILE,
      1000
    ),
    maxTotalCharacters: Math.max(
      configuration.get<number>('ai.maxContextCharacters') ??
        MAX_TOTAL_CHARACTERS,
      4000
    )
  };
}

function buildBootstrapPrompt(
  profile: ScaffoldWorkspaceProfile,
  contextBlock: string
): string {
  return [
    ...BOOTSTRAP_SCAFFOLD_CONTRACT.systemIntent,
    '',
    'Return markdown only.',
    'Use these section headings exactly and in this order:',
    ...BOOTSTRAP_SCAFFOLD_CONTRACT.sections.map(
      (section, index) => `${index + 1}. ## ${section}`
    ),
    '',
    'Requirements:',
    ...BOOTSTRAP_SCAFFOLD_CONTRACT.requirements.map(
      (requirement) => `- ${requirement}`
    ),
    '',
    ...profile.summaryLines,
    '',
    'Workspace context:',
    contextBlock
  ].join('\n');
}

function buildBootstrapDocumentHeader(
  profile: ScaffoldWorkspaceProfile,
  model: vscode.LanguageModelChat,
  metadata: string[] = []
): string {
  const generatedAt = new Date().toISOString();

  return [
    `# ${BOOTSTRAP_SCAFFOLD_CONTRACT.outputTitle}`,
    '',
    `- Generated at: ${generatedAt}`,
    '- Mode: bootstrap workspace scaffold',
    `- Framework hint: ${profile.frameworkHint}`,
    `- Framework hint reason: ${profile.frameworkReason}`,
    `- Model: ${model.vendor}/${model.family} (${model.name})`,
    `- Active file: ${profile.activeFile ?? 'none'}`,
    `- Detected package manager: ${profile.packageManager ?? 'none'}`,
    `- Detected build tools: ${profile.buildTools.length > 0 ? profile.buildTools.join(', ') : 'none'}`,
    ...metadata.map((line) => `- ${line}`),
    ''
  ].join('\n');
}

export class DslScaffoldService {
  public async createDslScaffold(
    target: ScaffoldTarget,
    model: vscode.LanguageModelChat
  ): Promise<void> {
    if (isResolvedProjectContext(target)) {
      await this.createDetectedDslScaffold(target, model);
      return;
    }

    await this.createBootstrapDslScaffold(target, model);
  }

  private async createDetectedDslScaffold(
    projectContext: ResolvedProjectContext,
    model: vscode.LanguageModelChat
  ): Promise<void> {
    const scaffoldContract = createScaffoldContract(projectContext);
    const context = await collectGrammarModelContext(projectContext);
    appendGrammarAiReport(
      'DSLForge Create DSL Scaffold',
      projectContext,
      model,
      context
    );

    const scaffold = await requestTextFromModel({
      model,
      progressTitle: scaffoldContract.progressTitle,
      justification: scaffoldContract.justification,
      prompt: buildAiContractPrompt(
        projectContext,
        buildGrammarContextBlock(context),
        scaffoldContract
      )
    });
    const normalized = normalizeAiContractMarkdown(scaffold, scaffoldContract);
    appendAiContractReport(
      'DSLForge Create DSL Scaffold Contract',
      scaffoldContract,
      normalized.validation
    );

    const document = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: [
        buildAiDocumentHeader(
          scaffoldContract.outputTitle,
          projectContext,
          model,
          [
            'Preview only: DSLForge has not written any files.',
            `Contract sections: ${scaffoldContract.sections.join(', ')}`,
            `Contract status: ${normalized.validation.normalized ? 'normalized' : 'exact'}`
          ]
        ),
        normalized.markdown
      ].join('\n')
    });

    await vscode.window.showTextDocument(document, {
      preview: false
    });
    aiPreviewApplyService.registerPreviewDocument(document, {
      featureName: 'Create DSL Scaffold',
      outputTitle: scaffoldContract.outputTitle,
      workspaceRoot: projectContext.workspaceFolder.uri.fsPath
    });
  }

  private async createBootstrapDslScaffold(
    workspaceSelection: WorkspaceSelection,
    model: vscode.LanguageModelChat
  ): Promise<void> {
    const profile = await buildScaffoldWorkspaceProfile({
      workspaceRoot: workspaceSelection.workspaceFolder.uri.fsPath,
      activeFile: workspaceSelection.activeFile
    });
    const context = await this.collectBootstrapModelContext(
      workspaceSelection.workspaceFolder,
      profile
    );

    appendOutputDivider('DSLForge Create DSL Scaffold');
    appendOutputLine(`workspace: ${profile.workspaceRoot}`);
    appendOutputLine('mode: bootstrap workspace scaffold');
    appendOutputLine(`framework hint: ${profile.frameworkHint}`);
    appendOutputLine(`framework hint reason: ${profile.frameworkReason}`);
    appendOutputLine(
      `model: ${model.vendor}/${model.family} (${model.name})`
    );
    appendOutputLine(`context files: ${context.files.length}`);
    appendOutputLine(`context characters: ${context.totalCharacters}`);

    for (const file of profile.contextFiles) {
      appendOutputLine(`- file: ${file.filePath} [${file.label}]`);
    }

    const scaffold = await requestTextFromModel({
      model,
      progressTitle: BOOTSTRAP_SCAFFOLD_CONTRACT.progressTitle,
      justification: BOOTSTRAP_SCAFFOLD_CONTRACT.justification,
      prompt: buildBootstrapPrompt(
        profile,
        buildGrammarContextBlock(context)
      )
    });
    const normalized = normalizeAiContractMarkdown(
      scaffold,
      BOOTSTRAP_SCAFFOLD_CONTRACT
    );
    appendAiContractReport(
      'DSLForge Create DSL Scaffold Contract',
      BOOTSTRAP_SCAFFOLD_CONTRACT,
      normalized.validation
    );

    const document = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: [
        buildBootstrapDocumentHeader(profile, model, [
          'Preview only: DSLForge has not written any files.',
          `Contract sections: ${BOOTSTRAP_SCAFFOLD_CONTRACT.sections.join(', ')}`,
          `Contract status: ${normalized.validation.normalized ? 'normalized' : 'exact'}`
        ]),
        normalized.markdown
      ].join('\n')
    });

    await vscode.window.showTextDocument(document, {
      preview: false
    });
    aiPreviewApplyService.registerPreviewDocument(document, {
      featureName: 'Create DSL Scaffold',
      outputTitle: BOOTSTRAP_SCAFFOLD_CONTRACT.outputTitle,
      workspaceRoot: workspaceSelection.workspaceFolder.uri.fsPath
    });
  }

  private async collectBootstrapModelContext(
    workspaceFolder: vscode.WorkspaceFolder,
    profile: ScaffoldWorkspaceProfile
  ): Promise<GrammarModelContext> {
    const files: GrammarContextFile[] = [];
    const limits = getBootstrapContextLimits(workspaceFolder);
    let remainingCharacters = limits.maxTotalCharacters;

    for (const file of profile.contextFiles.slice(0, limits.maxContextFiles)) {
      if (remainingCharacters <= 0) {
        break;
      }

      const rawContent = await this.readContextFile(file.filePath);
      const cappedLength = Math.min(
        rawContent.length,
        limits.maxCharactersPerFile,
        remainingCharacters
      );
      const truncated = rawContent.length > cappedLength;
      const content = truncated
        ? `${rawContent.slice(0, cappedLength)}\n// DSLForge note: file content truncated for model context.`
        : rawContent;

      files.push({
        filePath: `${file.filePath} [${file.label}]`,
        content,
        truncated,
        languageId: file.languageId
      });
      remainingCharacters -= content.length;
    }

    return {
      files,
      totalCharacters: limits.maxTotalCharacters - remainingCharacters
    };
  }

  private async readContextFile(filePath: string): Promise<string> {
    const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
    return new TextDecoder('utf-8').decode(bytes);
  }
}
