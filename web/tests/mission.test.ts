import { describe, expect, it } from 'vitest';
import { evaluate } from '../src/core/engine';
import { storageKey } from '../src/core/session';
import { guidedKey } from '../src/site/guidedState';
import { comparisonApplicable, comparisonBridge } from '../src/mission/bridge';
import { initialContext, validateContext } from '../src/mission/context';
import { missionObservations, validateObservations } from '../src/mission/observations';
import { missionOverview } from '../src/mission/overview';
import { requirementDefinitions } from '../src/mission/requirements';
import {
  decodeMission,
  encodeMission,
  initialMissionState,
  missionReducer,
  missionStorageKey,
} from '../src/mission/state';

const collectedMission = () =>
  missionReducer(initialMissionState(), {
    type: 'retrieve-record',
    record: missionObservations()[1],
  });

const context = () => structuredClone(initialContext);
const records = () => missionObservations();
const selection = (ids = records().map((r) => r.id)) => ({
  recordIds: ids,
  policy: 'explicit-assessment-selection-v1' as const,
});
function surfaceContext() {
  return {
    ...context(),
    phase: 'surface' as const,
    gravity: 'mars-0.38g' as const,
    fictionalNow: '2040-06-30T14:00:00Z',
    nextActivity: {
      label: 'Review lander-to-habitat transfer',
      kind: 'surface-transfer' as const,
      at: '2040-07-01T10:00:00Z',
    },
  };
}

describe('mission chronology and applicability', () => {
  it('has four contiguous phases and a distinct fictional observation clock', () => {
    expect(validateContext(context())).toEqual(initialContext);
    expect(initialContext.timeline.map((p) => p.phase)).toEqual([
      'preflight',
      'transit',
      'approach',
      'surface',
    ]);
    expect(
      Date.parse(initialContext.nextActivity.at) - Date.parse(initialContext.fictionalNow),
    ).toBe(86400000);
    expect(
      (Date.parse(initialContext.fictionalNow) - Date.parse(initialContext.timeline[1].startsAt)) /
        86400000,
    ).toBe(180);
  });
  it.each([
    ['gravity', { gravity: 'earth-1g' }],
    ['phase', { phase: 'earth-postflight' }],
    ['invalid calendar date', { fictionalNow: '2040-06-31T12:00:00Z' }],
    ['out-of-phase time', { fictionalNow: '2040-06-28T12:00:00Z' }],
    [
      'unbounded communication time',
      {
        earthCommunications: {
          status: 'available',
          oneWayDelaySeconds: Infinity,
          illustrative: true,
        },
      },
    ],
    [
      'invented authority',
      {
        reviewAuthority: {
          role: 'nasa-flight-surgeon',
          label: 'CMO',
          authenticatesAuthority: true,
        },
      },
    ],
    ['unknown fields', { approvedToLand: true }],
  ])('rejects invalid context: %s', (_label, patch) => {
    expect(() => validateContext({ ...context(), ...patch })).toThrow();
  });
  it('rejects gaps and reordered phases without repairing the timeline', () => {
    const c = context();
    c.timeline[1].startsAt = '2040-01-02T12:00:00Z';
    expect(() => validateContext(c)).toThrow(/contiguous/);
    const reversed = context();
    reversed.timeline.reverse();
    expect(() => validateContext(reversed)).toThrow();
  });
  it('rejects landing before now and transfer before the surface phase', () => {
    const c = context();
    c.nextActivity.at = c.fictionalNow;
    expect(() => validateContext(c)).toThrow(/Upcoming/);
    c.nextActivity = { label: 'transfer', kind: 'surface-transfer', at: '2040-06-29T14:00:00Z' };
    expect(() => validateContext(c)).toThrow(/transfer/);
  });
  it('uses two sessions thirteen days apart and preserves the Earth acquisition', () => {
    const r = validateObservations(records(), context());
    expect(Date.parse(r[1].timestamp) - Date.parse(r[0].timestamp)).toBe(13 * 86400000);
    expect(r[0].session).not.toBe(r[1].session);
    expect(r[2]).toMatchObject({
      timestamp: '2039-12-15T10:00:00Z',
      missionPhase: 'preflight',
      gravity: 'earth-1g',
      value: 1000,
      unit: 'N',
    });
    expect(r.every((o) => o.timestamp < initialContext.fictionalNow)).toBe(true);
  });
  it('rejects mismatched acquisition phase and an observation from the future', () => {
    const r = records();
    r[0].missionPhase = 'approach';
    expect(() => validateObservations(r, context())).toThrow(/Acquisition/);
    const future = records();
    future[1].timestamp = '2040-06-29T13:00:00Z';
    future[1].missionPhase = 'approach';
    expect(() => validateObservations(future, context())).toThrow(/Acquisition/);
  });
  it('never carries a transit comparison into a current surface assessment', () => {
    const c = surfaceContext();
    expect(validateContext(c).phase).toBe('surface');
    expect(comparisonApplicable(records()[0], c)).toBe(false);
    expect(comparisonApplicable(records()[2], context())).toBe(false);
    const s = missionReducer(collectedMission(), { type: 'context-change', context: c });
    const model = missionOverview(s);
    expect(model.exercise.comparison?.absolute).toBe(15); // historical arithmetic remains factual
    expect(model.exerciseComparison).toBeUndefined(); // no current-context numerical display
    expect(model.coverage).toMatchObject({ available: 0, total: 2, ids: ['aerobic', 'mobility'] });
    expect(model.requirements.find((r) => r.id === 'mobility')?.state).toBe(
      'unresolved-requirement',
    );
  });
});

describe('observation origin and evaluator bridge', () => {
  it.each([
    'published-evidence',
    'documented-format-synthetic',
    'authorised-recorded-replay',
    'approved-live-hardware',
  ])('rejects %s as an individual assessment', (origin) => {
    const r = records().map((o, i) => (i === 0 ? { ...o, origin } : o));
    expect(() => comparisonBridge(context(), r, selection())).toThrow(/fictional/);
  });
  it.each([
    ['unit', { unit: '%' }],
    ['nonfinite', { value: NaN }],
    ['negative', { value: -1 }],
    ['quantity', { measurement: 'oxygen-saturation' }],
    ['subject', { subjectId: 'OTHER' }],
    ['missing time', { timestamp: null }],
    ['unexpected field', { currentRisk: 0.2 }],
  ])('rejects unsupported record fields: %s', (_label, patch) => {
    const r = records().map((o, i) => (i === 0 ? { ...o, ...patch } : o));
    expect(() => comparisonBridge(context(), r, selection())).toThrow();
  });
  it('preserves exact metadata and matches the unchanged engine output', () => {
    const b = comparisonBridge(context(), records(), selection());
    expect(b.findings).toEqual(evaluate(b.packet));
    expect(b.findings.find((f) => f.id === 'hr')?.comparison).toMatchObject({
      absolute: 15,
      relative: null,
      changeUnit: 'bpm',
      baseline: { value: 125, timestamp: '2040-06-15T10:00:00Z' },
      followup: { value: 140, timestamp: '2040-06-28T10:00:00Z' },
    });
    expect(b.packet.observations[0]).toMatchObject({
      protocol: 'fictional-cycling-hr-v1',
      acquisition: { workloadWatts: 100, device: 'fictional-hr-monitor-01' },
      sourceRecord: 'cycle/20400615/final-minute',
      origin: 'synthetic',
    });
    expect(b.selectedRecordIds).toEqual(selection().recordIds);
    expect(b.engineContract).toBe('legacy-evaluate-v1');
  });
  it('withholds arithmetic for mismatched workload instead of calculating a change', () => {
    const r = records();
    if (r[1].measurement === 'exercise-hr') r[1].acquisition.workloadWatts = 120;
    const finding = comparisonBridge(context(), r, selection()).findings.find(
      (f) => f.id === 'hr',
    )!;
    expect(finding.status).toBe('unresolved');
    expect(finding.comparison).toBeUndefined();
    expect(finding.issues.join(' ')).toContain('100 W and 120 W');
  });
  it('withholds unknown or flagged quality without silently dropping the source', () => {
    for (const quality of [
      { state: 'unknown' as const, flags: [] },
      { state: 'declared-good' as const, flags: ['source timing unresolved'] },
    ]) {
      const r = records();
      r[1].quality = quality;
      const f = comparisonBridge(context(), r, selection()).findings.find((x) => x.id === 'hr')!;
      expect(f.status).toBe('unresolved');
      expect(f.comparison).toBeUndefined();
      expect(f.evidence).toHaveLength(2);
    }
  });
  it('does not auto-select, average, or admit duplicate selections', () => {
    expect(() => comparisonBridge(context(), records(), selection(['missing']))).toThrow();
    expect(() =>
      comparisonBridge(context(), records(), selection(['mars-hr-jun15', 'mars-hr-jun15'])),
    ).toThrow();
    const r = records();
    r.push({
      ...r[0],
      id: 'extra-session',
      session: 'EXTRA',
      provenance: { ...r[0].provenance, sourceRecord: 'extra-record' },
    });
    const f = comparisonBridge(context(), r, selection(r.map((x) => x.id))).findings.find(
      (x) => x.id === 'hr',
    )!;
    expect(f.status).toBe('unresolved');
    expect(f.comparison).toBeUndefined();
  });
  it('does not mutate original observations or turn a derived record into an independent pair', () => {
    const r = records();
    const before = structuredClone(r);
    comparisonBridge(context(), r, selection());
    expect(r).toEqual(before);
    r[1].form = 'derived';
    r[1].derivedFrom = [r[0].id];
    const f = comparisonBridge(context(), r, selection()).findings.find((x) => x.id === 'hr')!;
    expect(f.comparison).toBeUndefined();
    expect(f.excluded[0].id).toBe(r[1].id);
  });
});

describe('overview consistency and mission state ownership', () => {
  it('keeps recorded change, scoped information coverage, and human disposition separate', () => {
    const m = missionOverview(collectedMission());
    expect(m.exerciseComparison).toEqual(m.bridge.findings.find((f) => f.id === 'hr')?.comparison);
    expect(m.coverage).toEqual({ available: 1, total: 2, ids: ['exercise', 'aerobic'] });
    expect(m.mobility.comparison).toBeUndefined();
    expect(m.strength.comparison).toBeUndefined();
    expect(m.future.map((r) => r.id)).toEqual(['mobility']);
    expect(m.reviewDisposition).toBe('No human review recorded.');
    expect(m.requirements.find((r) => r.id === 'mobility')?.unresolvedReason).toContain(
      'unestablished',
    );
    expect(requirementDefinitions).toHaveLength(3);
  });
  it('removes unsupported numbers and updates coverage when an existing record is excluded', () => {
    const s = missionReducer(collectedMission(), {
      type: 'record-availability',
      recordId: 'mars-hr-jun28',
      available: false,
    });
    const m = missionOverview(s);
    expect(m.exerciseComparison).toBeUndefined();
    expect(m.exercise.status).toBe('insufficient');
    expect(m.coverage.available).toBe(0);
    expect(m.coverage.total).toBe(2);
    expect(m.requirements.find((r) => r.id === 'exercise')?.state).toBe('excluded-records');
    expect(m.records).toHaveLength(3);
    expect(m.records[1].value).toBe(140);
    expect(m.mobility.comparison).toBeUndefined();
  });
  it('uses a dedicated validated namespace and round-trips resume state exactly', () => {
    expect(new Set([storageKey, guidedKey, missionStorageKey]).size).toBe(3);
    let s = missionReducer(collectedMission(), { type: 'begin' });
    s = missionReducer(s, {
      type: 'record-availability',
      recordId: 'mars-hr-jun28',
      available: false,
    });
    expect(decodeMission(encodeMission(s))).toEqual({ state: s, notice: '' });
  });
  it('restarts only its own state and rejects unknown record commands', () => {
    const original = collectedMission();
    const s = missionReducer(original, {
      type: 'record-availability',
      recordId: 'mars-hr-jun28',
      available: false,
    });
    expect(s.evidenceRevision).toBe(3);
    expect(original.excludedRecordIds).toEqual([]);
    const restarted = missionReducer(s, { type: 'restart' });
    expect(restarted).toEqual({ ...initialMissionState(), sessionId: restarted.sessionId });
    expect(restarted.sessionId).not.toBe(s.sessionId);
    expect(() =>
      missionReducer(s, {
        type: 'record-availability',
        recordId: 'other-workspace-record',
        available: true,
      }),
    ).toThrow();
  });
  it('increments context revision while preserving original observation acquisition', () => {
    const s = missionReducer(collectedMission(), {
      type: 'context-change',
      context: surfaceContext(),
    });
    expect(s.context.contextRevision).toBe(2);
    expect(s.evidenceRevision).toBe(2);
    expect(missionOverview(s).records).toEqual(records());
    const other = surfaceContext();
    other.missionId = 'OTHER';
    expect(() => missionReducer(s, { type: 'context-change', context: other })).toThrow();
  });
  it.each([
    '{',
    'null',
    JSON.stringify({ ...initialMissionState(), schemaVersion: 3 }),
    JSON.stringify({ ...initialMissionState(), fixtureRevision: 'future' }),
    JSON.stringify({ ...initialMissionState(), excludedRecordIds: ['foreign'] }),
    ' '.repeat(24001),
  ])('restores invalid or future-schema state visibly', (raw) => {
    const result = decodeMission(raw);
    expect(result.state).toEqual({ ...initialMissionState(), sessionId: result.state.sessionId });
    expect(result.notice).toContain('could not be resumed');
  });
});
