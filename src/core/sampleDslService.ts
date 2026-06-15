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

const SAMPLE_DSL_CONTRACT = {
  outputTitle: 'DSLForge Sample DSL Generation',
  progressTitle: 'DSLForge is generating sample DSL text',
  justification: 'Generate sample DSL inputs from the current Langium grammar inside DSLForge.',
  previewOnly: true,
  systemIntent: [
    'You are generating sample DSL texts from a Langium grammar inside VS Code.',
    'Generate realistic example inputs for a DSL author who is validating and refining the grammar.',
    'Do not pretend to know constraints that are not visible in the grammar.'
  ],
  sections: [
    'Reading of the Grammar',
    'Sample 1',
    'Sample 2',
    'Sample 3',
    'Edge Cases to Try'
  ],
  requirements: [
    'Put each sample in its own fenced code block.',
    'Vary the samples: one minimal, one representative, one more complex.',
    'If the grammar appears ambiguous or incomplete, mention that plainly.',
    'Keep samples plausible for the grammar that is shown, even if some assumptions are required.',
    'Prefer output that can be copied directly into a sample file for validation.'
  ]
} as const;

export class SampleDslService {
  public async generateSampleDsl(
    projectContext: ResolvedProjectContext,
    model: vscode.LanguageModelChat
  ): Promise<void> {
    const context = await collectGrammarModelContext(projectContext);
    appendGrammarAiReport(
      'DSLForge Generate Sample DSL',
      projectContext,
      model,
      context
    );

    const samples = await requestTextFromModel({
      model,
      progressTitle: SAMPLE_DSL_CONTRACT.progressTitle,
      justification: SAMPLE_DSL_CONTRACT.justification,
      prompt: buildAiContractPrompt(
        projectContext,
        buildGrammarContextBlock(context),
        SAMPLE_DSL_CONTRACT
      )
    });
    const normalized = normalizeAiContractMarkdown(
      samples,
      SAMPLE_DSL_CONTRACT
    );
    appendAiContractReport(
      'DSLForge Generate Sample DSL Contract',
      SAMPLE_DSL_CONTRACT,
      normalized.validation
    );

    const document = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: [
        buildAiDocumentHeader(
          SAMPLE_DSL_CONTRACT.outputTitle,
          projectContext,
          model,
          [
            'Preview only: review the samples before using them.',
            `Contract sections: ${SAMPLE_DSL_CONTRACT.sections.join(', ')}`,
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
