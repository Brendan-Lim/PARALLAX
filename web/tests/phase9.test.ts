import { describe, expect, it } from 'vitest';
import {
  initialRichMissionState,
  missionReducer,
  encodeMission,
  decodeMission,
} from '../src/mission/state';
import { archiveRecords } from '../src/mission/archive';
import { availableReviewReasons, createReview, validateReview } from '../src/mission/review';
import { guideFacts, guideStep } from '../src/mission/guideState';
import { missionChapter } from '../src/mission/chapters';
import { missionOverview } from '../src/mission/overview';
import { ingestAstroskin } from '../src/devices/astroskin';
import { acceptBatch, acknowledge, emptyLedger, newRun, transition } from '../src/monitoring/model';
import { replayFrames, replayAcquisition } from '../src/monitoring/fixture';
import { monitoringSnapshot } from '../src/monitoring/snapshot';
import { monitoringNextAction } from '../src/monitoring/nextAction';
const at = '2026-11-15T11:00:00.000Z';
async function actualRun() {
  let state = missionReducer(initialRichMissionState(), {
    type: 'retrieve-record',
    record: archiveRecords()[0],
  });
  state = missionReducer(state, { type: 'designate-monitoring' });
  const data = emptyLedger(),
    run = newRun(state, at);
  data.runs.push(run);
  for (let i = 0; i < 4; i++) {
    const parsed = await ingestAstroskin(replayFrames[i], replayAcquisition, at);
    if (!parsed.ok) throw Error(parsed.error);
    acceptBatch(data, run, parsed.batch, i, at);
  }
  return { state, data, run };
}
describe('guided mission uses authoritative scientific and persisted results', () => {
  it('retrieval, exclusion and undo recalculate completion from the evaluator', () => {
    const start = initialRichMissionState();
    expect(guideFacts(start, null).retrieved).toBe(false);
    const obtained = missionReducer(start, {
      type: 'retrieve-record',
      record: archiveRecords()[0],
    });
    expect(guideFacts(obtained, null).retrieved).toBe(true);
    expect(
      guideFacts(
        missionReducer(obtained, {
          type: 'record-availability',
          recordId: 'mars-hr-jun28',
          available: false,
        }),
        null,
      ).retrieved,
    ).toBe(false);
    expect(
      guideFacts(missionReducer(obtained, { type: 'remove-retrieved-record' }), null).retrieved,
    ).toBe(false);
    expect(() =>
      missionReducer(start, {
        type: 'retrieve-record',
        record: { ...archiveRecords()[0], value: 999 },
      }),
    ).toThrow();
    expect(guideFacts(start, null).retrieved).toBe(false);
  });
  it('designation is explicit and invalidates with the evidence lineage', async () => {
    const { state, data } = await actualRun();
    expect(guideFacts(state, data)).toMatchObject({
      retrieved: true,
      designated: true,
      usable: true,
      interrupted: true,
      acknowledged: false,
      saved: false,
    });
    const changed = missionReducer(state, { type: 'remove-retrieved-record' });
    expect(guideFacts(changed, data)).toMatchObject({
      retrieved: false,
      designated: false,
      usable: false,
      interrupted: false,
      saved: false,
    });
    const restored = missionReducer(changed, {
      type: 'retrieve-record',
      record: archiveRecords()[0],
    });
    expect(guideFacts(restored, data).usable).toBe(false);
  });
  it('requires the actual aligned 3-second sample and corresponding quality event', async () => {
    const { state, data } = await actualRun();
    const noSample = structuredClone(data);
    noSample.samples = noSample.samples.filter((s) => s.frame !== 3);
    expect(guideFacts(state, noSample).interrupted).toBe(false);
    const noEvent = structuredClone(data);
    noEvent.events = [];
    expect(guideFacts(state, noEvent).interrupted).toBe(false);
    const wrong = structuredClone(data);
    wrong.events[0].observationId = 'unrelated';
    expect(guideFacts(state, wrong).interrupted).toBe(false);
    expect(data.samples[2].observation.originalValue).toBe(
      data.samples[3].observation.originalValue,
    );
    expect(data.samples[2].observation.usability).toBe('usable');
    expect(data.samples[3].observation.usability).toBe('withheld');
  });
  it('render receipt alone is not acknowledgment and duplicate acknowledgment remains idempotent', async () => {
    const { state, data, run } = await actualRun();
    const e = data.events[0],
      recipient = crypto.randomUUID();
    transition(data, e, 'displayed-receipt', at, recipient);
    expect(guideFacts(state, data).acknowledged).toBe(false);
    acknowledge(data, e, at, recipient);
    acknowledge(data, e, at, recipient);
    expect(data.acknowledgments).toHaveLength(1);
    expect(guideFacts(state, data).acknowledged).toBe(true);
    run.status = 'paused';
    const reviewed = missionReducer(state, {
      type: 'save-review',
      selection: {
        disposition: 'findings-reviewed',
        reasons: ['oxygen-reviewed', 'sleep-reviewed', 'interruption-reviewed'],
        priority: 'routine-review',
      },
      monitoring: monitoringSnapshot(data, state.sessionId, at),
    });
    expect(guideFacts(reviewed, data).saved).toBe(true);
    const roundTrip = decodeMission(encodeMission(reviewed));
    expect(roundTrip.notice).toBe('');
    expect(guideFacts(roundTrip.state, data).saved).toBe(true);
    const snapshot = JSON.stringify(reviewed.reviews);
    const removed = missionReducer(reviewed, { type: 'remove-retrieved-record' });
    expect(guideFacts(removed, data).saved).toBe(false);
    expect(JSON.stringify(removed.reviews)).toBe(snapshot);
  });
  it('a saved review without the actual monitoring acknowledgment is incomplete', async () => {
    const { state, data } = await actualRun();
    const review = createReview(
      state,
      {
        disposition: 'findings-reviewed',
        reasons: ['functional-unknown'],
        priority: 'routine-review',
      },
      at,
      monitoringSnapshot(data, state.sessionId, at),
    );
    expect(guideFacts({ ...state, reviews: [review] }, data).saved).toBe(false);
  });
  it('historical chapter projection excludes future records and leaves active membership unchanged', () => {
    const s = initialRichMissionState(),
      raw = encodeMission(s),
      preflight = missionChapter('preflight'),
      transit = missionChapter('transit');
    expect(preflight.records).toHaveLength(4);
    expect(preflight.records.every((r) => r.timestamp < '2040-01-01')).toBe(true);
    expect(transit.records.find((r) => r.id === 'mars-hr-jun28')?.value).toBe(140);
    expect(transit.descriptive.map((c) => c.difference)).toEqual([-0.1, -1]);
    expect(encodeMission(s)).toBe(raw);
    expect(s.includedRecordIds).not.toContain('mars-hr-jun28');
  });
  it('exclusions carry through rich cards, source inspection and supported findings', () => {
    let s = initialRichMissionState();
    const id = s.includedRecordIds.find((x) => x.includes('vo2peak') && x.includes('06-27'))!;
    s = missionReducer(s, { type: 'record-availability', recordId: id, available: false });
    const m = missionOverview(s);
    expect(m.excludedRecordIds).toContain(id);
    expect(m.descriptive.find((c) => c.measurement === 'vo2peak')).toMatchObject({
      supported: false,
      difference: null,
    });
    expect(availableReviewReasons(s)).not.toHaveProperty('oxygen-reviewed');
    expect(availableReviewReasons(s)).toHaveProperty('sleep-reviewed');
  });
  it('rich reasons describe present observations; historical missing-aerobic reasons still validate', () => {
    const s = initialRichMissionState();
    expect(availableReviewReasons(s)).not.toHaveProperty('aerobic-missing');
    expect(() =>
      createReview(
        s,
        {
          disposition: 'findings-reviewed',
          reasons: ['aerobic-missing'],
          priority: 'routine-review',
        },
        at,
      ),
    ).toThrow();
    expect(() =>
      createReview(
        s,
        {
          disposition: 'findings-reviewed',
          reasons: ['interruption-reviewed'],
          priority: 'routine-review',
        },
        at,
      ),
    ).toThrow();
    const historic = createReview(
      s,
      {
        disposition: 'findings-reviewed',
        reasons: ['oxygen-reviewed'],
        priority: 'routine-review',
      },
      at,
    );
    const old = structuredClone(historic);
    old.basis = {
      ...old.basis,
      versions: { ...old.basis.versions, reviewPolicy: 'fictional-review-2' },
    };
    old.reasons = ['aerobic-missing'];
    expect(() => validateReview(old)).not.toThrow();
  });
  it.each([
    ['#mission/preflight', 0],
    ['#mission/transit', 1],
    ['#mission/health/assessments', 2],
    ['#mission/health/designation', 3],
    ['#mission/monitoring', 3],
    ['#mission/monitoring/interruption', 4],
    ['#mission/health/review', 5],
    ['#mission/surface', 6],
    ['#mission/surface/completed', 7],
  ] as const)('maps real browser history route %s to step %i', (hash, step) =>
    expect(guideStep(hash)).toBe(step),
  );
});
describe('state-derived monitoring recommendations', () => {
  const base = {
    plan: true,
    error: '',
    run: true,
    associated: true,
    status: 'active',
    unacknowledged: false,
  };
  it.each([
    [{ ...base, plan: false }, 'designation'],
    [{ ...base, error: 'retention full' }, 'history'],
    [{ ...base, run: false }, 'start'],
    [{ ...base, associated: false }, 'designation'],
    [{ ...base, unacknowledged: true }, 'companion'],
    [{ ...base, usability: 'withheld' }, 'conditions'],
    [{ ...base, usability: 'uncertain' }, 'conditions'],
    [{ ...base, status: 'paused', usability: 'usable' }, 'resume'],
    [{ ...base, status: 'completed' }, 'review'],
    [{ ...base, status: 'stopped' }, 'review'],
    [{ ...base, usability: 'usable' }, 'conditions'],
  ])('maps the actual state to the available workflow action', (state, id) =>
    expect(monitoringNextAction(state).id).toBe(id),
  );
});
