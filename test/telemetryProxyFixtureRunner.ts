import * as assert from 'node:assert/strict';
import handler, { parseBody, sanitizeProperties, validatePayload } from '../api/telemetry';

interface RecordedResponse {
  statusCode?: number;
  jsonBody?: unknown;
  endBody?: string;
  headers: Record<string, string>;
}

interface MockResponse {
  status(code: number): MockResponse;
  json(body: unknown): void;
  end(body?: string): void;
  setHeader(name: string, value: string): void;
}

function createResponse(): { recorded: RecordedResponse; response: MockResponse } {
  const recorded: RecordedResponse = { headers: {} };
  const response = {
    status(code: number) {
      recorded.statusCode = code;
      return response;
    },
    json(body: unknown) {
      recorded.jsonBody = body;
    },
    end(body?: string) {
      recorded.endBody = body;
    },
    setHeader(name: string, value: string) {
      recorded.headers[name.toLowerCase()] = value;
    }
  };

  return { recorded, response };
}

function runPayloadPolicyCases(): void {
  assert.equal(parseBody('{not-json'), undefined);
  assert.equal(parseBody('x'.repeat(8_193)), undefined);
  assert.equal(
    validatePayload({ event: 'dslforge/not_allowed', distinctId: 'anonymous' }),
    undefined
  );

  assert.deepEqual(
    sanitizeProperties({
      feature_name: 'validation',
      workspace_path: '/private/workspace',
      prompt: 'private prompt',
      duration_ms: 25,
      unknown_property: 'ignored',
      invalid_number: Number.POSITIVE_INFINITY
    }),
    {
      feature_name: 'validation',
      duration_ms: 25
    }
  );

  assert.deepEqual(
    validatePayload({
      event: 'dslforge/validation_run',
      distinctId: ' anonymous-id ',
      properties: {
        status: 'completed',
        message: 'private diagnostic',
        issue_count: 2
      }
    }),
    {
      event: 'dslforge/validation_run',
      distinctId: 'anonymous-id',
      properties: {
        status: 'completed',
        issue_count: 2
      }
    }
  );
}

async function runHandlerCases(): Promise<void> {
  const methodResponse = createResponse();
  await handler(
    {
      method: 'GET',
      headers: {}
    },
    methodResponse.response
  );
  assert.equal(methodResponse.recorded.statusCode, 405);
  assert.equal(methodResponse.recorded.headers.allow, 'POST');
  assert.equal(methodResponse.recorded.headers['cache-control'], 'no-store');

  const invalidResponse = createResponse();
  await handler(
    {
      method: 'POST',
      headers: {},
      body: { event: 'dslforge/not_allowed', distinctId: 'anonymous-id' }
    },
    invalidResponse.response
  );
  assert.equal(invalidResponse.recorded.statusCode, 400);

  const previousApiKey = process.env.POSTHOG_PROJECT_API_KEY;
  const previousMaxEvents = process.env.TELEMETRY_RATE_LIMIT_MAX_EVENTS;

  delete process.env.POSTHOG_PROJECT_API_KEY;
  process.env.TELEMETRY_RATE_LIMIT_MAX_EVENTS = '1';

  try {
    const body = {
      event: 'dslforge/validation_run',
      distinctId: `rate-limit-${process.pid}`,
      properties: { status: 'completed' }
    };
    const sinkResponse = createResponse();
    await handler(
      {
        method: 'POST',
        headers: { 'x-forwarded-for': '192.0.2.1' },
        body
      },
      sinkResponse.response
    );
    assert.equal(sinkResponse.recorded.statusCode, 502);

    const rateLimitResponse = createResponse();
    await handler(
      {
        method: 'POST',
        headers: { 'x-forwarded-for': '192.0.2.1' },
        body
      },
      rateLimitResponse.response
    );
    assert.equal(rateLimitResponse.recorded.statusCode, 429);
  } finally {
    if (typeof previousApiKey === 'undefined') {
      delete process.env.POSTHOG_PROJECT_API_KEY;
    } else {
      process.env.POSTHOG_PROJECT_API_KEY = previousApiKey;
    }

    if (typeof previousMaxEvents === 'undefined') {
      delete process.env.TELEMETRY_RATE_LIMIT_MAX_EVENTS;
    } else {
      process.env.TELEMETRY_RATE_LIMIT_MAX_EVENTS = previousMaxEvents;
    }
  }
}

async function main(): Promise<void> {
  runPayloadPolicyCases();
  await runHandlerCases();
  console.log('telemetry proxy fixtures passed');
}

void main();
