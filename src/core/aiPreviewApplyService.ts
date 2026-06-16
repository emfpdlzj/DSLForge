import * as path from 'node:path';
import * as vscode from 'vscode';
import {
  appendOutputDivider,
  appendOutputLine,
  showOutputChannel
} from './outputChannel';
import {
  buildBundleReviewMarkdown,
  buildSelectionSuggestions,
  collectConflictingTargets,
  type PreviewBundleTarget
} from './aiPreviewApplyModel';

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
  reviewUri: vscode.Uri;
  workspaceRoot: string;
  featureName: string;
  selectionLabel: string;
  targets: PendingAiPreviewApplyTarget[];
}

interface PendingAiPreviewApplyTarget {
  targetUri: vscode.Uri;
  targetRelativePath: string;
  content: string;
  sourceLabel: string;
  targetSnapshot?: string;
}

function toDocumentKey(uri: vscode.Uri): string {
  return uri.toString();
}

function buildDocumentRange(document: vscode.TextDocument): vscode.Range {
  const lastLine = Math.max(document.lineCount - 1, 0);
  const lastCharacter = document.lineAt(lastLine).text.length;

  return new vscode.Range(0, 0, lastLine, lastCharacter);
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
      registration.featureName,
      registration.outputTitle,
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

    const bundleTargets = selected.bundleTargets;

    if (bundleTargets && bundleTargets.length > 0) {
      await this.prepareBundleApply(registration, bundleTargets, selected.label);
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

    if (!targetRelativePath || !selected.content) {
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
      reviewUri: draftDocument.uri,
      workspaceRoot: registration.workspaceRoot,
      featureName: registration.featureName,
      selectionLabel: selected.label,
      targets: [
        {
          targetUri,
          targetRelativePath,
          content: selected.content,
          sourceLabel: selected.label,
          targetSnapshot
        }
      ]
    };

    this.pendingSessions.set(toDocumentKey(draftDocument.uri), session);
    await this.refreshContextKeys();
    await this.openSingleTargetReviewSurface(
      targetUri,
      draftDocument.uri,
      targetSnapshot
    );
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

    const conflictingTargets = collectConflictingTargets(
      await Promise.all(
        session.targets.map(async (target) => ({
          targetRelativePath: target.targetRelativePath,
          targetSnapshot: target.targetSnapshot,
          currentContent: await readTextFile(target.targetUri)
        }))
      )
    );

    if (conflictingTargets.length > 0) {
      await vscode.window.showWarningMessage(
        `The target file changed after the draft was prepared: ${conflictingTargets.join(', ')}. Re-run Apply AI Preview to Workspace.`
      );
      return;
    }

    const selection = await vscode.window.showWarningMessage(
      `Apply the reviewed AI draft to ${session.targets.length === 1 ? session.targets[0].targetRelativePath : `${session.targets.length} workspace files`}?
This will ${session.targets.some((target) => typeof target.targetSnapshot !== 'undefined') ? 'overwrite at least one existing file' : 'create new workspace files'}.`,
      { modal: true },
      'Apply Draft'
    );

    if (selection !== 'Apply Draft') {
      return;
    }

    for (const target of session.targets) {
      await vscode.workspace.fs.createDirectory(
        vscode.Uri.file(path.dirname(target.targetUri.fsPath))
      );
      await vscode.workspace.fs.writeFile(
        target.targetUri,
        new TextEncoder().encode(target.content)
      );
    }

    this.pendingSessions.delete(toDocumentKey(session.reviewUri));
    await this.refreshContextKeys();
    this.appendApplyReport('completed', session);

    const document = await vscode.workspace.openTextDocument(
      session.targets[0].targetUri
    );
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
        label:
          session.targets.length === 1
            ? session.targets[0].targetRelativePath
            : `${session.targets.length} files`,
        description: session.selectionLabel,
        detail:
          session.targets.length === 1
            ? session.featureName
            : `${session.featureName}: ${session.targets
                .map((target) => target.targetRelativePath)
                .join(', ')}`,
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

  private async prepareBundleApply(
    registration: AiPreviewDocumentRegistration,
    bundleTargets: PreviewBundleTarget[],
    selectionLabel: string
  ): Promise<void> {
    const preparedTargets: PendingAiPreviewApplyTarget[] = [];

    for (const bundleTarget of bundleTargets) {
      const targetUri = resolveWorkspaceTargetPath(
        registration.workspaceRoot,
        bundleTarget.targetRelativePath
      );

      if (!targetUri) {
        await vscode.window.showErrorMessage(
          `DSLForge could not resolve bundle target ${bundleTarget.targetRelativePath} inside the workspace.`
        );
        return;
      }

      preparedTargets.push({
        targetUri,
        targetRelativePath: bundleTarget.targetRelativePath,
        content: bundleTarget.content,
        sourceLabel: bundleTarget.sourceLabel,
        targetSnapshot: await readTextFile(targetUri)
      });
    }

    const reviewDocument = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: buildBundleReviewMarkdown(registration.featureName, bundleTargets)
    });
    await vscode.window.showTextDocument(reviewDocument, {
      preview: false
    });

    const session: PendingAiPreviewApplySession = {
      reviewUri: reviewDocument.uri,
      workspaceRoot: registration.workspaceRoot,
      featureName: registration.featureName,
      selectionLabel,
      targets: preparedTargets
    };

    this.pendingSessions.set(toDocumentKey(reviewDocument.uri), session);
    await this.refreshContextKeys();
    this.appendApplyReport('prepared', session);
    void vscode.window.showInformationMessage(
      `Review the scaffold bundle for ${preparedTargets.length} files, then run DSLForge: Complete AI Preview Apply to write them.`
    );
  }

  private async openSingleTargetReviewSurface(
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
    appendOutputLine(`targets: ${session.targets.length}`);

    for (const target of session.targets) {
      appendOutputLine(`- target: ${target.targetUri.fsPath}`);
      appendOutputLine(
        `  mode: ${typeof target.targetSnapshot === 'undefined' ? 'create' : 'replace'}`
      );
      appendOutputLine(`  content characters: ${target.content.length}`);
    }

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
