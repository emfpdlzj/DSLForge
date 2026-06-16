import { createHash } from 'node:crypto';
import * as http from 'node:http';
import * as https from 'node:https';
import * as vscode from 'vscode';
import { DEFAULT_TELEMETRY_ENDPOINT } from '../generated/telemetryConfig';

type TelemetryScalar = string | number | boolean | undefined;
type TelemetryProperties = Record<string, TelemetryScalar>;
type TelemetryMeasurements = Record<string, number | undefined>;

interface TelemetryConfiguration {
  enabled: boolean;
  endpoint?: string;
}

interface TelemetryEnvelope {
  event: string;
  distinctId: string;
  properties: Record<string, string | number | boolean>;
}

const TELEMETRY_CONFIGURATION_SECTION = 'dslforge.telemetry';
const TELEMETRY_ENDPOINT_ENV = 'DSLFORGE_TELEMETRY_ENDPOINT';
const TELEMETRY_TIMEOUT_MS = 3000;
const SENSITIVE_PROPERTY_PATTERN =
  /(?:file|path|prompt|content|output|stack|trace|workspace|target|message)/i;

function trimToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function toEnvelopeProperties(
  properties?: TelemetryProperties,
  measurements?: TelemetryMeasurements
): Record<string, string | number | boolean> {
  const normalizedProperties = Object.fromEntries(
    Object.entries(properties ?? {}).filter(
      ([key, value]) => typeof value !== 'undefined' && !SENSITIVE_PROPERTY_PATTERN.test(key)
    )
  ) as Record<string, string | number | boolean>;
  const normalizedMeasurements = Object.fromEntries(
    Object.entries(measurements ?? {}).filter(
      ([key, value]) =>
        typeof value === 'number' && Number.isFinite(value) && !SENSITIVE_PROPERTY_PATTERN.test(key)
    )
  ) as Record<string, number>;

  return {
    ...normalizedProperties,
    ...normalizedMeasurements
  };
}

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
    const configuration = this.readConfiguration();
    this.endpoint = configuration.enabled ? configuration.endpoint : undefined;
  }

  private readConfiguration(): TelemetryConfiguration {
    const configuration = vscode.workspace.getConfiguration('dslforge');
    const extensionEnabled = configuration.get<boolean>('telemetry.enabled') ?? true;
    const endpointOverride = trimToUndefined(
      configuration.get<string>('telemetry.endpointOverride')
    );
    const environmentEndpoint = trimToUndefined(process.env[TELEMETRY_ENDPOINT_ENV]);
    const embeddedEndpoint = trimToUndefined(DEFAULT_TELEMETRY_ENDPOINT);

    return {
      enabled: vscode.env.isTelemetryEnabled && extensionEnabled,
      endpoint: endpointOverride ?? environmentEndpoint ?? embeddedEndpoint
    };
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
        ...toEnvelopeProperties(properties, measurements)
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
