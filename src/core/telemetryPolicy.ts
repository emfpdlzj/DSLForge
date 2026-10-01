export type TelemetryScalar = string | number | boolean | undefined;
export type TelemetryProperties = Record<string, TelemetryScalar>;
export type TelemetryMeasurements = Record<string, number | undefined>;

export interface TelemetryEndpointOptions {
  vscodeTelemetryEnabled: boolean;
  extensionTelemetryEnabled: boolean;
  endpointOverride?: string;
  environmentEndpoint?: string;
  embeddedEndpoint?: string;
}

const ALLOWED_PROPERTY_KEYS = new Set([
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

function trimToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function resolveTelemetryEndpoint(options: TelemetryEndpointOptions): string | undefined {
  if (!options.vscodeTelemetryEnabled || !options.extensionTelemetryEnabled) {
    return undefined;
  }

  return (
    trimToUndefined(options.endpointOverride) ??
    trimToUndefined(options.environmentEndpoint) ??
    trimToUndefined(options.embeddedEndpoint)
  );
}

export function toTelemetryProperties(
  properties?: TelemetryProperties,
  measurements?: TelemetryMeasurements
): Record<string, string | number | boolean> {
  const normalizedProperties = Object.fromEntries(
    Object.entries(properties ?? {}).filter(
      ([key, value]) => typeof value !== 'undefined' && ALLOWED_PROPERTY_KEYS.has(key)
    )
  ) as Record<string, string | number | boolean>;
  const normalizedMeasurements = Object.fromEntries(
    Object.entries(measurements ?? {}).filter(
      ([key, value]) =>
        typeof value === 'number' && Number.isFinite(value) && ALLOWED_MEASUREMENT_KEYS.has(key)
    )
  ) as Record<string, number>;

  return {
    ...normalizedProperties,
    ...normalizedMeasurements
  };
}
