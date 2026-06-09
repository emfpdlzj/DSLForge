import * as vscode from 'vscode';
import {
  appendGrammarAiReport,
  buildAiDocumentHeader,
  buildGrammarContextBlock,
  collectGrammarModelContext,
  requestTextFromModel
} from './grammarAiSupport';
import type { ResolvedProjectContext } from './projectService';

function buildExplanationPrompt(
  projectContext: ResolvedProjectContext,
  contextBlock: string
): string {
  return [
    'You are helping explain a Langium grammar inside VS Code.',
    'Explain the current grammar for a DSL author, not an end user.',
    'Be concrete and avoid generic AI filler.',
    '',
    'Return markdown with these sections exactly:',
    '1. Summary',
    '2. Key Rules',
    '3. Likely Intent',
    '4. Risks or Ambiguities',
    '5. Suggested Next Checks',
    '',
    'Requirements:',
    '- Focus on grammar structure and authoring implications.',
    '- Mention important parser rules, terminals, imports, and cross-reference implications when relevant.',
    '- Call out ambiguities, missing constraints, or maintainability risks if visible.',
    '- If evidence is limited, say so plainly.',
    '',
    `Workspace root: ${projectContext.workspaceFolder.uri.fsPath}`,
    `Adapter: ${projectContext.adapter.displayName}`,
    `Active grammar: ${projectContext.context.activeGrammarFile ?? 'none'}`,
    `Selected context files: ${projectContext.context.contextFiles.length > 0 ? projectContext.context.contextFiles.map((file) => file.filePath).join(', ') : 'none'}`,
    '',
    'Grammar context:',
    contextBlock
  ].join('\n');
}

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
      progressTitle: 'DSLForge is explaining the current grammar',
      justification:
        'Explain the current Langium grammar for the user inside DSLForge.',
      prompt: buildExplanationPrompt(projectContext, buildGrammarContextBlock(context))
    });

    const document = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: [
        buildAiDocumentHeader(
          'DSLForge Grammar Explanation',
          projectContext,
          model
        ),
        explanation
      ].join('\n')
    });

    await vscode.window.showTextDocument(document, {
      preview: false
    });
  }
}
