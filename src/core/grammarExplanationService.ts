import * as vscode from 'vscode';
import {
  appendAiContractReport,
  appendGrammarAiReport,
  buildAiContractPrompt,
  buildAiDocumentHeader,
  buildGrammarContextBlock,
  collectGrammarModelContext,
  normalizeAiContractMarkdown,
  requestTextFromModel
} from './grammarAiSupport';
import type { ResolvedProjectContext } from './projectService';

const EXPLANATION_CONTRACT = {
  outputTitle: 'DSLForge Grammar Explanation',
  progressTitle: 'DSLForge is explaining the current grammar',
  justification: 'Explain the current Langium grammar for the user inside DSLForge.',
  systemIntent: [
    'You are helping explain a Langium grammar inside VS Code.',
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
    'Keep each section concise and specific to the visible grammar.'
  ]
} as const;

export class GrammarExplanationService {
  public async explainCurrentGrammar(
    projectContext: ResolvedProjectContext,
    model: vscode.LanguageModelChat
  ): Promise<void> {
    const context = await collectGrammarModelContext(projectContext);
    appendGrammarAiReport(
      'DSLForge Explain Current Grammar',
      projectContext,
      model,
      context
    );

    const explanation = await requestTextFromModel({
      model,
      progressTitle: EXPLANATION_CONTRACT.progressTitle,
      justification: EXPLANATION_CONTRACT.justification,
      prompt: buildAiContractPrompt(
        projectContext,
        buildGrammarContextBlock(context),
        EXPLANATION_CONTRACT
      )
    });
    const normalized = normalizeAiContractMarkdown(
      explanation,
      EXPLANATION_CONTRACT
    );
    appendAiContractReport(
      'DSLForge Explain Current Grammar Contract',
      EXPLANATION_CONTRACT,
      normalized.validation
    );

    const document = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: [
        buildAiDocumentHeader(
          EXPLANATION_CONTRACT.outputTitle,
          projectContext,
          model,
          [
            `Contract sections: ${EXPLANATION_CONTRACT.sections.join(', ')}`,
            `Contract status: ${normalized.validation.normalized ? 'normalized' : 'exact'}`
          ]
        ),
        normalized.markdown
      ].join('\n')
    });

    await vscode.window.showTextDocument(document, {
      preview: false
    });
  }
}
