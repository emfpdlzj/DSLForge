import * as vscode from 'vscode';
import { appendOutputDivider, appendOutputLine, showOutputChannel } from './outputChannel';
import { getTelemetryService } from './telemetry';
import { showAiSetupGuidance } from './userGuidance';

export type AiGateStatus = 'ready' | 'missing_model' | 'no_access';

export interface AiGateResult {
  status: AiGateStatus;
  featureName: string;
  message: string;
  selectedModel?: vscode.LanguageModelChat;
  availableModelCount: number;
}

function preferModel(
  models: readonly vscode.LanguageModelChat[],
  accessInformation: vscode.LanguageModelAccessInformation
): vscode.LanguageModelChat | undefined {
  const copilotModels = models.filter((model) => model.vendor === 'copilot');
  const accessibleCopilotModel = copilotModels.find(
    (model) => accessInformation.canSendRequest(model) === true
  );

  if (accessibleCopilotModel) {
    return accessibleCopilotModel;
  }

  const accessibleModel = models.find((model) => accessInformation.canSendRequest(model) === true);

  if (accessibleModel) {
    return accessibleModel;
  }

  return copilotModels[0] ?? models[0];
}

function appendAiGateReport(result: AiGateResult): void {
  appendOutputDivider(`DSLForge AI Gate ${result.featureName}`);
  appendOutputLine(`status: ${result.status}`);
  appendOutputLine(`available models: ${result.availableModelCount}`);

  if (result.selectedModel) {
    appendOutputLine(`selected model: ${result.selectedModel.name}`);
    appendOutputLine(`vendor: ${result.selectedModel.vendor}`);
    appendOutputLine(`family: ${result.selectedModel.family}`);
    appendOutputLine(`version: ${result.selectedModel.version}`);
  } else {
    appendOutputLine('selected model: none');
  }

  appendOutputLine(`message: ${result.message}`);
}

export class AiCommandGate {
  public constructor(private readonly accessInformation: vscode.LanguageModelAccessInformation) {}

  public async ensureAccess(featureName: string): Promise<AiGateResult> {
    const models = await vscode.lm.selectChatModels();
    const selectedModel = preferModel(models, this.accessInformation);

    if (!selectedModel) {
      const result: AiGateResult = {
        status: 'missing_model',
        featureName,
        message: `DSLForge requires GitHub Copilot or another supported VS Code model environment to run ${featureName}. No chat models are currently available.`,
        availableModelCount: 0
      };

      appendAiGateReport(result);
      getTelemetryService().sendUsage(
        'ai_gate',
        {
          feature_name: featureName,
          status: result.status
        },
        {
          available_model_count: result.availableModelCount
        }
      );
      showOutputChannel();
      await showAiSetupGuidance(featureName, result.message);
      return result;
    }

    if (this.accessInformation.canSendRequest(selectedModel) !== true) {
      const result: AiGateResult = {
        status: 'no_access',
        featureName,
        message: `DSLForge found a supported chat model for ${featureName}, but request access is not currently available. Sign in or grant model access in VS Code, then retry.`,
        selectedModel,
        availableModelCount: models.length
      };

      appendAiGateReport(result);
      getTelemetryService().sendUsage(
        'ai_gate',
        {
          feature_name: featureName,
          status: result.status
        },
        {
          available_model_count: result.availableModelCount
        }
      );
      showOutputChannel();
      await showAiSetupGuidance(featureName, result.message);
      return result;
    }

    const result: AiGateResult = {
      status: 'ready',
      featureName,
      message: `${featureName} can use ${selectedModel.vendor}/${selectedModel.family}.`,
      selectedModel,
      availableModelCount: models.length
    };

    appendAiGateReport(result);
    getTelemetryService().sendUsage(
      'ai_gate',
      {
        feature_name: featureName,
        status: result.status
      },
      {
        available_model_count: result.availableModelCount
      }
    );
    return result;
  }
}

let aiCommandGate: AiCommandGate | undefined;

export function initializeAiCommandGate(
  accessInformation: vscode.LanguageModelAccessInformation
): void {
  aiCommandGate = new AiCommandGate(accessInformation);
}

export function getAiCommandGate(): AiCommandGate {
  if (!aiCommandGate) {
    throw new Error('AI command gate has not been initialized.');
  }

  return aiCommandGate;
}
