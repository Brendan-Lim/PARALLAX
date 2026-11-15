/** Original offline subset implementation. No vendor code, service access or binary decoder. */
import { exact, object, requireValid } from '../mission/validation';

export const adapterVersion = 'astro-hr-json-1';
export const documentationVersion = 'commercial-api-3.3.x-reviewed-2026-11-14';
export const limits = { bytes: 32768, samplesPerChannel: 128, maxRelativeTicks: 921600 } as const;
export const syntheticUser = '/api/user/PARALLAX-SYNTHETIC/';
export const qualityFlags = [
  { bit: 1, condition: 'reserved-bit-0' },
  { bit: 2, condition: 'garment-disconnected' },
  { bit: 4, condition: 'electrical-interference-50-60-hz' },
  { bit: 8, condition: 'signal-saturated' },
  { bit: 16, condition: 'motion-artifacts' },
  { bit: 32, condition: 'unreliable-rr-intervals' },
] as const;

export function interpretHeartRateQuality(mask: number | null) {
  if (mask === null)
    return { usability: 'uncertain' as const, conditions: ['missing-exact-timestamp-quality'] };
  requireValid(Number.isInteger(mask) && mask >= 0 && mask <= 255, 'Invalid quality byte.');
  const conditions: string[] = qualityFlags
    .filter((flag) => (mask & flag.bit) !== 0)
    .map((flag) => flag.condition);
  if (mask & 64) conditions.push('unknown-bit-6');
  if (mask & 128) conditions.push('unknown-bit-7');
  return mask === 0
    ? { usability: 'usable' as const, conditions: ['vendor-reported-good-signal'] }
    : { usability: 'withheld' as const, conditions };
}

/** Project-defined acquisition declaration, separate from the vendor data body.
 * The public pathway supplies this from bundled fixture code, never imported metadata.
 */
export interface AcquisitionContext {
  schema: 'parallax.synthetic-acquisition/1';
  sourceId: 'commercial-astroskin-json';
  sourceDeviceId: 'SYNTHETIC-ASTRO-01';
  sourceRecordId: 'SYNTHETIC-HR-RECORD-01' | 'SYNTHETIC-HR-REPLAY-01';
  sourceUser: typeof syntheticUser;
  acquisitionId: 'synthetic-relative-run-01' | 'synthetic-relative-replay-01';
  formatVersion: typeof documentationVersion;
  unitBasis: 'decoded-json-bpm';
  clock: { basis: 'declared-relative-256hz'; anchorTicks: 0 };
  activity: null;
  workloadWatts: null;
  setting: 'synthetic-format-laboratory';
}
export const syntheticAcquisition: AcquisitionContext = Object.freeze({
  schema: 'parallax.synthetic-acquisition/1',
  sourceId: 'commercial-astroskin-json',
  sourceDeviceId: 'SYNTHETIC-ASTRO-01',
  sourceRecordId: 'SYNTHETIC-HR-RECORD-01',
  sourceUser: syntheticUser,
  acquisitionId: 'synthetic-relative-run-01',
  formatVersion: documentationVersion,
  unitBasis: 'decoded-json-bpm',
  clock: Object.freeze({ basis: 'declared-relative-256hz', anchorTicks: 0 }),
  activity: null,
  workloadWatts: null,
  setting: 'synthetic-format-laboratory',
});
/** A second trusted bundled declaration; payload fields cannot extend this allowlist. */
export const replayAcquisition: AcquisitionContext = Object.freeze({
  ...syntheticAcquisition,
  sourceRecordId: 'SYNTHETIC-HR-REPLAY-01',
  acquisitionId: 'synthetic-relative-replay-01',
});
const trustedAcquisitions = [syntheticAcquisition, replayAcquisition];
export interface TelemetryObservation {
  id: string;
  origin: 'documented-format-synthetic';
  integrationMaturity: 1;
  sourceId: AcquisitionContext['sourceId'];
  sourceDeviceId: AcquisitionContext['sourceDeviceId'];
  sourceRecordId: AcquisitionContext['sourceRecordId'];
  sourceUser: typeof syntheticUser;
  acquisitionId: AcquisitionContext['acquisitionId'];
  measurement: 'device-heart-rate';
  sourceDatatype: 19;
  originalValue: number;
  originalUnit: 'bpm';
  unitBasis: 'decoded-json-bpm';
  value: number;
  unit: 'bpm';
  transformation: 'decoded-bpm-identity-v1';
  originalTicks: number;
  originalTimestampUnit: '1/256-second';
  clockBasis: 'declared-relative-256hz';
  relativeSeconds: number;
  absoluteAcquiredAt: null;
  sourceOrder: number;
  receivedAt: string;
  qualityDatatype: 1000;
  originalQualityCode: number | null;
  qualitySourceOrder: number | null;
  qualityConditions: string[];
  usability: 'usable' | 'uncertain' | 'withheld';
  reason: string;
  activity: null;
  workloadWatts: null;
  acquisitionSetting: AcquisitionContext['setting'];
  aggregation: 'vendor-last-16-heartbeats';
  adapterVersion: typeof adapterVersion;
  documentationVersion: typeof documentationVersion;
  payloadIdentity: string;
  limitations: readonly string[];
}
export interface TelemetryBatch {
  id: string;
  raw: string;
  acquisition: AcquisitionContext;
  receivedAt: string;
  payloadIdentity: string;
  observations: TelemetryObservation[];
  unmatchedQualityTicks: number[];
  processingMode: 'finite-synthetic-batch';
  replay: null;
}
export type IngestionResult = { ok: true; batch: TelemetryBatch } | { ok: false; error: string };
export const telemetryLimitations = [
  'Synthetic documented-format fixture; no physical device or authorised recording.',
  'Source identity and payload SHA-256 do not authenticate a person, device or clinical record.',
  'No absolute acquisition time or physiological freshness established.',
  'A nonzero quality mask can accompany a retained last-valid HR value.',
  'A zero mask does not establish health, placement or independently verified accuracy.',
  'Device HR cannot establish aerobic capacity, muscular force or post-landing mobility.',
  'Activity, workload, hardware and firmware are unknown; no exercise-assessment comparison.',
] as const;

/** JSON.parse establishes syntax; lexical screening catches decoded duplicate keys and deep nesting. */
function strictJson(raw: string): unknown {
  const parsed: unknown = JSON.parse(raw);
  const stack: (Set<string> | null)[] = [];
  const tokens = /"(?:[^"\\]|\\.)*"|[{}[\]]/g;
  let token: RegExpExecArray | null;
  while ((token = tokens.exec(raw)) !== null) {
    const value = token[0];
    if (value === '{' || value === '[') {
      stack.push(value === '{' ? new Set() : null);
      requireValid(stack.length <= 8, 'JSON nesting exceeds the supported limit.');
    } else if (value === '}' || value === ']') {
      stack.pop();
    } else if (/^\s*:/.test(raw.slice(tokens.lastIndex))) {
      const keys = stack.at(-1);
      requireValid(keys, 'Invalid object key.');
      const key: string = JSON.parse(value);
      requireValid(!keys.has(key), 'Duplicate JSON object key.');
      keys.add(key);
    }
  }
  return parsed;
}
function samples(input: unknown, quality: boolean): [number, number][] {
  requireValid(
    Array.isArray(input) && input.length <= limits.samplesPerChannel,
    'Expected a bounded timestamp/value array.',
  );
  let previous = -1;
  for (const pair of input) {
    requireValid(Array.isArray(pair) && pair.length === 2, 'Expected timestamp/value pairs.');
    const [ticks, value] = pair;
    requireValid(
      typeof ticks === 'number' &&
        Number.isSafeInteger(ticks) &&
        ticks >= 0 &&
        ticks <= limits.maxRelativeTicks &&
        ticks > previous,
      'Invalid, duplicate or out-of-order relative timestamp.',
    );
    requireValid(ticks % 256 === 0, 'Only declared 1 Hz relative samples are supported.');
    requireValid(
      typeof value === 'number' && Number.isFinite(value),
      'Finite numeric value required.',
    );
    requireValid(
      quality ? Number.isInteger(value) && value >= 0 && value <= 255 : value >= 30 && value <= 220,
      quality
        ? 'Invalid quality byte.'
        : 'Outside documented HR measurement range (not a safety range).',
    );
    previous = ticks;
  }
  return input as [number, number][];
}
export async function ingestAstroskin(
  raw: string,
  acquisition: AcquisitionContext,
  receivedAt: string,
): Promise<IngestionResult> {
  try {
    requireValid(
      typeof raw === 'string' &&
        raw.length <= limits.bytes &&
        new TextEncoder().encode(raw).byteLength <= limits.bytes,
      'Payload byte limit exceeded.',
    );
    requireValid(
      object(acquisition) &&
        exact(acquisition, Object.keys(syntheticAcquisition)) &&
        trustedAcquisitions.some((trusted) =>
          Object.entries(trusted).every(([key, expected]) =>
            key === 'clock'
              ? object(acquisition.clock) &&
                exact(acquisition.clock, ['basis', 'anchorTicks']) &&
                acquisition.clock.basis === 'declared-relative-256hz' &&
                acquisition.clock.anchorTicks === 0
              : acquisition[key as keyof AcquisitionContext] === expected,
          ),
        ),
      'Only the bundled synthetic acquisition declaration is supported.',
    );
    requireValid(
      typeof receivedAt === 'string' &&
        /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(receivedAt) &&
        Number.isFinite(Date.parse(receivedAt)) &&
        new Date(receivedAt).toISOString() === receivedAt,
      'Actual system receipt time is required.',
    );
    const input = strictJson(raw);
    requireValid(Array.isArray(input) && input.length === 1, 'Exactly one source is supported.');
    const source: unknown = input[0];
    requireValid(
      object(source) && exact(source, ['user', 'data']) && source.user === syntheticUser,
      'Unknown or conflicting synthetic source identity.',
    );
    const data = source.data;
    requireValid(
      object(data) &&
        Object.keys(data).every((key) => ['19', '1000'].includes(key)) &&
        Object.hasOwn(data, '19'),
      'Only numeric datatype keys 19 and optional 1000 are supported.',
    );
    const hr = samples(data['19'], false);
    requireValid(hr.length > 0, 'At least one HR sample is required.');
    const quality = Object.hasOwn(data, '1000') ? samples(data['1000'], true) : [];
    const indexed = new Map(quality.map(([tick, mask], index) => [tick, { mask, index }]));
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
    const payloadIdentity =
      'sha256-' +
      [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    const observations = hr.map(([ticks, value], sourceOrder): TelemetryObservation => {
      const aligned = indexed.get(ticks);
      const q = interpretHeartRateQuality(aligned?.mask ?? null);
      return {
        id: adapterVersion + ':' + acquisition.sourceRecordId + ':19:' + ticks,
        origin: 'documented-format-synthetic',
        integrationMaturity: 1,
        sourceId: acquisition.sourceId,
        sourceDeviceId: acquisition.sourceDeviceId,
        sourceRecordId: acquisition.sourceRecordId,
        sourceUser: syntheticUser,
        acquisitionId: acquisition.acquisitionId,
        measurement: 'device-heart-rate',
        sourceDatatype: 19,
        originalValue: value,
        originalUnit: 'bpm',
        unitBasis: acquisition.unitBasis,
        value,
        unit: 'bpm',
        transformation: 'decoded-bpm-identity-v1',
        originalTicks: ticks,
        originalTimestampUnit: '1/256-second',
        clockBasis: acquisition.clock.basis,
        relativeSeconds: ticks / 256,
        absoluteAcquiredAt: null,
        sourceOrder,
        receivedAt,
        qualityDatatype: 1000,
        originalQualityCode: aligned?.mask ?? null,
        qualitySourceOrder: aligned?.index ?? null,
        qualityConditions: q.conditions,
        usability: q.usability,
        reason:
          q.usability === 'usable'
            ? 'Exact-time quality mask 0 passes the PARALLAX demonstration policy; freshness remains unknown.'
            : q.usability === 'uncertain'
              ? 'No exact-time quality entry; current usable observation unavailable.'
              : 'Nonzero mask withheld by PARALLAX policy; raw value may be retained from an earlier detection.',
        activity: null,
        workloadWatts: null,
        acquisitionSetting: acquisition.setting,
        aggregation: 'vendor-last-16-heartbeats',
        adapterVersion,
        documentationVersion,
        payloadIdentity,
        limitations: telemetryLimitations,
      };
    });
    const hrTicks = new Set(hr.map(([ticks]) => ticks));
    return {
      ok: true,
      batch: {
        id: payloadIdentity,
        raw,
        acquisition: structuredClone(acquisition),
        receivedAt,
        payloadIdentity,
        observations,
        processingMode: 'finite-synthetic-batch',
        replay: null,
        unmatchedQualityTicks: quality.filter(([tick]) => !hrTicks.has(tick)).map(([tick]) => tick),
      },
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof SyntaxError
          ? 'Malformed JSON; no samples ingested.'
          : error instanceof Error
            ? error.message
            : 'Ingestion failed; no samples ingested.',
    };
  }
}

/** Latest source sample governs availability; no fallback to historical values as current. */
export function currentObservation(observations: readonly TelemetryObservation[]) {
  const latest = observations.at(-1);
  return {
    latest,
    current: latest?.usability === 'usable' ? latest : undefined,
    historical: observations.filter((sample) => sample !== latest && sample.usability === 'usable'),
  };
}
