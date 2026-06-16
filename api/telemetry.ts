import { PostHog } from 'posthog-node';

type Primitive = string | number | boolean;

interface TelemetryRequestBody {
  event?: unknown;
  distinctId?: unknown;
  properties?: unknown;
}

interface ApiRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  socket?: {
    remoteAddress?: string;
  };
}

interface ApiResponse {
  status(code: number): ApiResponse;
  json(body: unknown): void;
  end(body?: string): void;
  setHeader(name: string, value: string): void;
}

const POSTHOG_API_KEY_ENV = 'POSTHOG_PROJECT_API_KEY';
const POSTHOG_HOST_ENV = 'POSTHOG_HOST';
const DEFAULT_POSTHOG_HOST = 'https://us.i.posthog.com';
const RATE_LIMIT_WINDOW_MS_ENV = 'TELEMETRY_RATE_LIMIT_WINDOW_MS';
const RATE_LIMIT_MAX_EVENTS_ENV = 'TELEMETRY_RATE_LIMIT_MAX_EVENTS';
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_RATE_LIMIT_MAX_EVENTS = 120;
const MAX_BODY_CHARACTERS = 8_192;
const MAX_STRING_LENGTH = 120;
const MAX_PROPERTIES = 16;
const SENSITIVE_PROPERTY_PATTERN =
  /(?:file|path|prompt|content|output|stack|trace|workspace|target|message)/i;
const ALLOWED_EVENTS = new Set([
  'dslforge/extension_activated',
  'dslforge/ai_gate',
  'dslforge/validation_run',
  'dslforge/ai_document_generated',
  'dslforge/ai_preview_apply',
  'dslforge/feature_error'
]);
const ALLOWED_PROPERTY_KEYS = new Set([
  'extension_name',
  'extension_version',
  'vscode_version',
  'ui_kind',
  'telemetry_provider',
  'feature_name',
  'status',
  'command_source',
  'output_kind',
  'scaffold_mode',
  'contract_normalized',
  'apply_mode',
  'is_error',
  'error_type'
]);
const ALLOWED_MEASUREMENT_KEYS = new Set([
  'available_model_count',
  'issue_count',
  'duration_ms',
  'exit_code',
  'context_file_count',
  'context_character_count',
  'missing_section_count',
  'unexpected_section_count',
  'target_count',
  'conflicting_target_count'
]);

const globalState = globalThis as typeof globalThis & {
  dslforgeTelemetryBuckets?: Map<string, { count: number; resetAt: number }>;
  dslforgePostHogClient?: PostHog;
};

function readPositiveInteger(rawValue: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(rawValue ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getRateLimitBuckets(): Map<string, { count: number; resetAt: number }> {
  globalState.dslforgeTelemetryBuckets ??= new Map();
  return globalState.dslforgeTelemetryBuckets;
}

function getPostHogClient(): PostHog {
  const apiKey = process.env[POSTHOG_API_KEY_ENV];

  if (!apiKey) {
    throw new Error(`${POSTHOG_API_KEY_ENV} is not configured.`);
  }

  globalState.dslforgePostHogClient ??= new PostHog(apiKey, {
    host: process.env[POSTHOG_HOST_ENV] ?? DEFAULT_POSTHOG_HOST,
    flushAt: 1,
    flushInterval: 0,
    disableGeoip: true
  });

  return globalState.dslforgePostHogClient;
}

function getClientAddress(request: ApiRequest): string {
  const forwardedFor = request.headers['x-forwarded-for'];

  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0]!.trim();
  }

  return request.socket?.remoteAddress ?? 'unknown';
}

function allowEvent(key: string): boolean {
  const now = Date.now();
  const windowMs = readPositiveInteger(
    process.env[RATE_LIMIT_WINDOW_MS_ENV],
    DEFAULT_RATE_LIMIT_WINDOW_MS
  );
  const maxEvents = readPositiveInteger(
    process.env[RATE_LIMIT_MAX_EVENTS_ENV],
    DEFAULT_RATE_LIMIT_MAX_EVENTS
  );
  const buckets = getRateLimitBuckets();

  for (const [bucketKey, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(bucketKey);
    }
  }

  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + windowMs
    });
    return true;
  }

  if (current.count >= maxEvents) {
    return false;
  }

  current.count += 1;
  return true;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseBody(body: unknown): TelemetryRequestBody | undefined {
  if (typeof body === 'string') {
    if (body.length > MAX_BODY_CHARACTERS) {
      return undefined;
    }

    try {
      const parsed = JSON.parse(body) as unknown;
      return isPlainObject(parsed) ? (parsed as TelemetryRequestBody) : undefined;
    } catch {
      return undefined;
    }
  }

  if (!isPlainObject(body)) {
    return undefined;
  }

  const serialized = JSON.stringify(body);
  if (serialized.length > MAX_BODY_CHARACTERS) {
    return undefined;
  }

  return body as TelemetryRequestBody;
}

function sanitizeString(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, MAX_STRING_LENGTH) : undefined;
}

function sanitizeProperties(value: unknown): Record<string, Primitive> | undefined {
  if (!isPlainObject(value)) {
    return undefined;
  }

  const entries: Array<[string, Primitive]> = [];

  for (const [key, rawValue] of Object.entries(value)) {
    if (entries.length >= MAX_PROPERTIES) {
      break;
    }

    if (SENSITIVE_PROPERTY_PATTERN.test(key)) {
      continue;
    }

    if (!ALLOWED_PROPERTY_KEYS.has(key) && !ALLOWED_MEASUREMENT_KEYS.has(key)) {
      continue;
    }

    if (typeof rawValue === 'string') {
      const sanitized = sanitizeString(rawValue);
      if (sanitized) {
        entries.push([key, sanitized]);
      }
      continue;
    }

    if (typeof rawValue === 'boolean') {
      entries.push([key, rawValue]);
      continue;
    }

    if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
      entries.push([key, rawValue]);
    }
  }

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function validatePayload(body: TelemetryRequestBody):
  | {
      event: string;
      distinctId: string;
      properties: Record<string, Primitive>;
    }
  | undefined {
  if (typeof body.event !== 'string' || !ALLOWED_EVENTS.has(body.event)) {
    return undefined;
  }

  if (typeof body.distinctId !== 'string') {
    return undefined;
  }

  const distinctId = sanitizeString(body.distinctId);

  if (!distinctId) {
    return undefined;
  }

  return {
    event: body.event,
    distinctId,
    properties: sanitizeProperties(body.properties) ?? {}
  };
}

export default async function handler(request: ApiRequest, response: ApiResponse): Promise<void> {
  response.setHeader('cache-control', 'no-store');

  if (request.method !== 'POST') {
    response.setHeader('allow', 'POST');
    response.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const parsedBody = parseBody(request.body);

  if (!parsedBody) {
    response.status(400).json({ error: 'Invalid telemetry payload.' });
    return;
  }

  const payload = validatePayload(parsedBody);

  if (!payload) {
    response.status(400).json({ error: 'Telemetry payload rejected.' });
    return;
  }

  const rateLimitKey = `${getClientAddress(request)}:${payload.distinctId}`;

  if (!allowEvent(rateLimitKey)) {
    response.status(429).json({ error: 'Rate limit exceeded.' });
    return;
  }

  try {
    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: payload.distinctId,
      event: payload.event,
      properties: {
        ...payload.properties,
        telemetry_transport: 'vercel_proxy'
      },
      disableGeoip: true
    });
    await posthog.flush();
    response.status(204).end();
  } catch {
    response.status(502).json({ error: 'Telemetry sink unavailable.' });
  }
}
