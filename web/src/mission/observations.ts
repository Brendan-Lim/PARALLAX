import { validateDescriptiveRecord } from './richEvidence';
import type { Acquisition } from '../core/model';
import { gravityFor, type Gravity, type MissionContext, type MissionPhase } from './context';
import { exact, object, requireValid, strings, text, utc } from './validation';

export const fixtureRevision = 'mission-2040-v1';
export const measurementDefinitions = {
  'exercise-hr': { label: 'Exercise heart rate', unit: 'bpm', legacyMeasure: 'hr' },
  'leg-press-force': { label: 'Leg-press isometric force', unit: 'N', legacyMeasure: 'force' },
} as const;
export interface RecordEnvelope {
  id: string;
  missionId: string;
  subjectId: string;
  origin: 'fictional-individual';
  timestamp: string;
  clock: 'fictional-mission-utc';
  missionPhase: MissionPhase;
  gravity: Gravity;
  comparisonRole: 'baseline' | 'followup';
  session: string;
  protocol: string;
  window: string;
  form: 'direct' | 'derived';
  derivedFrom: string[];
  quality: { state: 'declared-good' | 'questionable' | 'unknown'; flags: string[] };
  provenance: { sourceId: string; sourceRecord: string; fixtureRevision: typeof fixtureRevision };
}
/** Only two defined quantities cross this foundation boundary; units are discriminated. */
export type LegacyObservation = RecordEnvelope &
  (
    | { measurement: 'exercise-hr'; value: number; unit: 'bpm'; acquisition: Acquisition }
    | {
        measurement: 'leg-press-force';
        value: number;
        unit: 'N';
        acquisition: { setting: 'earth-1g'; activity: 'leg-press-assessment'; device: string };
      }
  );

export type DescriptiveObservation = RecordEnvelope &
  (
    | {
        measurement: 'vo2peak';
        value: number;
        unit: 'L/min';
        acquisition: {
          setting: Gravity;
          activity: 'peak-cycle-gas-analysis';
          device: string;
          calibration: string;
          method: string;
          qualification: string;
          supervision: string;
        };
      }
    | {
        measurement: 'reported-sleep-duration';
        value: number;
        unit: 'h';
        acquisition: {
          setting: Gravity;
          activity: 'crew-diary';
          device: 'none-self-report';
          periodStart: string;
          periodEnd: string;
          reporting: 'preceding-24h-total-sleep';
          method: 'fictional-diary-v2';
        };
      }
    | {
        measurement: 'preflight-exercise-hr';
        value: number;
        unit: 'bpm';
        acquisition: {
          setting: 'earth-1g';
          activity: 'cycling-exercise';
          device: string;
          workloadWatts: 100;
          timing: string;
        };
      }
  );
export type FictionalObservation = LegacyObservation | DescriptiveObservation;

/** Research never satisfies the fictional-assessment bridge. */
export interface PublishedEvidence {
  origin: 'published-evidence';
  sourceUrl: string;
  locator: string;
  population: string;
  acquisitionContext: string;
}
export type DeviceQuantity =
  | { measurement: 'device-heart-rate'; value: number; unit: 'bpm' }
  | { measurement: 'breathing-rate'; value: number; unit: 'breaths/min' }
  | { measurement: 'oxygen-saturation'; value: number; unit: '%' }
  | { measurement: 'systolic-pressure-estimate'; value: number; unit: 'mmHg' };
// Implemented canonical telemetry is separately typed and never accepted by validateObservations.
export type { TelemetryObservation as DeviceObservation } from '../devices/astroskin';

const envelope = [
  'id',
  'missionId',
  'subjectId',
  'origin',
  'timestamp',
  'clock',
  'missionPhase',
  'gravity',
  'comparisonRole',
  'session',
  'protocol',
  'window',
  'form',
  'derivedFrom',
  'quality',
  'provenance',
  'measurement',
  'value',
  'unit',
  'acquisition',
];

export function validateObservations(
  input: unknown,
  context: MissionContext,
): FictionalObservation[] {
  requireValid(
    Array.isArray(input) && input.length <= 200,
    'Mission records must be a bounded array.',
  );
  const ids = new Set<string>();
  for (const r of input as unknown[]) {
    requireValid(object(r) && exact(r, envelope), 'Invalid mission record fields.');
    for (const key of ['id', 'session', 'protocol', 'window'])
      requireValid(text(r[key], 100), 'Invalid record identity or protocol.');
    requireValid(!ids.has(String(r.id)), 'Duplicate mission observation.');
    ids.add(String(r.id));
    requireValid(
      r.origin === 'fictional-individual' &&
        r.missionId === context.missionId &&
        r.subjectId === context.astronaut.id &&
        r.clock === 'fictional-mission-utc',
      'Only this fictional individual’s assessment records are accepted.',
    );
    const phase = context.timeline.find((t) => t.phase === r.missionPhase);
    requireValid(
      phase &&
        utc(r.timestamp) &&
        r.timestamp >= phase.startsAt &&
        r.timestamp < phase.endsAt &&
        r.timestamp <= context.fictionalNow &&
        r.gravity === gravityFor(phase.phase),
      'Acquisition time, phase or gravity is incompatible.',
    );
    requireValid(
      ['baseline', 'followup'].includes(String(r.comparisonRole)) &&
        ['direct', 'derived'].includes(String(r.form)) &&
        strings(r.derivedFrom),
      'Invalid comparison role or derivation.',
    );
    requireValid(
      r.form === 'direct' ? r.derivedFrom.length === 0 : r.derivedFrom.length > 0,
      'Derivation dependencies must match record form.',
    );
    const q = r.quality;
    requireValid(
      object(q) &&
        exact(q, ['state', 'flags']) &&
        ['declared-good', 'questionable', 'unknown'].includes(String(q.state)) &&
        strings(q.flags),
      'Invalid record quality.',
    );
    const p = r.provenance;
    requireValid(
      object(p) &&
        exact(p, ['sourceId', 'sourceRecord', 'fixtureRevision']) &&
        text(p.sourceId, 100) &&
        text(p.sourceRecord, 100) &&
        p.fixtureRevision === fixtureRevision,
      'Invalid fictional provenance.',
    );
    requireValid(
      typeof r.value === 'number' && Number.isFinite(r.value) && r.value >= 0,
      'A finite nonnegative observation is required.',
    );
    const a = r.acquisition;
    requireValid(object(a), 'Acquisition conditions are required.');
    if (r.measurement === 'exercise-hr') {
      requireValid(
        r.unit === 'bpm' &&
          r.gravity === 'microgravity' &&
          exact(a, ['setting', 'activity', 'workloadWatts', 'timing', 'device']) &&
          a.setting === 'inflight-microgravity' &&
          a.activity === 'cycling-exercise' &&
          typeof a.workloadWatts === 'number' &&
          Number.isFinite(a.workloadWatts) &&
          a.workloadWatts >= 0 &&
          text(a.timing, 100) &&
          text(a.device, 100),
        'Invalid exercise heart-rate definition.',
      );
    } else if (r.measurement === 'leg-press-force') {
      requireValid(
        r.measurement === 'leg-press-force' &&
          r.unit === 'N' &&
          r.gravity === 'earth-1g' &&
          exact(a, ['setting', 'activity', 'device']) &&
          a.setting === 'earth-1g' &&
          a.activity === 'leg-press-assessment' &&
          text(a.device, 100),
        'Unsupported measurement or unit.',
      );
    } else {
      validateDescriptiveRecord(r, context);
    }
  }
  const rows = input as FictionalObservation[];
  for (const r of rows)
    for (const id of r.derivedFrom)
      requireValid(
        id !== r.id && ids.has(id) && rows.find((d) => d.id === id)?.form === 'direct',
        'Dependencies must name included direct source records.',
      );
  return structuredClone(rows);
}

export function missionObservations(): LegacyObservation[] {
  const common = {
    missionId: 'DEMO-MARS-01',
    subjectId: 'FICTIONAL-01',
    origin: 'fictional-individual' as const,
    clock: 'fictional-mission-utc' as const,
    form: 'direct' as const,
    derivedFrom: [],
    quality: { state: 'declared-good' as const, flags: [] },
  };
  const cycling = ([125, 140] as const).map((value, i): LegacyObservation => ({
    ...common,
    id: i ? 'mars-hr-jun28' : 'mars-hr-jun15',
    measurement: 'exercise-hr',
    value,
    unit: 'bpm',
    timestamp: i ? '2040-06-28T10:00:00Z' : '2040-06-15T10:00:00Z',
    missionPhase: 'transit',
    gravity: 'microgravity',
    comparisonRole: i ? 'followup' : 'baseline',
    session: i ? 'CYCLE-20400628' : 'CYCLE-20400615',
    protocol: 'fictional-cycling-hr-v1',
    window: 'mars-transit-june-2040',
    provenance: {
      sourceId: 'fictional-onboard-exercise-log',
      sourceRecord: i ? 'cycle/20400628/final-minute' : 'cycle/20400615/final-minute',
      fixtureRevision,
    },
    acquisition: {
      setting: 'inflight-microgravity',
      activity: 'cycling-exercise',
      workloadWatts: 100,
      timing: 'final-minute-of-recorded-session',
      device: 'fictional-hr-monitor-01',
    },
  }));
  return [
    ...cycling,
    {
      ...common,
      id: 'mars-force-preflight',
      measurement: 'leg-press-force',
      value: 1000,
      unit: 'N',
      timestamp: '2039-12-15T10:00:00Z',
      missionPhase: 'preflight',
      gravity: 'earth-1g',
      comparisonRole: 'baseline',
      session: 'PREFLIGHT-20391215',
      protocol: 'fictional-leg-press-isometric-v1',
      window: 'mars-force-reference',
      provenance: {
        sourceId: 'fictional-preflight-assessment-log',
        sourceRecord: 'force/20391215/reference',
        fixtureRevision,
      },
      acquisition: {
        setting: 'earth-1g',
        activity: 'leg-press-assessment',
        device: 'fictional-ground-force-rig-01',
      },
    },
  ];
}
