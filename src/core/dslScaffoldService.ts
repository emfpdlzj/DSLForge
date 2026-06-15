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
  requestTextFromModel
} from './grammarAiSupport';
import type { ResolvedProjectContext } from './projectService';

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
      'Suggested Files should explain each file purpose in one sentence.',
      'package.json Scripts should propose concrete script names and commands.',
      ...profile.scaffoldFocus
    ]
  } as const;
}

export class DslScaffoldService {
  public async createDslScaffold(
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
}
