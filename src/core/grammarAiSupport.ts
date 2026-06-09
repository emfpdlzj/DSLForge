import * as vscode from 'vscode';
import { appendOutputDivider, appendOutputLine, showOutputChannel } from './outputChannel';
import type { ResolvedProjectContext } from './projectService';
import type { GrammarContextFileSelection } from '../types';

export interface GrammarContextFile {
  filePath: string;
  content: string;
  truncated: boolean;
  languageId: string;
}

export interface GrammarModelContext {
  files: GrammarContextFile[];
  totalCharacters: number;
}

export interface ModelTextRequest {
  model: vscode.LanguageModelChat;
  progressTitle: string;
  justification: string;
  prompt: string;
}

const MAX_CONTEXT_FILES = 5;
const MAX_CHARACTERS_PER_FILE = 8000;
const MAX_TOTAL_CHARACTERS = 20000;

function uniqueFilePaths(projectContext: ResolvedProjectContext): string[] {
  return [
    ...new Set(projectContext.context.contextFiles.map((file) => file.filePath))
  ];
}

function selectionByPath(
  projectContext: ResolvedProjectContext
): Map<string, GrammarContextFileSelection> {
  return new Map(
    projectContext.context.contextFiles.map((file) => [file.filePath, file])
  );
}

async function readFileContent(filePath: string): Promise<string> {
  const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
  return new TextDecoder('utf-8').decode(bytes);
}

export async function collectGrammarModelContext(
  projectContext: ResolvedProjectContext
): Promise<GrammarModelContext> {
  const files: GrammarContextFile[] = [];
  let remainingCharacters = MAX_TOTAL_CHARACTERS;
  const selections = selectionByPath(projectContext);

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
    const selection = selections.get(filePath);

    files.push({
      filePath:
        selection?.detail
          ? `${filePath} [${selection.kind}: ${selection.detail}]`
          : selection
            ? `${filePath} [${selection.kind}]`
            : filePath,
      content,
      truncated,
      languageId: selection?.languageId ?? 'text'
    });
    remainingCharacters -= content.length;
  }

  return {
    files,
    totalCharacters: MAX_TOTAL_CHARACTERS - remainingCharacters
  };
}

export function buildGrammarContextBlock(context: GrammarModelContext): string {
  if (context.files.length === 0) {
    return 'No grammar files were available in the current context.';
  }

  return context.files
    .map(
      (file, index) =>
        `## File ${index + 1}: ${file.filePath}\n` +
        `Truncated: ${file.truncated ? 'yes' : 'no'}\n` +
        `\`\`\`${file.languageId}\n` +
        `${file.content}\n` +
        '```'
    )
    .join('\n\n');
}

export function appendGrammarAiReport(
  title: string,
  projectContext: ResolvedProjectContext,
  model: vscode.LanguageModelChat,
  context: GrammarModelContext
): void {
  appendOutputDivider(title);
  appendOutputLine(`workspace: ${projectContext.workspaceFolder.uri.fsPath}`);
  appendOutputLine(`adapter: ${projectContext.adapter.displayName}`);
  appendOutputLine(`model: ${model.vendor}/${model.family} (${model.name})`);
  appendOutputLine(
    `active grammar: ${projectContext.context.activeGrammarFile ?? 'none'}`
  );
  appendOutputLine(`context files: ${context.files.length}`);
  appendOutputLine(`context characters: ${context.totalCharacters}`);

  for (const file of projectContext.context.contextFiles) {
    appendOutputLine(
      `- file: ${file.filePath} [${file.kind}]${file.detail ? ` (${file.detail})` : ''}`
    );
  }
}

export function formatLanguageModelError(error: unknown): string {
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

export async function requestTextFromModel(
  request: ModelTextRequest
): Promise<string> {
  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: request.progressTitle,
      cancellable: false
    },
    async () => {
      try {
        const response = await request.model.sendRequest(
          [vscode.LanguageModelChatMessage.User(request.prompt)],
          {
            justification: request.justification
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
}

export function buildAiDocumentHeader(
  title: string,
  projectContext: ResolvedProjectContext,
  model: vscode.LanguageModelChat
): string {
  const generatedAt = new Date().toISOString();

  return [
    `# ${title}`,
    '',
    `- Generated at: ${generatedAt}`,
    `- Adapter: ${projectContext.adapter.displayName}`,
    `- Model: ${model.vendor}/${model.family} (${model.name})`,
    `- Active grammar: ${projectContext.context.activeGrammarFile ?? 'none'}`,
    ''
  ].join('\n');
}
