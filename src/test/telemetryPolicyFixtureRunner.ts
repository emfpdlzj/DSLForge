import * as assert from 'node:assert/strict';
import { resolveTelemetryEndpoint, toTelemetryProperties } from '../core/telemetryPolicy';

function runEndpointDisabledCases(): void {
  assert.equal(
    resolveTelemetryEndpoint({
      vscodeTelemetryEnabled: false,
      extensionTelemetryEnabled: true,
      embeddedEndpoint: 'https://telemetry.example.test'
    }),
    undefined,
    'VS Code telemetry opt-out must disable the endpoint'
  );

  assert.equal(
    resolveTelemetryEndpoint({
      vscodeTelemetryEnabled: true,
      extensionTelemetryEnabled: false,
      embeddedEndpoint: 'https://telemetry.example.test'
    }),
    undefined,
    'extension telemetry opt-out must disable the endpoint'
  );
}

function runEndpointPriorityCase(): void {
  assert.equal(
    resolveTelemetryEndpoint({
      vscodeTelemetryEnabled: true,
      extensionTelemetryEnabled: true,
      endpointOverride: ' https://override.example.test ',
      environmentEndpoint: 'https://environment.example.test',
      embeddedEndpoint: 'https://embedded.example.test'
    }),
    'https://override.example.test',
    'configured endpoint override must have highest priority'
  );

  assert.equal(
    resolveTelemetryEndpoint({
      vscodeTelemetryEnabled: true,
      extensionTelemetryEnabled: true,
      endpointOverride: ' ',
      environmentEndpoint: ' https://environment.example.test ',
      embeddedEndpoint: 'https://embedded.example.test'
    }),
    'https://environment.example.test',
    'environment endpoint must be used when no override is configured'
  );
}

function runSensitivePropertyFilteringCase(): void {
  const properties = toTelemetryProperties(
    {
      feature_name: 'validation',
      workspace_path: '/private/workspace',
      prompt_content: 'private prompt',
      output_kind: 'diagnostics',
      unknown_property: 'ignored',
      omitted: undefined
    },
    {
      duration_ms: 42,
      context_file_count: 5,
      output_size: 100,
      invalid_number: Number.NaN
    }
  );

  assert.deepEqual(properties, {
    feature_name: 'validation',
    output_kind: 'diagnostics',
    duration_ms: 42,
    context_file_count: 5
  });
}

function main(): void {
  runEndpointDisabledCases();
  runEndpointPriorityCase();
  runSensitivePropertyFilteringCase();
  console.log('telemetry policy fixtures passed');
}

main();
