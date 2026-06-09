import * as vscode from 'vscode';
import { showWorkspaceTrustGuidance } from './userGuidance';

export async function ensureTrustedWorkspace(
  featureName: string
): Promise<boolean> {
  if (vscode.workspace.isTrusted) {
    return true;
  }

  await showWorkspaceTrustGuidance(featureName);
  return false;
}
