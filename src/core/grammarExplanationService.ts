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

function createExplanationContract(projectContext: ResolvedProjectContext) {
  const profile = getFrameworkPromptProfile(projectContext);

  return {
    outputTitle: 'DSLForge Grammar Explanation',
    progressTitle: 'DSLForge is explaining the current grammar',
    justification: `Explain the current ${profile.frameworkLabel} grammar for the user inside DSLForge.`,
    systemIntent: [
      `You are helping explain a ${profile.frameworkLabel} grammar inside VS Code.`,
      'Explain the current grammar for a DSL author, not an end user.',
      'Be concrete and avoid generic AI filler.'
    ],
    sections: [
      'Summary',
      'Key Rules',
      'Likely Intent',
      'Risks or Ambiguities',
      'Suggested Next Checks'
    ],
    requirements: [
      'Focus on grammar structure and authoring implications.',
      'Mention important parser rules, terminals, imports, and cross-reference implications when relevant.',
      'Call out ambiguities, missing constraints, or maintainability risks if visible.',
      'If evidence is limited, say so plainly.',
      'Keep each section concise and specific to the visible grammar.',
      ...profile.explanationFocus
    ]
  } as const;
}

export class GrammarExplanationService {
  public async explainCurrentGrammar(
    projectContext: ResolvedProjectContext,
    model: vscode.LanguageModelChat
  ): Promise<void> {
    const explanationContract = createExplanationContract(projectContext);
    const context = await collectGrammarModelContext(projectContext);
    appendGrammarAiReport(
      'DSLForge Explain Current Grammar',
      projectContext,
      model,
      context
    );

    const explanation = await requestTextFromModel({
      model,
      progressTitle: explanationContract.progressTitle,
      justification: explanationContract.justification,
      prompt: buildAiContractPrompt(
        projectContext,
        buildGrammarContextBlock(context),
        explanationContract
      )
    });
    const normalized = normalizeAiContractMarkdown(
      explanation,
      explanationContract
    );
    appendAiContractReport(
      'DSLForge Explain Current Grammar Contract',
      explanationContract,
      normalized.validation
    );

    const document = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: [
        buildAiDocumentHeader(
          explanationContract.outputTitle,
          projectContext,
          model,
          [
            `Contract sections: ${explanationContract.sections.join(', ')}`,
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
      featureName: 'Explain Current Grammar',
      outputTitle: explanationContract.outputTitle,
      workspaceRoot: projectContext.workspaceFolder.uri.fsPath
    });
  }
}
