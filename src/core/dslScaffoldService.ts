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

const SCAFFOLD_CONTRACT = {
  outputTitle: 'DSLForge DSL Scaffold Proposal',
  progressTitle: 'DSLForge is creating a DSL scaffold proposal',
  justification: 'Create a Langium-first DSL scaffold proposal for the user inside DSLForge.',
  previewOnly: true,
  systemIntent: [
    'You are helping design a Langium-first DSL scaffold inside VS Code.',
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
    'Focus on Langium-first project structure and authoring workflow.',
    'Keep file suggestions practical and minimal for v0.1.',
    'Include fenced code blocks for important starter file contents.',
    'Suggested Files should explain each file purpose in one sentence.',
    'package.json Scripts should propose concrete script names and commands.'
  ]
} as const;

export class DslScaffoldService {
  public async createDslScaffold(
    projectContext: ResolvedProjectContext,
    model: vscode.LanguageModelChat
  ): Promise<void> {
    const context = await collectGrammarModelContext(projectContext);
    appendGrammarAiReport(
      'DSLForge Create DSL Scaffold',
      projectContext,
      model,
      context
    );

    const scaffold = await requestTextFromModel({
      model,
      progressTitle: SCAFFOLD_CONTRACT.progressTitle,
      justification: SCAFFOLD_CONTRACT.justification,
      prompt: buildAiContractPrompt(
        projectContext,
        buildGrammarContextBlock(context),
        SCAFFOLD_CONTRACT
      )
    });
    const normalized = normalizeAiContractMarkdown(scaffold, SCAFFOLD_CONTRACT);
    appendAiContractReport(
      'DSLForge Create DSL Scaffold Contract',
      SCAFFOLD_CONTRACT,
      normalized.validation
    );

    const document = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: [
        buildAiDocumentHeader(
          SCAFFOLD_CONTRACT.outputTitle,
          projectContext,
          model,
          [
            'Preview only: DSLForge has not written any files.',
            `Contract sections: ${SCAFFOLD_CONTRACT.sections.join(', ')}`,
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
