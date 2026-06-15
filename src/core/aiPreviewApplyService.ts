import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import {
  appendOutputDivider,
  appendOutputLine,
  showOutputChannel
} from './outputChannel';

export const APPLY_AI_PREVIEW_TO_WORKSPACE_COMMAND =
  'dslforge.applyAiPreviewToWorkspace';
export const COMPLETE_AI_PREVIEW_APPLY_COMMAND =
  'dslforge.completeAiPreviewApply';

interface AiPreviewDocumentRegistration {
  featureName: string;
  outputTitle: string;
  workspaceRoot: string;
}

interface PendingAiPreviewApplySession {
  draftUri: vscode.Uri;
  targetUri: vscode.Uri;
  workspaceRoot: string;
  featureName: string;
  selectionLabel: string;
  content: string;
  targetRelativePath: string;
  targetSnapshot?: string;
}

interface PreviewSelection {
  label: string;
  description: string;
  detail?: string;
  content: string;
  suggestedRelativePath: string;
}

interface CodeBlockSelection {
  heading?: string;
  languageId: string;
  content: string;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function toDocumentKey(uri: vscode.Uri): string {
  return uri.toString();
}

function buildDocumentRange(document: vscode.TextDocument): vscode.Range {
  const lastLine = Math.max(document.lineCount - 1, 0);
  const lastCharacter = document.lineAt(lastLine).text.length;

  return new vscode.Range(0, 0, lastLine, lastCharacter);
}

function getSectionHeading(line: string): string | undefined {
  const match = /^##\s+(?<heading>.+?)\s*$/.exec(line.trim());
  return match?.groups?.heading?.trim();
}

function extractBodyMarkdown(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const bodyStartIndex = lines.findIndex((line) => line.trim().startsWith('## '));

  if (bodyStartIndex < 0) {
    return markdown.trim();
  }

  return lines.slice(bodyStartIndex).join('\n').trim();
}

function extractCodeBlockSelections(markdown: string): CodeBlockSelection[] {
  const lines = markdown.split(/\r?\n/);
  const selections: CodeBlockSelection[] = [];
  let currentHeading: string | undefined;
  let inCodeBlock = false;
  let currentLanguageId = '';
  let currentCodeLines: string[] = [];

  for (const line of lines) {
    const heading = getSectionHeading(line);

    if (!inCodeBlock && heading) {
      currentHeading = heading;
      continue;
    }

    const fenceMatch = /^```(?<languageId>[a-zA-Z0-9_-]*)\s*$/.exec(line.trim());

    if (fenceMatch) {
      if (inCodeBlock) {
        selections.push({
          heading: currentHeading,
          languageId: currentLanguageId,
          content: currentCodeLines.join('\n').trimEnd()
        });
        inCodeBlock = false;
        currentLanguageId = '';
        currentCodeLines = [];
      } else {
        inCodeBlock = true;
        currentLanguageId = fenceMatch.groups?.languageId?.trim() ?? '';
      }

      continue;
    }

    if (inCodeBlock) {
      currentCodeLines.push(line);
    }
  }

  return selections.filter((selection) => selection.content.length > 0);
}

function extensionForLanguageId(languageId: string): string {
  switch (languageId.toLowerCase()) {
    case 'json':
      return '.json';
    case 'xml':
      return '.xml';
    case 'markdown':
      return '.md';
    case 'langium':
      return '.langium';
    case 'antlr':
      return '.g4';
    case 'xtext':
      return '.xtext';
    case 'typescript':
      return '.ts';
    case 'javascript':
      return '.js';
    case 'shell':
    case 'bash':
    case 'sh':
      return '.sh';
    default:
      return '.txt';
  }
}

function buildSelectionSuggestions(
  registration: AiPreviewDocumentRegistration,
  markdown: string
): PreviewSelection[] {
  const documentSlug = slugify(registration.outputTitle || registration.featureName);
  const selections: PreviewSelection[] = [
    {
      label: 'Entire Preview Document',
      description: 'Write the full markdown preview, including the DSLForge header.',
      content: markdown.trim(),
      suggestedRelativePath: `docs/${documentSlug}.md`
    }
  ];
  const bodyMarkdown = extractBodyMarkdown(markdown);

  if (bodyMarkdown.length > 0 && bodyMarkdown !== markdown.trim()) {
    selections.push({
      label: 'Preview Body Only',
      description: 'Write the markdown body without the generated DSLForge header block.',
      content: bodyMarkdown,
      suggestedRelativePath: `docs/${documentSlug}.md`
    });
  }

  const codeBlockSelections = extractCodeBlockSelections(markdown);

  for (const [index, selection] of codeBlockSelections.entries()) {
    const extension = extensionForLanguageId(selection.languageId);
    const featureSlug = slugify(registration.featureName);
    const folderName =
      registration.featureName.includes('Sample DSL')
        ? 'examples'
        : registration.featureName.includes('Scaffold')
          ? 'drafts'
          : 'docs';
    const description = selection.heading
      ? `Code block from ${selection.heading}`
      : 'Code block from preview document';

    selections.push({
      label: `Code Block ${index + 1}`,
      description,
      detail: selection.languageId
        ? `language: ${selection.languageId}`
        : 'language: plain text',
      content: selection.content,
      suggestedRelativePath: `${folderName}/${featureSlug}-${index + 1}${extension}`
    });
  }

  return selections;
}

async function readTextFile(targetUri: vscode.Uri): Promise<string | undefined> {
  try {
    const bytes = await vscode.workspace.fs.readFile(targetUri);
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return undefined;
  }
}

function resolveWorkspaceTargetPath(
  workspaceRoot: string,
  relativePath: string
): vscode.Uri | undefined {
  if (!relativePath.trim() || path.isAbsolute(relativePath)) {
    return undefined;
  }

  const normalizedRoot = path.resolve(workspaceRoot);
  const resolvedPath = path.resolve(normalizedRoot, relativePath);

  if (resolvedPath !== normalizedRoot && !resolvedPath.startsWith(`${normalizedRoot}${path.sep}`)) {
    return undefined;
  }

  return vscode.Uri.file(resolvedPath);
}

export class AiPreviewApplyService {
  private readonly previewDocuments = new Map<string, AiPreviewDocumentRegistration>();
  private readonly pendingSessions = new Map<string, PendingAiPreviewApplySession>();

  public registerPreviewDocument(
    document: vscode.TextDocument,
    registration: AiPreviewDocumentRegistration
  ): void {
    this.previewDocuments.set(toDocumentKey(document.uri), registration);
    void this.refreshContextKeys();
  }

  public async refreshContextKeys(): Promise<void> {
    const activeDocument = vscode.window.activeTextEditor?.document;
    const activeKey = activeDocument ? toDocumentKey(activeDocument.uri) : undefined;

    await vscode.commands.executeCommand(
      'setContext',
      'dslforge.aiPreviewDocument',
      activeKey ? this.previewDocuments.has(activeKey) : false
    );
    await vscode.commands.executeCommand(
      'setContext',
      'dslforge.aiPreviewDraft',
      activeKey ? this.pendingSessions.has(activeKey) : false
    );
  }

  public handleClosedDocument(document: vscode.TextDocument): void {
    const key = toDocumentKey(document.uri);
    this.previewDocuments.delete(key);
    this.pendingSessions.delete(key);
    void this.refreshContextKeys();
  }

  public async applyActivePreviewToWorkspace(): Promise<void> {
    const activeEditor = vscode.window.activeTextEditor;
    const activeDocument = activeEditor?.document;

    if (!activeDocument) {
      await vscode.window.showWarningMessage(
        'Open a DSLForge AI preview document before running Apply AI Preview to Workspace.'
      );
      return;
    }

    const registration = this.previewDocuments.get(toDocumentKey(activeDocument.uri));

    if (!registration) {
      await vscode.window.showWarningMessage(
        'The active document is not a tracked DSLForge AI preview.'
      );
      return;
    }

    const selections = buildSelectionSuggestions(
      registration,
      activeDocument.getText()
    );
    const selected = await vscode.window.showQuickPick(
      selections.map((selection) => ({
        ...selection,
        label: selection.label,
        description: selection.description,
        detail:
          selection.detail ??
          `Suggested target: ${selection.suggestedRelativePath}`
      })),
      {
        placeHolder: 'Choose what to review and apply from this AI preview'
      }
    );

    if (!selected) {
      return;
    }

    const targetRelativePath = await vscode.window.showInputBox({
      prompt: 'Target workspace-relative path',
      value: selected.suggestedRelativePath,
      validateInput: (value) => {
        return resolveWorkspaceTargetPath(registration.workspaceRoot, value)
          ? undefined
          : 'Enter a workspace-relative file path inside the current workspace.'
      }
    });

    if (!targetRelativePath) {
      return;
    }

    const targetUri = resolveWorkspaceTargetPath(
      registration.workspaceRoot,
      targetRelativePath
    );

    if (!targetUri) {
      await vscode.window.showErrorMessage(
        'DSLForge could not resolve the requested target path inside the workspace.'
      );
      return;
    }

    const draftDocument = await this.prepareDraftDocument(targetUri, selected.content);
    const targetSnapshot = await readTextFile(targetUri);
    const session: PendingAiPreviewApplySession = {
      draftUri: draftDocument.uri,
      targetUri,
      workspaceRoot: registration.workspaceRoot,
      featureName: registration.featureName,
      selectionLabel: selected.label,
      content: selected.content,
      targetRelativePath,
      targetSnapshot
    };

    this.pendingSessions.set(toDocumentKey(draftDocument.uri), session);
    await this.refreshContextKeys();
    await this.openReviewSurface(targetUri, draftDocument.uri, targetSnapshot);
    this.appendApplyReport('prepared', session);
    void vscode.window.showInformationMessage(
      `Review the draft for ${targetRelativePath}, then run DSLForge: Complete AI Preview Apply to write it.`
    );
  }

  public async completePendingApply(): Promise<void> {
    const session = await this.resolvePendingSession();

    if (!session) {
      await vscode.window.showWarningMessage(
        'No pending DSLForge AI apply draft is available.'
      );
      return;
    }

    const currentTargetContent = await readTextFile(session.targetUri);

    if (
      typeof session.targetSnapshot !== 'undefined' &&
      currentTargetContent !== session.targetSnapshot
    ) {
      await vscode.window.showWarningMessage(
        `The target file changed after the draft was prepared. Re-run Apply AI Preview to Workspace for ${session.targetRelativePath}.`
      );
      return;
    }

    const selection = await vscode.window.showWarningMessage(
      `Apply the reviewed AI draft to ${session.targetRelativePath}? This will ${typeof session.targetSnapshot === 'undefined' ? 'create' : 'overwrite'} the workspace file.`,
      { modal: true },
      'Apply Draft'
    );

    if (selection !== 'Apply Draft') {
      return;
    }

    await vscode.workspace.fs.createDirectory(
      vscode.Uri.file(path.dirname(session.targetUri.fsPath))
    );
    await vscode.workspace.fs.writeFile(
      session.targetUri,
      new TextEncoder().encode(session.content)
    );

    this.pendingSessions.delete(toDocumentKey(session.draftUri));
    await this.refreshContextKeys();
    this.appendApplyReport('completed', session);

    const document = await vscode.workspace.openTextDocument(session.targetUri);
    await vscode.window.showTextDocument(document, {
      preview: false
    });
  }

  private async resolvePendingSession(): Promise<PendingAiPreviewApplySession | undefined> {
    const activeDocument = vscode.window.activeTextEditor?.document;

    if (activeDocument) {
      const directMatch = this.pendingSessions.get(toDocumentKey(activeDocument.uri));

      if (directMatch) {
        return directMatch;
      }
    }

    if (this.pendingSessions.size === 1) {
      return [...this.pendingSessions.values()][0];
    }

    if (this.pendingSessions.size === 0) {
      return undefined;
    }

    const selected = await vscode.window.showQuickPick(
      [...this.pendingSessions.values()].map((session) => ({
        label: session.targetRelativePath,
        description: session.selectionLabel,
        detail: session.featureName,
        session
      })),
      {
        placeHolder: 'Choose the reviewed AI draft to apply'
      }
    );

    return selected?.session;
  }

  private async prepareDraftDocument(
    targetUri: vscode.Uri,
    content: string
  ): Promise<vscode.TextDocument> {
    const draftUri = vscode.Uri.parse(`untitled:${targetUri.fsPath}`);
    const document = await vscode.workspace.openTextDocument(draftUri);
    const editor = await vscode.window.showTextDocument(document, {
      preview: false,
      preserveFocus: true
    });

    await editor.edit((editBuilder) => {
      editBuilder.replace(buildDocumentRange(document), content);
    });

    return document;
  }

  private async openReviewSurface(
    targetUri: vscode.Uri,
    draftUri: vscode.Uri,
    targetSnapshot: string | undefined
  ): Promise<void> {
    if (typeof targetSnapshot === 'undefined') {
      const draftDocument = await vscode.workspace.openTextDocument(draftUri);
      await vscode.window.showTextDocument(draftDocument, {
        preview: false
      });
      return;
    }

    await vscode.commands.executeCommand(
      'vscode.diff',
      targetUri,
      draftUri,
      `DSLForge AI Apply Review: ${path.basename(targetUri.fsPath)}`
    );
  }

  private appendApplyReport(
    status: 'prepared' | 'completed',
    session: PendingAiPreviewApplySession
  ): void {
    appendOutputDivider(`DSLForge AI Apply ${status}`);
    appendOutputLine(`feature: ${session.featureName}`);
    appendOutputLine(`selection: ${session.selectionLabel}`);
    appendOutputLine(`target: ${session.targetUri.fsPath}`);
    appendOutputLine(
      `mode: ${typeof session.targetSnapshot === 'undefined' ? 'create' : 'replace'}`
    );
    appendOutputLine(`content characters: ${session.content.length}`);
    showOutputChannel();
  }
}

export const aiPreviewApplyService = new AiPreviewApplyService();

export function registerAiPreviewApplyCommands(
  context: vscode.ExtensionContext
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      APPLY_AI_PREVIEW_TO_WORKSPACE_COMMAND,
      async () => {
        await aiPreviewApplyService.applyActivePreviewToWorkspace();
      }
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      COMPLETE_AI_PREVIEW_APPLY_COMMAND,
      async () => {
        await aiPreviewApplyService.completePendingApply();
      }
    )
  );
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => {
      void aiPreviewApplyService.refreshContextKeys();
    })
  );
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((document) => {
      aiPreviewApplyService.handleClosedDocument(document);
    })
  );
  void aiPreviewApplyService.refreshContextKeys();
}
