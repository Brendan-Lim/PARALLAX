import type { Run, MonitoringEvent, DeliveryTransition, Acknowledgment, Ledger } from './model';
import { object, exact, requireValid } from '../mission/validation';
/** Compact immutable review evidence. Full source bytes are shared by payload reference. */
export interface MonitoringSnapshot {
  schema: 1;
  policy: 'monitoring-review-1';
  cutoff: string;
  availability: 'available' | 'unavailable';
  limitation: string;
  run: Run | null;
  samples: {
    id: string;
    frame: number;
    payloadId: string;
    sourceId: string;
    ticks: number;
    rawValue: number;
    unit: 'bpm';
    mask: number | null;
    usability: string;
    qualityConditions: string[];
    receivedAt: string;
    absoluteAcquiredAt: null;
  }[];
  payloads: { id: string; raw: string; digest: string }[];
  events: MonitoringEvent[];
  transitions: DeliveryTransition[];
  acknowledgments: Acknowledgment[];
}
const validTime = (x: unknown): x is string =>
  typeof x === 'string' && Number.isFinite(Date.parse(x)) && new Date(x).toISOString() === x;
export function monitoringSnapshot(
  data: Ledger | null,
  sessionId: string,
  cutoff = new Date().toISOString(),
): MonitoringSnapshot {
  const run = data?.runs.filter((r) => r.basis.sessionId === sessionId).at(-1) ?? null;
  const samples = data?.samples.filter((s) => s.runId === run?.id) ?? [];
  const events = data?.events.filter((e) => e.runId === run?.id) ?? [];
  const ids = new Set(events.map((e) => e.id));
  return structuredClone({
    schema: 1,
    policy: 'monitoring-review-1',
    cutoff,
    availability: data ? 'available' : 'unavailable',
    limitation:
      'Latest run in this mission generation only, through this local cutoff. Synthetic relative-clock data; absolute acquisition time unknown. Device disconnected. Acknowledgment is receipt of a notification; medical resolution and clearance are not established.',
    run,
    samples: samples.map((s) => ({
      id: s.id,
      frame: s.frame,
      payloadId: s.payloadId,
      sourceId: s.observation.id,
      ticks: s.observation.originalTicks,
      rawValue: s.observation.originalValue,
      unit: s.observation.unit,
      mask: s.observation.originalQualityCode,
      usability: s.observation.usability,
      qualityConditions: s.observation.qualityConditions,
      receivedAt: s.observation.receivedAt,
      absoluteAcquiredAt: null,
    })),
    payloads: data?.payloads.filter((p) => samples.some((s) => s.payloadId === p.id)) ?? [],
    events,
    transitions: data?.transitions.filter((t) => ids.has(t.eventId)) ?? [],
    acknowledgments: data?.acknowledgments.filter((a) => ids.has(a.eventId)) ?? [],
  });
}
/** Structural validation here is deliberately independent of the live database and adapter versions.
 * Historical snapshots remain evidence of what was saved, never inputs to current monitoring.
 */
export function validateMonitoringSnapshot(x: unknown): asserts x is MonitoringSnapshot {
  requireValid(
    object(x) &&
      exact(x, [
        'schema',
        'policy',
        'cutoff',
        'availability',
        'limitation',
        'run',
        'samples',
        'payloads',
        'events',
        'transitions',
        'acknowledgments',
      ]) &&
      x.schema === 1 &&
      x.policy === 'monitoring-review-1' &&
      validTime(x.cutoff) &&
      ['available', 'unavailable'].includes(String(x.availability)) &&
      typeof x.limitation === 'string' &&
      x.limitation.length < 1000,
    'Invalid monitoring review snapshot.',
  );
  requireValid(
    Array.isArray(x.samples) &&
      x.samples.length <= 8 &&
      Array.isArray(x.payloads) &&
      x.payloads.length <= 8 &&
      Array.isArray(x.events) &&
      x.events.length <= 16 &&
      Array.isArray(x.transitions) &&
      x.transitions.length <= 32 &&
      Array.isArray(x.acknowledgments) &&
      x.acknowledgments.length <= 16,
    'Monitoring snapshot exceeds bounds.',
  );
  if (x.run === null) {
    requireValid(
      [x.samples, x.payloads, x.events, x.transitions, x.acknowledgments].every(
        (a) => a.length === 0,
      ),
      'Orphan snapshot evidence.',
    );
    return;
  }
  requireValid(
    object(x.run) &&
      typeof x.run.id === 'string' &&
      object(x.run.basis) &&
      typeof x.run.basis.sessionId === 'string' &&
      object(x.run.plan) &&
      typeof x.run.plan.id === 'string' &&
      x.run.schema === 1 &&
      typeof x.run.adapter === 'string' &&
      typeof x.run.source === 'string' &&
      typeof x.run.fixture === 'string' &&
      typeof x.run.eventPolicy === 'string' &&
      typeof x.run.temporalPolicy === 'string' &&
      ['active', 'paused', 'stopped', 'completed', 'stale'].includes(String(x.run.status)) &&
      validTime(x.run.createdAt) &&
      Number.isInteger(x.run.cursor) &&
      x.run.cursor === x.samples.length,
    'Invalid snapshot run.',
  );
  const runId = x.run.id;
  for (const p of x.payloads)
    requireValid(
      object(p) &&
        exact(p, ['id', 'raw', 'digest']) &&
        typeof p.id === 'string' &&
        p.id === p.digest &&
        typeof p.raw === 'string' &&
        p.raw.length <= 2048,
      'Invalid snapshot payload.',
    );
  const sampleIds = new Set<string>();
  for (const [frame, s] of x.samples.entries()) {
    requireValid(
      object(s) &&
        exact(s, [
          'id',
          'frame',
          'payloadId',
          'sourceId',
          'ticks',
          'rawValue',
          'unit',
          'mask',
          'usability',
          'qualityConditions',
          'receivedAt',
          'absoluteAcquiredAt',
        ]) &&
        typeof s.id === 'string' &&
        !sampleIds.has(s.id) &&
        s.id === `${x.run.basis.sessionId}:${runId}:${s.sourceId}` &&
        s.frame === frame &&
        s.ticks === frame * 256 &&
        typeof s.rawValue === 'number' &&
        Number.isFinite(s.rawValue) &&
        s.rawValue >= 30 &&
        s.rawValue <= 220 &&
        s.unit === 'bpm' &&
        (s.mask === null ||
          (Number.isInteger(s.mask) && Number(s.mask) >= 0 && Number(s.mask) <= 255)) &&
        s.usability === (s.mask === null ? 'uncertain' : s.mask === 0 ? 'usable' : 'withheld') &&
        Array.isArray(s.qualityConditions) &&
        s.qualityConditions.length <= 8 &&
        s.qualityConditions.every((c) => typeof c === 'string' && c.length < 100) &&
        validTime(s.receivedAt) &&
        s.absoluteAcquiredAt === null &&
        x.payloads.some((p) => object(p) && p.id === s.payloadId),
      'Invalid snapshot observation.',
    );
    sampleIds.add(s.id);
    const p = x.payloads.find((p) => object(p) && p.id === s.payloadId) as { raw: string };
    const raw = JSON.parse(p.raw);
    requireValid(
      raw[0]?.data?.['19']?.[0]?.[0] === s.ticks &&
        raw[0]?.data?.['19']?.[0]?.[1] === s.rawValue &&
        (raw[0]?.data?.['1000']?.[0]?.[1] ?? null) === s.mask,
      'Snapshot raw/normalised mismatch.',
    );
  }
  const ids = new Set<string>();
  for (const e of x.events) {
    requireValid(
      object(e) &&
        exact(e, [
          'id',
          'runId',
          'type',
          'reason',
          'episode',
          'observationId',
          'createdAt',
          'policy',
        ]) &&
        typeof e.id === 'string' &&
        !ids.has(e.id) &&
        e.runId === runId &&
        e.policy === 'monitoring-events-1' &&
        ['monitoring-interruption', 'monitoring-recovery', 'simulated-external-alert'].includes(
          String(e.type),
        ) &&
        ['quality', 'execution-delay', 'usable-resumed', 'simulated-upstream'].includes(
          String(e.reason),
        ) &&
        Number.isInteger(e.episode) &&
        e.id === `${runId}:${e.type}:${e.episode}` &&
        validTime(e.createdAt) &&
        (e.observationId === null
          ? e.type === 'simulated-external-alert'
          : typeof e.observationId === 'string' && sampleIds.has(e.observationId)),
      'Invalid snapshot event.',
    );
    ids.add(e.id);
  }
  for (const t of x.transitions)
    requireValid(
      object(t) &&
        exact(t, ['id', 'eventId', 'kind', 'at', 'companionId']) &&
        typeof t.eventId === 'string' &&
        ids.has(t.eventId) &&
        ['attempt', 'displayed-receipt'].includes(String(t.kind)) &&
        t.id === `${t.eventId}:${t.kind}` &&
        validTime(t.at) &&
        (t.companionId === null || typeof t.companionId === 'string'),
      'Invalid snapshot transition.',
    );
  for (const a of x.acknowledgments)
    requireValid(
      object(a) &&
        exact(a, ['id', 'eventId', 'at', 'companionId', 'role']) &&
        typeof a.eventId === 'string' &&
        ids.has(a.eventId) &&
        a.id === `${a.eventId}:ack` &&
        typeof a.companionId === 'string' &&
        a.role === 'Fictional crew · demo recipient' &&
        validTime(a.at) &&
        x.transitions.some(
          (t) => object(t) && t.eventId === a.eventId && t.kind === 'displayed-receipt',
        ),
      'Invalid snapshot acknowledgment.',
    );
}
