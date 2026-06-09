import * as vscode from 'vscode';
import {
  appendGrammarAiReport,
  buildAiDocumentHeader,
  buildGrammarContextBlock,
  collectGrammarModelContext,
  requestTextFromModel
} from './grammarAiSupport';
import type { ResolvedProjectContext } from './projectService';

function buildSampleDslPrompt(
  projectContext: ResolvedProjectContext,
  contextBlock: string
): string {
  return [
    'You are generating sample DSL texts from a Langium grammar inside VS Code.',
    'Generate realistic example inputs for a DSL author who is validating and refining the grammar.',
    'Do not pretend to know constraints that are not visible in the grammar.',
    '',
    'Return markdown with these sections exactly:',
    '1. Reading of the Grammar',
    '2. Sample 1',
    '3. Sample 2',
    '4. Sample 3',
    '5. Edge Cases to Try',
    '',
    'Requirements:',
    '- Put each sample in its own fenced code block.',
    '- Vary the samples: one minimal, one representative, one more complex.',
    '- If the grammar appears ambiguous or incomplete, mention that before or after the sample.',
    '- Keep samples plausible for the grammar that is shown, even if some assumptions are required.',
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
      progressTitle: 'DSLForge is generating sample DSL text',
      justification:
        'Generate sample DSL inputs from the current Langium grammar inside DSLForge.',
      prompt: buildSampleDslPrompt(projectContext, buildGrammarContextBlock(context))
    });

    const document = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: [
        buildAiDocumentHeader(
          'DSLForge Sample DSL Generation',
          projectContext,
          model
        ),
        samples
      ].join('\n')
    });

    await vscode.window.showTextDocument(document, {
      preview: false
    });
  }
}
