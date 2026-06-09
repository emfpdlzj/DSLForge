import * as vscode from 'vscode';
import { appendOutputDivider, appendOutputLine, showOutputChannel } from './outputChannel';
import type { ResolvedProjectContext } from './projectService';

interface GrammarContextFile {
  filePath: string;
  content: string;
  truncated: boolean;
}

interface GrammarExplanationContext {
  files: GrammarContextFile[];
  totalCharacters: number;
}

const MAX_CONTEXT_FILES = 3;
const MAX_CHARACTERS_PER_FILE = 8000;
const MAX_TOTAL_CHARACTERS = 20000;

function uniqueFilePaths(projectContext: ResolvedProjectContext): string[] {
  const orderedPaths = [
    projectContext.context.activeGrammarFile,
    ...projectContext.context.relatedFiles
  ].filter((value): value is string => Boolean(value));

  return [...new Set(orderedPaths)];
}

async function readFileContent(filePath: string): Promise<string> {
  const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
  return new TextDecoder('utf-8').decode(bytes);
}

async function collectGrammarContext(
  projectContext: ResolvedProjectContext
): Promise<GrammarExplanationContext> {
  const files: GrammarContextFile[] = [];
  let remainingCharacters = MAX_TOTAL_CHARACTERS;

  for (const filePath of uniqueFilePaths(projectContext).slice(0, MAX_CONTEXT_FILES)) {
    if (remainingCharacters <= 0) {
      break;
    }

    const rawContent = await readFileContent(filePath);
    const cappedLength = Math.min(
      rawContent.length,
      MAX_CHARACTERS_PER_FILE,
      remainingCharacters
    );
    const truncated = rawContent.length > cappedLength;
    const content = truncated
      ? `${rawContent.slice(0, cappedLength)}\n// DSLForge note: file content truncated for model context.`
      : rawContent;

    files.push({
      filePath,
      content,
      truncated
    });
    remainingCharacters -= content.length;
  }

  return {
    files,
    totalCharacters: MAX_TOTAL_CHARACTERS - remainingCharacters
  };
}

function buildExplanationPrompt(
  projectContext: ResolvedProjectContext,
  context: GrammarExplanationContext
): string {
  const filesBlock = context.files
    .map(
      (file, index) =>
        `## File ${index + 1}: ${file.filePath}\n` +
        `Truncated: ${file.truncated ? 'yes' : 'no'}\n` +
        '```langium\n' +
        `${file.content}\n` +
        '```'
    )
    .join('\n\n');

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
    `Related files: ${projectContext.context.relatedFiles.length > 0 ? projectContext.context.relatedFiles.join(', ') : 'none'}`,
    '',
    'Grammar context:',
    filesBlock
  ].join('\n');
}

function buildExplanationDocument(
  projectContext: ResolvedProjectContext,
  model: vscode.LanguageModelChat,
  explanation: string
): string {
  const generatedAt = new Date().toISOString();

  return [
    '# DSLForge Grammar Explanation',
    '',
    `- Generated at: ${generatedAt}`,
    `- Adapter: ${projectContext.adapter.displayName}`,
    `- Model: ${model.vendor}/${model.family} (${model.name})`,
    `- Active grammar: ${projectContext.context.activeGrammarFile ?? 'none'}`,
    '',
    explanation.trim()
  ].join('\n');
}

function appendExplanationReport(
  projectContext: ResolvedProjectContext,
  model: vscode.LanguageModelChat,
  context: GrammarExplanationContext
): void {
  appendOutputDivider('DSLForge Explain Current Grammar');
  appendOutputLine(`workspace: ${projectContext.workspaceFolder.uri.fsPath}`);
  appendOutputLine(`adapter: ${projectContext.adapter.displayName}`);
  appendOutputLine(`model: ${model.vendor}/${model.family} (${model.name})`);
  appendOutputLine(
    `active grammar: ${projectContext.context.activeGrammarFile ?? 'none'}`
  );
  appendOutputLine(`context files: ${context.files.length}`);
  appendOutputLine(`context characters: ${context.totalCharacters}`);

  for (const file of context.files) {
    appendOutputLine(
      `- file: ${file.filePath}${file.truncated ? ' (truncated)' : ''}`
    );
  }
}

function formatLanguageModelError(error: unknown): string {
  if (error instanceof vscode.LanguageModelError) {
    if (error.code === vscode.LanguageModelError.Blocked().code) {
      return 'The selected model is currently blocked by quota or policy limits.';
    }

    if (error.code === vscode.LanguageModelError.NoPermissions().code) {
      return 'Model access permission is not currently granted for this extension.';
    }

    if (error.code === vscode.LanguageModelError.NotFound().code) {
      return 'The selected model is no longer available. Retry after reselecting a model environment.';
    }

    return `Language model request failed: ${error.message}`;
  }

  if (error instanceof Error) {
    return `Language model request failed: ${error.message}`;
  }

  return 'Language model request failed for an unknown reason.';
}

export class GrammarExplanationService {
  public async explainCurrentGrammar(
    projectContext: ResolvedProjectContext,
    model: vscode.LanguageModelChat
  ): Promise<void> {
    const context = await collectGrammarContext(projectContext);
    appendExplanationReport(projectContext, model, context);

    const prompt = buildExplanationPrompt(projectContext, context);
    const explanation = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'DSLForge is explaining the current grammar',
        cancellable: false
      },
      async () => {
        try {
          const response = await model.sendRequest(
            [vscode.LanguageModelChatMessage.User(prompt)],
            {
              justification:
                'Explain the current Langium grammar for the user inside DSLForge.'
            }
          );

          let text = '';

          for await (const chunk of response.text) {
            text += chunk;
          }

          return text.trim();
        } catch (error) {
          const message = formatLanguageModelError(error);
          appendOutputLine(message);
          showOutputChannel();
          throw new Error(message);
        }
      }
    );

    const document = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: buildExplanationDocument(projectContext, model, explanation)
    });

    await vscode.window.showTextDocument(document, {
      preview: false
    });
  }
}
