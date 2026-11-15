import { describe, expect, it } from 'vitest';
import { ingestAstroskin, syntheticAcquisition } from '../src/devices/astroskin';
import {
  initialMissionState,
  missionReducer,
  decodeMission,
  encodeMission,
  missionStorageCharacterLimit,
} from '../src/mission/state';
import { canonical } from '../src/mission/identity';
import { createReview, validateReview } from '../src/mission/review';
import { handoffDocument, handoffHtml } from '../src/mission/handoff';
import { replayAcquisition, replayFrames, replaySequence } from '../src/monitoring/fixture';
import {
  acceptBatch,
  acknowledge,
  bindingMatches,
  currentReplay,
  emptyLedger,
  externalEvent,
  newRun,
  pauseRun,
  retainForNewRun,
  transition,
  validateLedger,
  type Ledger,
} from '../src/monitoring/model';
import { monitoringSnapshot, validateMonitoringSnapshot } from '../src/monitoring/snapshot';
import { validSignal } from '../src/monitoring/transport';
const time = '2026-11-14T14:00:00.000Z';
function mission() {
  return missionReducer(
    { ...initialMissionState(), entered: true },
    { type: 'designate-monitoring' },
  );
}
async function batches() {
  return Promise.all(
    replayFrames.map(async (raw) => {
      const result = await ingestAstroskin(raw, replayAcquisition, time);
      if (!result.ok) throw Error(result.error);
      return result.batch;
    }),
  );
}
async function setup(count = 0) {
  const state = mission();
  const data = emptyLedger();
  const run = newRun(state, time);
  data.runs.push(run);
  const parsed = await batches();
  for (let i = 0; i < count; i++) acceptBatch(data, run, parsed[i], i, time);
  return { state, data, run, parsed };
}
describe('coherent parser replay and identity', () => {
  it('consumes actual documented JSON with monotonic source ticks and independent acquisition', async () => {
    const parsed = await batches();
    expect(parsed.map((b) => b.observations[0].originalTicks)).toEqual([
      0, 256, 512, 768, 1024, 1280, 1536, 1792,
    ]);
    expect(parsed.map((b) => b.observations[0].originalValue)).toEqual(
      replaySequence.map((s) => s[1]),
    );
    expect(replayAcquisition.sourceRecordId).not.toBe(syntheticAcquisition.sourceRecordId);
    expect(new Set(parsed.map((b) => b.payloadIdentity)).size).toBe(8);
  });
  it('rejects an ordinary payload claiming trusted origin or acquisition', async () => {
    for (const declaration of [
      { ...replayAcquisition, sourceRecordId: 'arbitrary' },
      { ...replayAcquisition, acquisitionId: 'arbitrary' },
      { ...replayAcquisition, origin: 'live' },
    ])
      expect(
        (await ingestAstroskin(replayFrames[0], declaration as typeof replayAcquisition, time)).ok,
      ).toBe(false);
  });
  it('rejects malformed replay JSON rather than partially producing values', async () => {
    expect((await ingestAstroskin('[', replayAcquisition, time)).ok).toBe(false);
  });
  it('binds exact mission, astronaut, evidence, designation and versions', async () => {
    const { state, run } = await setup();
    expect(bindingMatches(run, state)).toBe(true);
    for (const changed of [
      { ...run, adapter: 'other' },
      { ...run, source: 'other' },
      { ...run, fixture: 'other' },
      { ...run, eventPolicy: 'other' },
      { ...run, planRevision: 99 },
    ])
      expect(bindingMatches(changed, state)).toBe(false);
    expect(bindingMatches(run, missionReducer(state, { type: 'restart' }))).toBe(false);
  });
  it('never reactivates after evidence is removed and restored', async () => {
    const { state, run } = await setup();
    const id = state.includedRecordIds[0];
    let changed = missionReducer(state, {
      type: 'record-availability',
      recordId: id,
      available: false,
    });
    changed = missionReducer(changed, {
      type: 'record-availability',
      recordId: id,
      available: true,
    });
    expect(bindingMatches(run, changed)).toBe(false);
  });
  it('identical retransmission is idempotent and preserves original receipt time', async () => {
    const { data, run, parsed } = await setup(1);
    expect(
      acceptBatch(
        data,
        run,
        {
          ...parsed[0],
          observations: [{ ...parsed[0].observations[0], receivedAt: '2026-11-14T15:00:00.000Z' }],
        },
        0,
        time,
      ),
    ).toBe(false);
    expect(data.samples).toHaveLength(1);
    expect(data.samples[0].observation.receivedAt).toBe(time);
  });
  it('rejects conflicting bytes and changed content under a stable sample id', async () => {
    const { data, run, parsed } = await setup(1);
    expect(() =>
      acceptBatch(data, run, { ...parsed[0], payloadIdentity: 'sha256-conflict' }, 0, time),
    ).toThrow(/Conflicting/);
    expect(() =>
      acceptBatch(
        data,
        run,
        { ...parsed[0], observations: [{ ...parsed[0].observations[0], value: 99 }] },
        0,
        time,
      ),
    ).toThrow(/Conflicting/);
  });
  it('rejects missing and out-of-order frames', async () => {
    const { data, run, parsed } = await setup();
    expect(() => acceptBatch(data, run, parsed[1], 1, time)).toThrow(/out-of-order/);
    acceptBatch(data, run, parsed[0], 0, time);
    expect(() => acceptBatch(data, run, parsed[2], 2, time)).toThrow(/out-of-order/);
  });
});
describe('availability and event episodes', () => {
  it('keeps usable samples current only during active bounded local replay recency', async () => {
    const { data, run } = await setup(1);
    expect(currentReplay(data, run, Date.parse(time) + 1000).current?.observation.value).toBe(72);
    expect(currentReplay(data, run, Date.parse(time) + 5001).current).toBeUndefined();
    expect(currentReplay(data, run, Date.parse(time) - 1).current).toBeUndefined();
    run.status = 'paused';
    expect(currentReplay(data, run, Date.parse(time)).current).toBeUndefined();
  });
  it('withholds repeated raw 72 with mask 2, retains history and creates one event per episode', async () => {
    const { data, run, parsed } = await setup(4);
    expect(currentReplay(data, run, Date.parse(time)).current).toBeUndefined();
    expect(data.samples[3].observation.originalValue).toBe(72);
    expect(data.samples[3].observation.qualityConditions).toContain('garment-disconnected');
    expect(data.samples.slice(0, 3).every((s) => s.observation.usability === 'usable')).toBe(true);
    acceptBatch(data, run, parsed[4], 4, time);
    expect(data.events).toHaveLength(1);
    expect(data.events[0].type).toBe('monitoring-interruption');
  });
  it('recovery preserves interruption, receipt and acknowledgment', async () => {
    const { data, run, parsed } = await setup(5);
    const e = data.events[0],
      id = crypto.randomUUID();
    transition(data, e, 'displayed-receipt', time, id);
    acknowledge(data, e, time, id);
    acceptBatch(data, run, parsed[5], 5, time);
    expect(data.events.map((e) => e.type)).toEqual([
      'monitoring-interruption',
      'monitoring-recovery',
    ]);
    expect(data.acknowledgments).toHaveLength(1);
    expect(currentReplay(data, run, Date.parse(time)).current?.observation.value).toBe(73);
  });
  it('missing quality creates a distinct later interruption and eventual recovery', async () => {
    const { data, run } = await setup(8);
    expect(data.samples[6].observation.usability).toBe('uncertain');
    expect(data.events.map((e) => [e.type, e.episode])).toEqual([
      ['monitoring-interruption', 1],
      ['monitoring-recovery', 1],
      ['monitoring-interruption', 2],
      ['monitoring-recovery', 2],
    ]);
    expect(run.status).toBe('completed');
    expect(currentReplay(data, run, Date.parse(time)).current).toBeUndefined();
  });
  it('manual pause invents no samples or clinical event', async () => {
    const { data, run } = await setup(1);
    pauseRun(data, run, 'operator pause', time);
    expect(data.samples).toHaveLength(1);
    expect(data.events).toHaveLength(0);
    expect(run.status).toBe('paused');
  });
  it('execution delay interrupts availability, without fabricating missing observations', async () => {
    const { data, run } = await setup(1);
    pauseRun(data, run, 'delayed execution', time, true);
    expect(data.samples).toHaveLength(1);
    expect(data.events[0].reason).toBe('execution-delay');
    expect(run.status).toBe('paused');
  });
  it('external alert has independent origin, stable id and no numeric threshold', async () => {
    const { data, run } = await setup();
    externalEvent(data, run, time);
    externalEvent(data, run, time);
    expect(data.events).toHaveLength(1);
    expect(data.events[0]).toMatchObject({
      type: 'simulated-external-alert',
      reason: 'simulated-upstream',
      observationId: null,
    });
  });
  it('attempt, rendered receipt and acknowledgment are distinct idempotent facts', async () => {
    const { data } = await setup(4);
    const e = data.events[0],
      id = crypto.randomUUID();
    transition(data, e, 'attempt', time, null);
    expect(() => acknowledge(data, e, time, id)).toThrow(/rendered receipt/);
    transition(data, e, 'displayed-receipt', time, id);
    transition(data, e, 'displayed-receipt', time, crypto.randomUUID());
    acknowledge(data, e, time, id);
    acknowledge(data, e, time, crypto.randomUUID());
    expect(data.transitions).toHaveLength(2);
    expect(data.acknowledgments).toHaveLength(1);
    expect(data.events[0]).toBe(e);
  });
});
describe('bounded persistence and review evidence', () => {
  it('validates parser outputs against trusted templates and rejects corrupted recovered records', async () => {
    const { data, parsed } = await setup(8);
    expect(() => validateLedger(data, parsed)).not.toThrow();
    for (const mutate of [
      (d: Ledger) => {
        d.samples[0].observation.value = 90;
      },
      (d: Ledger) => {
        d.runs[0].schema = 99 as 1;
      },
      (d: Ledger) => {
        d.samples[0].payloadId = 'other';
      },
      (d: Ledger) => {
        d.events[0].runId = crypto.randomUUID();
      },
      (d: Ledger) => {
        d.samples.push(d.samples[0]);
      },
    ]) {
      const copy = structuredClone(data);
      mutate(copy);
      expect(() => validateLedger(copy, parsed)).toThrow();
    }
  });
  it('never evicts an unresolved event, blocks at bound', async () => {
    const { state, data } = await setup();
    data.runs = [];
    for (let i = 0; i < 4; i++) {
      const r = newRun(state, time);
      r.sequence = i + 1;
      r.status = 'stopped';
      data.runs.push(r);
      externalEvent(data, r, time);
    }
    expect(() => retainForNewRun(data)).toThrow(/retention is full/);
    expect(data.runs).toHaveLength(4);
    expect(data.events).toHaveLength(4);
  });
  it('evicts only eligible inactive history, preserving separately saved snapshots', async () => {
    const { state, data, run } = await setup(1);
    const snapshot = monitoringSnapshot(data, state.sessionId, time),
      bytes = canonical(snapshot);
    run.status = 'stopped';
    for (let i = 0; i < 3; i++) {
      const r = newRun(state, time);
      r.status = 'completed';
      data.runs.push(r);
    }
    retainForNewRun(data);
    expect(data.runs).toHaveLength(3);
    expect(data.samples).toHaveLength(0);
    expect(canonical(snapshot)).toBe(bytes);
  });
  it('captures reproducible raw source and exact receipt/ack status in a frozen review', async () => {
    const { state, data } = await setup(4);
    const id = crypto.randomUUID(),
      e = data.events[0];
    transition(data, e, 'displayed-receipt', time, id);
    acknowledge(data, e, time, id);
    const snapshot = monitoringSnapshot(data, state.sessionId, time);
    const review = createReview(
      state,
      {
        disposition: 'monitoring-requested',
        reasons: ['monitoring-context'],
        priority: 'routine-review',
      },
      time,
      snapshot,
    );
    expect(() => validateReview(review)).not.toThrow();
    const doc = handoffDocument(review, { ...state, reviews: [review] }, time, snapshot);
    expect(doc.snapshot.monitoring?.acknowledgments).toHaveLength(1);
    expect(handoffHtml(doc)).toContain(e.id);
    expect(handoffHtml(doc)).toContain('Acknowledged by Fictional crew');
    const decoded = decodeMission(encodeMission({ ...state, reviews: [review] }));
    expect(decoded.notice).toBe('');
    expect(canonical(decoded.state.reviews[0])).toBe(canonical(review));
  });
  it('marks important later events for further review without staling the monitoring plan', async () => {
    const { state, data, run, parsed } = await setup(3);
    const saved = monitoringSnapshot(data, state.sessionId, time);
    const review = createReview(
      state,
      {
        disposition: 'findings-reviewed',
        reasons: ['exercise-context'],
        priority: 'routine-review',
      },
      time,
      saved,
    );
    const bytes = canonical(review);
    acceptBatch(data, run, parsed[3], 3, time);
    const doc = handoffDocument(
      review,
      { ...state, reviews: [review] },
      time,
      monitoringSnapshot(data, state.sessionId, time),
    );
    expect(doc.monitoringUpdate?.furtherReviewRequired).toBe(true);
    expect(doc.currency).toBe('current-review');
    expect(bindingMatches(run, state)).toBe(true);
    expect(canonical(review)).toBe(bytes);
  });
  it('ordinary new samples are information updates without significant-event review requirement', async () => {
    const { state, data, run, parsed } = await setup(1);
    const review = createReview(
      state,
      {
        disposition: 'findings-reviewed',
        reasons: ['exercise-context'],
        priority: 'routine-review',
      },
      time,
      monitoringSnapshot(data, state.sessionId, time),
    );
    acceptBatch(data, run, parsed[1], 1, time);
    const doc = handoffDocument(
      review,
      { ...state, reviews: [review] },
      time,
      monitoringSnapshot(data, state.sessionId, time),
    );
    expect(doc.monitoringUpdate).toMatchObject({ furtherReviewRequired: false, newSamples: 1 });
  });
  it('historical reviews gain no invented telemetry and schema failures are explicit', async () => {
    const { state } = await setup();
    const review = createReview(
      state,
      {
        disposition: 'findings-reviewed',
        reasons: ['exercise-context'],
        priority: 'routine-review',
      },
      time,
    );
    expect(review.monitoring).toBeUndefined();
    expect(handoffDocument(review, state).monitoringUpdate?.message).toContain('predates');
    expect(() => validateMonitoringSnapshot({ schema: 9 })).toThrow();
    const unavailable = monitoringSnapshot(null, state.sessionId, time);
    expect(unavailable.availability).toBe('unavailable');
    expect(() => validateMonitoringSnapshot(unavailable)).not.toThrow();
  });
  it('rejects cross-generation review snapshots and delayed review saves', async () => {
    const { state, data } = await setup(1);
    const snapshot = monitoringSnapshot(data, state.sessionId, time);
    expect(() =>
      createReview(
        missionReducer(state, { type: 'restart' }),
        {
          disposition: 'findings-reviewed',
          reasons: ['exercise-context'],
          priority: 'routine-review',
        },
        time,
        snapshot,
      ),
    ).toThrow(/another mission/);
    expect(() =>
      missionReducer(state, {
        type: 'save-review',
        selection: {
          disposition: 'findings-reviewed',
          reasons: ['exercise-context'],
          priority: 'routine-review',
        },
        expectedIdentity: 'stale',
      }),
    ).toThrow(/Mission changed/);
  });
  it('validates small wake-up identities and refuses arbitrary event payloads', () => {
    const signal = {
      v: 1,
      kind: 'wake',
      sessionId: crypto.randomUUID(),
      runId: crypto.randomUUID(),
      from: crypto.randomUUID(),
    };
    expect(validSignal(signal)).toBe(true);
    expect(validSignal({ ...signal, diagnosis: 'invented' })).toBe(false);
    expect(validSignal({ ...signal, sessionId: 'old' })).toBe(false);
    expect(validSignal(null)).toBe(false);
  });
});
it('an acknowledged event still protects history until included in retained human review', async () => {
  const { state, data } = await setup();
  data.runs = [];
  for (let i = 0; i < 4; i++) {
    const r = newRun(state, time);
    r.sequence = i + 1;
    r.status = 'stopped';
    data.runs.push(r);
    externalEvent(data, r, time);
    const e = data.events.at(-1)!,
      id = crypto.randomUUID();
    transition(data, e, 'displayed-receipt', time, id);
    acknowledge(data, e, time, id);
  }
  expect(() => retainForNewRun(data)).toThrow(/retention is full/);
  const saved = monitoringSnapshot(data, state.sessionId, time);
  const reviewed = new Set([data.events[0].id]);
  retainForNewRun(data, reviewed);
  expect(data.runs).toHaveLength(3);
  expect(saved.events).toHaveLength(1);
});
it('five full monitored reviews and five designations fit the bounded mission save guard', async () => {
  const { missionObservations } = await import('../src/mission/observations');
  let state = missionReducer(initialMissionState(), {
    type: 'retrieve-record',
    record: missionObservations()[1],
  });
  for (let i = 0; i < 5; i++) {
    state = missionReducer(state, {
      type: 'record-availability',
      recordId: state.includedRecordIds[0],
      available: i % 2 === 0,
    });
    state = missionReducer(state, { type: 'designate-monitoring' });
  }
  const data = emptyLedger(),
    run = newRun(state, time);
  data.runs.push(run);
  const parsed = await batches();
  for (let i = 0; i < 8; i++) acceptBatch(data, run, parsed[i], i, time);
  externalEvent(data, run, time);
  for (const e of data.events) {
    const id = crypto.randomUUID();
    transition(data, e, 'attempt', time, null);
    transition(data, e, 'displayed-receipt', time, id);
    acknowledge(data, e, time, id);
  }
  const snapshot = monitoringSnapshot(data, state.sessionId, time);
  for (let i = 0; i < 5; i++)
    state = missionReducer(state, {
      type: 'save-review',
      selection: {
        disposition: 'monitoring-requested',
        reasons: ['monitoring-context'],
        priority: 'routine-review',
      },
      monitoring: snapshot,
    });
  expect(state.reviews).toHaveLength(5);
  expect(encodeMission(state).length).toBeLessThanOrEqual(missionStorageCharacterLimit);
  expect(decodeMission(encodeMission(state)).state.reviews).toHaveLength(5);
});

it('five full rich monitored reviews and five designations fit the same bounded mission save guard', async () => {
  const { missionObservations } = await import('../src/mission/observations');
  const { initialRichMissionState } = await import('../src/mission/state');
  let state = missionReducer(initialRichMissionState(), {
    type: 'retrieve-record',
    record: missionObservations()[1],
  });
  for (let i = 0; i < 5; i++) {
    state = missionReducer(state, {
      type: 'record-availability',
      recordId: state.includedRecordIds[0],
      available: i % 2 === 0,
    });
    state = missionReducer(state, { type: 'designate-monitoring' });
  }
  const data = emptyLedger(),
    run = newRun(state, time);
  data.runs.push(run);
  const parsed = await batches();
  for (let i = 0; i < 8; i++) acceptBatch(data, run, parsed[i], i, time);
  externalEvent(data, run, time);
  for (const e of data.events) {
    const id = crypto.randomUUID();
    transition(data, e, 'attempt', time, null);
    transition(data, e, 'displayed-receipt', time, id);
    acknowledge(data, e, time, id);
  }
  const snapshot = monitoringSnapshot(data, state.sessionId, time);
  for (let i = 0; i < 5; i++)
    state = missionReducer(state, {
      type: 'save-review',
      selection: {
        disposition: 'monitoring-requested',
        reasons: ['monitoring-context'],
        priority: 'routine-review',
      },
      monitoring: snapshot,
    });
  expect(state.reviews).toHaveLength(5);
  expect(encodeMission(state).length).toBeLessThanOrEqual(missionStorageCharacterLimit);
  expect(decodeMission(encodeMission(state)).state).toEqual(state);
  expect(JSON.parse(encodeMission(state)).storageSchemaVersion).toBe(3);
});
