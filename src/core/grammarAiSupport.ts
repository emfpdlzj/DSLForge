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

export interface AiDocumentContract {
  outputTitle: string;
  progressTitle: string;
  justification: string;
  systemIntent: readonly string[];
  sections: readonly string[];
  requirements: readonly string[];
  previewOnly?: boolean;
}

export interface AiDocumentContractValidation {
  missingSections: string[];
  unexpectedSections: string[];
  normalized: boolean;
}

const MAX_CONTEXT_FILES = 5;
const MAX_CHARACTERS_PER_FILE = 8000;
const MAX_TOTAL_CHARACTERS = 20000;

function getAiContextLimits(projectContext: ResolvedProjectContext): {
  maxContextFiles: number;
  maxCharactersPerFile: number;
  maxTotalCharacters: number;
} {
  const configuration = vscode.workspace.getConfiguration(
    'dslforge',
    projectContext.workspaceFolder.uri
  );

  return {
    maxContextFiles: Math.max(
      configuration.get<number>('ai.maxContextFiles') ?? MAX_CONTEXT_FILES,
      1
    ),
    maxCharactersPerFile: Math.max(
      configuration.get<number>('ai.maxCharactersPerFile') ?? MAX_CHARACTERS_PER_FILE,
      1000
    ),
    maxTotalCharacters: Math.max(
      configuration.get<number>('ai.maxContextCharacters') ?? MAX_TOTAL_CHARACTERS,
      4000
    )
  };
}

function buildProjectContextSummary(projectContext: ResolvedProjectContext): string[] {
  return [
    `Workspace root: ${projectContext.workspaceFolder.uri.fsPath}`,
    `Adapter: ${projectContext.adapter.displayName}`,
    `Active grammar: ${projectContext.context.activeGrammarFile ?? 'none'}`,
    `Selected context files: ${projectContext.context.contextFiles.length > 0 ? projectContext.context.contextFiles.map((file) => file.filePath).join(', ') : 'none'}`
  ];
}

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
  const limits = getAiContextLimits(projectContext);
  let remainingCharacters = limits.maxTotalCharacters;
  const selections = selectionByPath(projectContext);

  for (const filePath of uniqueFilePaths(projectContext).slice(0, limits.maxContextFiles)) {
    if (remainingCharacters <= 0) {
      break;
    }

    const rawContent = await readFileContent(filePath);
    const cappedLength = Math.min(
      rawContent.length,
      limits.maxCharactersPerFile,
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
    totalCharacters: limits.maxTotalCharacters - remainingCharacters
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

export function buildAiContractPrompt(
  projectContext: ResolvedProjectContext,
  contextBlock: string,
  contract: AiDocumentContract
): string {
  return [
    ...contract.systemIntent,
    '',
    'Return markdown only.',
    'Use these section headings exactly and in this order:',
    ...contract.sections.map((section, index) => `${index + 1}. ## ${section}`),
    '',
    'Requirements:',
    ...contract.requirements.map((requirement) => `- ${requirement}`),
    '',
    ...buildProjectContextSummary(projectContext),
    '',
    'Grammar context:',
    contextBlock
  ].join('\n');
}

function extractMarkdownHeading(line: string): string | undefined {
  const match = /^(?:#{1,6})\s+(?<heading>.+?)\s*$/.exec(line.trim());
  return match?.groups?.heading?.trim();
}

export function normalizeAiContractMarkdown(
  rawMarkdown: string,
  contract: AiDocumentContract
): {
  markdown: string;
  validation: AiDocumentContractValidation;
} {
  const lines = rawMarkdown.split(/\r?\n/);
  const expectedSections = new Set(contract.sections);
  const sectionContent = new Map<string, string[]>();
  const unexpectedSections: string[] = [];
  const preamble: string[] = [];
  let currentSection: string | undefined;

  for (const section of contract.sections) {
    sectionContent.set(section, []);
  }

  for (const line of lines) {
    const heading = extractMarkdownHeading(line);

    if (heading) {
      if (expectedSections.has(heading)) {
        currentSection = heading;
        continue;
      }

      unexpectedSections.push(heading);

      if (currentSection) {
        sectionContent.get(currentSection)?.push(line);
      } else {
        preamble.push(line);
      }

      continue;
    }

    if (currentSection) {
      sectionContent.get(currentSection)?.push(line);
    } else {
      preamble.push(line);
    }
  }

  const missingSections = contract.sections.filter((section) => {
    const joined = sectionContent.get(section)?.join('\n').trim() ?? '';
    return joined.length === 0;
  });
  const normalized = preamble.join('\n').trim().length > 0 || missingSections.length > 0 || unexpectedSections.length > 0;
  const carryover = preamble.join('\n').trim();
  let carryoverConsumed = false;

  const markdown = contract.sections
    .map((section, index) => {
      const explicitContent = sectionContent.get(section)?.join('\n').trim() ?? '';
      const fallbackContent =
        !carryoverConsumed && carryover.length > 0
          ? carryover
          : '_Model response did not provide this section explicitly._';
      const content = explicitContent || fallbackContent;

      if (!explicitContent && !carryoverConsumed && carryover.length > 0) {
        carryoverConsumed = true;
      }

      const suffix =
        index === contract.sections.length - 1 && unexpectedSections.length > 0
          ? `\n\nAdditional unstructured headings seen in model output: ${[
              ...new Set(unexpectedSections)
            ].join(', ')}.`
          : '';

      return [`## ${section}`, '', `${content}${suffix}`.trim()].join('\n');
    })
    .join('\n\n');

  return {
    markdown,
    validation: {
      missingSections,
      unexpectedSections: [...new Set(unexpectedSections)],
      normalized
    }
  };
}

export function appendAiContractReport(
  title: string,
  contract: AiDocumentContract,
  validation: AiDocumentContractValidation
): void {
  appendOutputDivider(title);
  appendOutputLine(`expected sections: ${contract.sections.join(', ')}`);
  appendOutputLine(
    `contract status: ${validation.normalized ? 'normalized after model response drift' : 'exact'}`
  );

  if (validation.missingSections.length > 0) {
    appendOutputLine(`missing sections: ${validation.missingSections.join(', ')}`);
  }

  if (validation.unexpectedSections.length > 0) {
    appendOutputLine(
      `unexpected sections: ${validation.unexpectedSections.join(', ')}`
    );
  }
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
  model: vscode.LanguageModelChat,
  metadata: string[] = []
): string {
  const generatedAt = new Date().toISOString();

  return [
    `# ${title}`,
    '',
    `- Generated at: ${generatedAt}`,
    `- Adapter: ${projectContext.adapter.displayName}`,
    `- Model: ${model.vendor}/${model.family} (${model.name})`,
    `- Active grammar: ${projectContext.context.activeGrammarFile ?? 'none'}`,
    ...metadata.map((line) => `- ${line}`),
    ''
  ].join('\n');
}
