import type { TelemetryBatch, TelemetryObservation } from '../devices/astroskin';
import { adapterVersion, documentationVersion } from '../devices/astroskin';
import {
  canonical,
  evidenceIdentity,
  identityMatches,
  type EvidenceIdentity,
} from '../mission/identity';
import {
  planCurrency,
  validateIdentity,
  validatePlan,
  uuid,
  type MonitoringPlan,
} from '../mission/review';
import type { MissionState } from '../mission/state';
import { exact, requireValid } from '../mission/validation';
import { replayAcquisition, replayFixtureVersion, replayFrames, replayRecencyMs } from './fixture';
export const monitoringSchema = 1;
export const eventPolicy = 'monitoring-events-1';
export const temporalPolicy = 'foreground-replay-recency-1';
export const retention = {
  runs: 4,
  samplesPerRun: 8,
  rawBytes: 16384,
  events: 24,
  transitions: 96,
  acknowledgments: 24,
} as const;
export type ReplayStatus = 'active' | 'paused' | 'completed' | 'stopped' | 'stale';
export interface Run {
  id: string;
  schema: 1;
  sequence: number;
  basis: EvidenceIdentity;
  plan: MonitoringPlan;
  planRevision: number;
  fictionalAt: string;
  adapter: string;
  source: string;
  fixture: string;
  acquisition: typeof replayAcquisition;
  eventPolicy: string;
  temporalPolicy: string;
  createdAt: string;
  updatedAt: string;
  status: ReplayStatus;
  pauseReason: string;
  cursor: number;
  episode: number;
  interrupted: boolean;
  lastProcessedAt: string | null;
}
export interface Sample {
  id: string;
  runId: string;
  frame: number;
  payloadId: string;
  observation: TelemetryObservation;
}
export interface Payload {
  id: string;
  raw: string;
  digest: string;
}
export type EventType =
  'monitoring-interruption' | 'monitoring-recovery' | 'simulated-external-alert';
export type EventReason = 'quality' | 'execution-delay' | 'usable-resumed' | 'simulated-upstream';
export interface MonitoringEvent {
  id: string;
  runId: string;
  type: EventType;
  reason: EventReason;
  episode: number;
  observationId: string | null;
  createdAt: string;
  policy: typeof eventPolicy;
}
export interface DeliveryTransition {
  id: string;
  eventId: string;
  kind: 'attempt' | 'displayed-receipt';
  at: string;
  companionId: string | null;
}
export interface Acknowledgment {
  id: string;
  eventId: string;
  at: string;
  companionId: string;
  role: 'Fictional crew · demo recipient';
}
export interface Ledger {
  runs: Run[];
  samples: Sample[];
  payloads: Payload[];
  events: MonitoringEvent[];
  transitions: DeliveryTransition[];
  acknowledgments: Acknowledgment[];
}
export const emptyLedger = (): Ledger => ({
  runs: [],
  samples: [],
  payloads: [],
  events: [],
  transitions: [],
  acknowledgments: [],
});
export const iso = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value;
export function bindingMatches(run: Run, state: MissionState) {
  const plan = state.monitoringPlans.at(-1);
  return (
    run.schema === monitoringSchema &&
    run.adapter === adapterVersion &&
    run.source === documentationVersion &&
    run.fixture === replayFixtureVersion &&
    run.eventPolicy === eventPolicy &&
    run.temporalPolicy === temporalPolicy &&
    identityMatches(run.basis, state) &&
    run.planRevision === state.planRevision &&
    plan?.id === run.plan.id &&
    canonical(run.plan) === canonical(plan) &&
    planCurrency(plan, state) === 'current'
  );
}
export function newRun(state: MissionState, at: string): Run {
  const plan = state.monitoringPlans.at(-1);
  requireValid(
    plan && planCurrency(plan, state) === 'current',
    'Designate a current fictional HR requirement before replay.',
  );
  requireValid(iso(at), 'Invalid replay time.');
  return {
    id: crypto.randomUUID(),
    schema: monitoringSchema,
    sequence: 1,
    basis: evidenceIdentity(state),
    plan: structuredClone(plan),
    planRevision: state.planRevision,
    fictionalAt: state.context.fictionalNow,
    adapter: adapterVersion,
    source: documentationVersion,
    fixture: replayFixtureVersion,
    acquisition: structuredClone(replayAcquisition),
    eventPolicy,
    temporalPolicy,
    createdAt: at,
    updatedAt: at,
    status: 'active',
    pauseReason: '',
    cursor: 0,
    episode: 0,
    interrupted: false,
    lastProcessedAt: null,
  };
}
export { eventMeaning, eventOrigin, needsReview } from './semantics';
import { needsReview } from './semantics';
function emit(
  data: Ledger,
  run: Run,
  type: EventType,
  reason: EventReason,
  sampleId: string | null,
  at: string,
) {
  const id = `${run.id}:${type}:${type === 'simulated-external-alert' ? 0 : run.episode}`;
  if (data.events.some((e) => e.id === id)) return;
  requireValid(
    data.events.length < retention.events,
    'Event retention is full. Ingestion paused; unresolved events retained.',
  );
  data.events.push({
    id,
    runId: run.id,
    type,
    reason,
    episode: type === 'simulated-external-alert' ? 0 : run.episode,
    observationId: sampleId,
    createdAt: at,
    policy: eventPolicy,
  });
}
export function acceptBatch(
  data: Ledger,
  run: Run,
  batch: TelemetryBatch,
  frame: number,
  at: string,
) {
  requireValid(
    run.status === 'active' || run.status === 'paused',
    'Replay is no longer accepting samples.',
  );
  requireValid(
    iso(at) &&
      batch.observations.length === 1 &&
      batch.raw === replayFrames[frame] &&
      canonical(batch.acquisition) === canonical(replayAcquisition),
    'Untrusted replay source.',
  );
  const observation = batch.observations[0];
  const id = `${run.basis.sessionId}:${run.id}:${observation.id}`;
  const existing = data.samples.find((s) => s.id === id);
  if (existing) {
    const previous = data.payloads.find((p) => p.id === existing.payloadId);
    requireValid(
      previous?.raw === batch.raw &&
        previous.digest === batch.payloadIdentity &&
        canonical({ ...existing.observation, receivedAt: observation.receivedAt }) ===
          canonical(observation),
      'Conflicting bytes under established sample identity.',
    );
    return false;
  }
  requireValid(
    frame === run.cursor && frame < retention.samplesPerRun,
    'Missing or out-of-order replay frame.',
  );
  const prior = data.samples
    .filter((s) => s.runId === run.id)
    .sort((a, b) => a.frame - b.frame)
    .at(-1);
  requireValid(
    !prior || observation.originalTicks > prior.observation.originalTicks,
    'Out-of-order source ticks.',
  );
  const payloadId = batch.payloadIdentity;
  const payload = data.payloads.find((p) => p.id === payloadId);
  requireValid(!payload || payload.raw === batch.raw, 'Conflicting payload identity.');
  if (!payload)
    data.payloads.push({ id: payloadId, raw: batch.raw, digest: batch.payloadIdentity });
  requireValid(
    data.payloads.reduce((n, p) => n + new TextEncoder().encode(p.raw).byteLength, 0) <=
      retention.rawBytes,
    'Raw payload retention is full.',
  );
  data.samples.push({ id, runId: run.id, frame, payloadId, observation });
  const hadUsable = data.samples.some(
    (s) => s.runId === run.id && s.id !== id && s.observation.usability === 'usable',
  );
  if (observation.usability !== 'usable' && hadUsable && !run.interrupted) {
    run.episode++;
    run.interrupted = true;
    emit(data, run, 'monitoring-interruption', 'quality', id, at);
  } else if (observation.usability === 'usable' && run.interrupted) {
    emit(data, run, 'monitoring-recovery', 'usable-resumed', id, at);
    run.interrupted = false;
  }
  run.cursor++;
  run.lastProcessedAt = at;
  run.updatedAt = at;
  if (run.cursor === replayFrames.length) {
    run.status = 'completed';
    run.pauseReason = 'Finite replay completed; observations are historical.';
  }
  return true;
}
export function pauseRun(data: Ledger, run: Run, reason: string, at: string, delayed = false) {
  if (run.status !== 'active') return;
  run.status = 'paused';
  run.pauseReason = reason;
  run.updatedAt = at;
  const last = data.samples
    .filter((s) => s.runId === run.id)
    .sort((a, b) => a.frame - b.frame)
    .at(-1);
  if (delayed && last?.observation.usability === 'usable' && !run.interrupted) {
    run.episode++;
    run.interrupted = true;
    emit(data, run, 'monitoring-interruption', 'execution-delay', last.id, at);
  }
}
export function externalEvent(data: Ledger, run: Run, at: string) {
  emit(data, run, 'simulated-external-alert', 'simulated-upstream', null, at);
}
export function currentReplay(data: Ledger, run: Run | undefined, now = Date.now()) {
  const samples = data.samples.filter((s) => s.runId === run?.id).sort((a, b) => a.frame - b.frame);
  const latest = samples.at(-1);
  const elapsed = run?.lastProcessedAt ? now - Date.parse(run.lastProcessedAt) : Infinity;
  const recent = elapsed >= 0 && elapsed <= replayRecencyMs;
  return {
    latest,
    samples,
    current:
      run?.status === 'active' && recent && latest?.observation.usability === 'usable'
        ? latest
        : undefined,
  };
}
export function retainForNewRun(data: Ledger, reviewedEventIds: ReadonlySet<string> = new Set()) {
  while (data.runs.length >= retention.runs) {
    const victim = data.runs.find(
      (r) =>
        !['active', 'paused'].includes(r.status) &&
        !data.events.some(
          (e) =>
            e.runId === r.id &&
            needsReview(e) &&
            (!data.acknowledgments.some((a) => a.eventId === e.id) || !reviewedEventIds.has(e.id)),
        ),
    );
    requireValid(
      victim,
      'Run retention is full. Retained notifications prevent a new run in this bounded store. Existing observations and events were retained.',
    );
    const events = new Set(data.events.filter((e) => e.runId === victim.id).map((e) => e.id));
    data.runs = data.runs.filter((r) => r !== victim);
    data.samples = data.samples.filter((s) => s.runId !== victim.id);
    data.events = data.events.filter((e) => !events.has(e.id));
    data.transitions = data.transitions.filter((t) => !events.has(t.eventId));
    data.acknowledgments = data.acknowledgments.filter((a) => !events.has(a.eventId));
    data.payloads = data.payloads.filter((p) => data.samples.some((s) => s.payloadId === p.id));
  }
}
export function transition(
  data: Ledger,
  event: MonitoringEvent,
  kind: DeliveryTransition['kind'],
  at: string,
  companionId: string | null,
) {
  const id = `${event.id}:${kind}`;
  if (data.transitions.some((t) => t.id === id)) return;
  requireValid(
    iso(at) &&
      (kind === 'attempt' ? companionId === null : uuid(companionId)) &&
      data.transitions.length < retention.transitions,
    'Delivery transition rejected or retention full.',
  );
  data.transitions.push({ id, eventId: event.id, kind, at, companionId });
}
export function acknowledge(data: Ledger, event: MonitoringEvent, at: string, companionId: string) {
  const id = `${event.id}:ack`;
  if (data.acknowledgments.some((a) => a.id === id)) return;
  requireValid(
    data.transitions.some((t) => t.eventId === event.id && t.kind === 'displayed-receipt') &&
      uuid(companionId) &&
      iso(at) &&
      data.acknowledgments.length < retention.acknowledgments,
    'A rendered receipt is required before acknowledgment.',
  );
  data.acknowledgments.push({
    id,
    eventId: event.id,
    at,
    companionId,
    role: 'Fictional crew · demo recipient',
  });
}
/** Validate recovered records against the trusted adapter output, not arbitrary persisted values. */
export function validateLedger(data: Ledger, templates: TelemetryBatch[]) {
  requireValid(
    Object.keys(data).length === 6 &&
      data.runs.length <= retention.runs &&
      data.samples.length <= retention.runs * retention.samplesPerRun &&
      data.events.length <= retention.events &&
      data.transitions.length <= retention.transitions &&
      data.acknowledgments.length <= retention.acknowledgments &&
      data.payloads.length <= replayFrames.length,
    'Invalid monitoring schema or retention.',
  );
  for (const rows of Object.values(data))
    requireValid(
      Array.isArray(rows) && new Set(rows.map((r: { id: string }) => r.id)).size === rows.length,
      'Duplicate ledger identities.',
    );
  for (const run of data.runs) {
    requireValid(
      exact({ ...run }, [
        'id',
        'schema',
        'sequence',
        'basis',
        'plan',
        'planRevision',
        'fictionalAt',
        'adapter',
        'source',
        'fixture',
        'acquisition',
        'eventPolicy',
        'temporalPolicy',
        'createdAt',
        'updatedAt',
        'status',
        'pauseReason',
        'cursor',
        'episode',
        'interrupted',
        'lastProcessedAt',
      ]),
      'Unknown monitoring run fields.',
    );
    validateIdentity(run.basis);
    validatePlan(run.plan);
    requireValid(
      uuid(run.id) &&
        Number.isSafeInteger(run.sequence) &&
        run.sequence > 0 &&
        run.schema === monitoringSchema &&
        canonical(run.basis) === canonical(run.plan.basis) &&
        run.planRevision > 0 &&
        Number.isSafeInteger(run.planRevision) &&
        run.fictionalAt === run.plan.fictionalAt &&
        run.adapter === adapterVersion &&
        run.source === documentationVersion &&
        run.fixture === replayFixtureVersion &&
        run.eventPolicy === eventPolicy &&
        run.temporalPolicy === temporalPolicy &&
        canonical(run.acquisition) === canonical(replayAcquisition) &&
        iso(run.createdAt) &&
        iso(run.updatedAt) &&
        (run.lastProcessedAt === null || iso(run.lastProcessedAt)) &&
        ['active', 'paused', 'completed', 'stopped', 'stale'].includes(run.status) &&
        typeof run.pauseReason === 'string' &&
        run.pauseReason.length < 300 &&
        Number.isInteger(run.cursor) &&
        run.cursor >= 0 &&
        run.cursor <= replayFrames.length &&
        Number.isInteger(run.episode) &&
        run.episode >= 0 &&
        run.episode <= 8 &&
        typeof run.interrupted === 'boolean',
      'Invalid monitoring run or version.',
    );
    const samples = data.samples
      .filter((s) => s.runId === run.id)
      .sort((a, b) => a.frame - b.frame);
    requireValid(
      samples.length === run.cursor &&
        (samples.length > 0 ? iso(run.lastProcessedAt) : run.lastProcessedAt === null),
      'Incomplete recovered run.',
    );
    samples.forEach((sample, frame) => {
      const expected = templates[frame];
      requireValid(
        sample.frame === frame &&
          sample.id === `${run.basis.sessionId}:${run.id}:${sample.observation.id}` &&
          iso(sample.observation.receivedAt) &&
          sample.payloadId === expected.payloadIdentity &&
          canonical(sample.observation) ===
            canonical({ ...expected.observations[0], receivedAt: sample.observation.receivedAt }),
        'Invalid persisted parser observation.',
      );
    });
  }
  requireValid(
    new Set(data.runs.map((r) => r.sequence)).size === data.runs.length,
    'Duplicate run sequence.',
  );
  for (const sample of data.samples)
    requireValid(
      exact({ ...sample }, ['id', 'runId', 'frame', 'payloadId', 'observation']) &&
        data.runs.some((r) => r.id === sample.runId) &&
        data.payloads.some((p) => p.id === sample.payloadId),
      'Orphan sample.',
    );
  for (const p of data.payloads)
    requireValid(
      exact({ ...p }, ['id', 'raw', 'digest']) &&
        templates.some(
          (t) => t.payloadIdentity === p.id && t.payloadIdentity === p.digest && t.raw === p.raw,
        ),
      'Invalid source payload.',
    );
  for (const e of data.events) {
    const run = data.runs.find((r) => r.id === e.runId);
    const sample = data.samples.find((s) => s.id === e.observationId && s.runId === e.runId);
    requireValid(
      exact({ ...e }, [
        'id',
        'runId',
        'type',
        'reason',
        'episode',
        'observationId',
        'createdAt',
        'policy',
      ]) &&
        run &&
        iso(e.createdAt) &&
        e.policy === eventPolicy &&
        Number.isInteger(e.episode) &&
        e.episode >= 0 &&
        e.episode <= run.episode &&
        e.id === `${run.id}:${e.type}:${e.episode}` &&
        ((e.type === 'simulated-external-alert' &&
          e.reason === 'simulated-upstream' &&
          e.episode === 0 &&
          e.observationId === null) ||
          (e.episode > 0 &&
            sample &&
            ((e.type === 'monitoring-interruption' &&
              ((e.reason === 'execution-delay' && sample.observation.usability === 'usable') ||
                (e.reason === 'quality' && sample.observation.usability !== 'usable'))) ||
              (e.type === 'monitoring-recovery' &&
                e.reason === 'usable-resumed' &&
                sample.observation.usability === 'usable')))),
      'Invalid monitoring event.',
    );
  }
  for (const r of data.runs) {
    const interruptions = data.events
      .filter((e) => e.runId === r.id && e.type === 'monitoring-interruption')
      .sort((a, b) => a.episode - b.episode);
    requireValid(
      interruptions.length === r.episode &&
        interruptions.every((e, i) => e.episode === i + 1) &&
        (r.status !== 'completed' || r.cursor === 8) &&
        (r.cursor !== 8 || !['active', 'paused'].includes(r.status)),
      'Invalid recovered episode or completion state.',
    );
    const recoveries = data.events.filter(
      (e) => e.runId === r.id && e.type === 'monitoring-recovery',
    );
    requireValid(
      recoveries.every((e) => interruptions.some((i) => i.episode === e.episode)) &&
        r.interrupted === (r.episode > 0 && !recoveries.some((e) => e.episode === r.episode)),
      'Invalid recovered interruption lifecycle.',
    );
  }
  for (const t of data.transitions)
    requireValid(
      exact({ ...t }, ['id', 'eventId', 'kind', 'at', 'companionId']) &&
        data.events.some((e) => e.id === t.eventId) &&
        iso(t.at) &&
        ['attempt', 'displayed-receipt'].includes(t.kind) &&
        t.id === `${t.eventId}:${t.kind}` &&
        (t.kind === 'attempt' ? t.companionId === null : uuid(t.companionId)),
      'Invalid delivery receipt.',
    );
  for (const a of data.acknowledgments)
    requireValid(
      exact({ ...a }, ['id', 'eventId', 'at', 'companionId', 'role']) &&
        a.id === `${a.eventId}:ack` &&
        iso(a.at) &&
        uuid(a.companionId) &&
        a.role === 'Fictional crew · demo recipient' &&
        data.transitions.some((t) => t.eventId === a.eventId && t.kind === 'displayed-receipt'),
      'Invalid acknowledgment.',
    );
}
