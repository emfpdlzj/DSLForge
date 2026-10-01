import { createHash } from 'node:crypto';
import * as http from 'node:http';
import * as https from 'node:https';
import * as vscode from 'vscode';
import { DEFAULT_TELEMETRY_ENDPOINT } from '../generated/telemetryConfig';
import {
  resolveTelemetryEndpoint,
  TelemetryMeasurements,
  TelemetryProperties,
  toTelemetryProperties
} from './telemetryPolicy';

interface TelemetryEnvelope {
  event: string;
  distinctId: string;
  properties: Record<string, string | number | boolean>;
}

const TELEMETRY_CONFIGURATION_SECTION = 'dslforge.telemetry';
const TELEMETRY_ENDPOINT_ENV = 'DSLFORGE_TELEMETRY_ENDPOINT';
const TELEMETRY_TIMEOUT_MS = 3000;

function postJson(endpoint: string, payload: TelemetryEnvelope): Promise<void> {
  return new Promise((resolve) => {
    let target: URL;

    try {
      target = new URL(endpoint);
    } catch {
      resolve();
      return;
    }

    const body = JSON.stringify(payload);
    const client = target.protocol === 'http:' ? http : https;
    const request = client.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || undefined,
        path: `${target.pathname}${target.search}`,
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(body)
        },
        timeout: TELEMETRY_TIMEOUT_MS
      },
      (response) => {
        response.resume();
        response.on('end', () => {
          resolve();
        });
      }
    );

    request.on('error', () => {
      resolve();
    });
    request.on('timeout', () => {
      request.destroy();
      resolve();
    });

    request.end(body);
  });
}

class NoopTelemetryService {
  public sendUsage(): void {}

  public sendError(): void {}

  public dispose(): void {}
}

export class TelemetryService implements vscode.Disposable {
  private endpoint?: string;
  private readonly extensionName: string;
  private readonly extensionVersion: string;
  private readonly distinctId: string;
  private readonly subscriptions: vscode.Disposable[] = [];
  private readonly pendingRequests = new Set<Promise<void>>();

  public constructor(_context: vscode.ExtensionContext) {
    const packageJson = _context.extension.packageJSON as {
      name?: string;
      version?: string;
    };

    this.extensionName = packageJson.name ?? 'dslforge';
    this.extensionVersion = packageJson.version ?? '0.0.0';
    this.distinctId = createHash('sha256')
      .update(`${this.extensionName}:${vscode.env.machineId}`)
      .digest('hex');

    this.subscriptions.push(
      vscode.env.onDidChangeTelemetryEnabled(() => {
        this.reconfigure();
      })
    );
    this.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (!event.affectsConfiguration(TELEMETRY_CONFIGURATION_SECTION)) {
          return;
        }

        this.reconfigure();
      })
    );

    this.reconfigure();
    this.sendUsage('extension_activated');
  }

  public sendUsage(
    eventName: string,
    properties?: TelemetryProperties,
    measurements?: TelemetryMeasurements
  ): void {
    this.enqueueEvent(eventName, properties, measurements);
  }

  public sendError(
    eventName: string,
    properties?: TelemetryProperties,
    measurements?: TelemetryMeasurements
  ): void {
    this.enqueueEvent(
      eventName,
      {
        ...properties,
        is_error: true
      },
      measurements
    );
  }

  public dispose(): void {
    for (const subscription of this.subscriptions) {
      subscription.dispose();
    }

    const flush = Promise.allSettled([...this.pendingRequests]);
    void Promise.race([flush, new Promise((resolve) => setTimeout(resolve, TELEMETRY_TIMEOUT_MS))]);
  }

  private reconfigure(): void {
    this.endpoint = this.readEndpoint();
  }

  private readEndpoint(): string | undefined {
    const configuration = vscode.workspace.getConfiguration('dslforge');
    const extensionEnabled = configuration.get<boolean>('telemetry.enabled') ?? true;

    return resolveTelemetryEndpoint({
      vscodeTelemetryEnabled: vscode.env.isTelemetryEnabled,
      extensionTelemetryEnabled: extensionEnabled,
      endpointOverride: configuration.get<string>('telemetry.endpointOverride'),
      environmentEndpoint: process.env[TELEMETRY_ENDPOINT_ENV],
      embeddedEndpoint: DEFAULT_TELEMETRY_ENDPOINT
    });
  }

  private buildCommonProperties(): Record<string, string | boolean> {
    return {
      extension_name: this.extensionName,
      extension_version: this.extensionVersion,
      vscode_version: vscode.version,
      ui_kind: String(vscode.env.uiKind),
      telemetry_provider: 'dslforge_proxy'
    };
  }

  private enqueueEvent(
    eventName: string,
    properties?: TelemetryProperties,
    measurements?: TelemetryMeasurements
  ): void {
    if (!this.endpoint) {
      return;
    }

    const request = postJson(this.endpoint, {
      event: `dslforge/${eventName}`,
      distinctId: this.distinctId,
      properties: {
        ...this.buildCommonProperties(),
        ...toTelemetryProperties(properties, measurements)
      }
    }).finally(() => {
      this.pendingRequests.delete(request);
    });

    this.pendingRequests.add(request);
  }
}

let telemetryService: TelemetryService | NoopTelemetryService | undefined;

export function initializeTelemetry(context: vscode.ExtensionContext): TelemetryService {
  const service = new TelemetryService(context);
  telemetryService = service;
  return service;
}

export function getTelemetryService(): TelemetryService | NoopTelemetryService {
  telemetryService ??= new NoopTelemetryService();
  return telemetryService;
}
