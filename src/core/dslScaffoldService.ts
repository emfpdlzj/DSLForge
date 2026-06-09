import * as vscode from 'vscode';
import {
  appendGrammarAiReport,
  buildAiDocumentHeader,
  buildGrammarContextBlock,
  collectGrammarModelContext,
  requestTextFromModel
} from './grammarAiSupport';
import type { ResolvedProjectContext } from './projectService';

function buildScaffoldPrompt(
  projectContext: ResolvedProjectContext,
  contextBlock: string
): string {
  return [
    'You are helping design a Langium-first DSL scaffold inside VS Code.',
    'Produce a practical scaffold proposal for a DSL authoring project.',
    'Do not claim files already exist unless they are shown in context.',
    'Do not ask follow-up questions. Make reasonable assumptions and label them clearly.',
    '',
    'Return markdown with these sections exactly:',
    '1. Scaffold Overview',
    '2. Suggested Files',
    '3. package.json Scripts',
    '4. Starter Grammar',
    '5. Implementation Notes',
    '6. Next Steps',
    '',
    'Requirements:',
    '- This is a preview proposal, not an instruction to write files automatically.',
    '- Focus on Langium-first project structure and authoring workflow.',
    '- Keep file suggestions practical and minimal for v0.1.',
    '- Include fenced code blocks for important starter file contents.',
    '- Suggested Files should explain each file purpose in one sentence.',
    '',
    `Workspace root: ${projectContext.workspaceFolder.uri.fsPath}`,
    `Adapter: ${projectContext.adapter.displayName}`,
    `Active grammar: ${projectContext.context.activeGrammarFile ?? 'none'}`,
    `Related files: ${projectContext.context.relatedFiles.length > 0 ? projectContext.context.relatedFiles.join(', ') : 'none'}`,
    '',
    'Grammar context:',
    contextBlock
  ].join('\n');
}

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
      progressTitle: 'DSLForge is creating a DSL scaffold proposal',
      justification:
        'Create a Langium-first DSL scaffold proposal for the user inside DSLForge.',
      prompt: buildScaffoldPrompt(projectContext, buildGrammarContextBlock(context))
    });

    const document = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: [
        buildAiDocumentHeader(
          'DSLForge DSL Scaffold Proposal',
          projectContext,
          model
        ),
        '> Preview only. DSLForge has not written any files.',
        '',
        scaffold
      ].join('\n')
    });

    await vscode.window.showTextDocument(document, {
      preview: false
    });
  }
}
