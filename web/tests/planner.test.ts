import { describe, expect, it } from 'vitest';
import { archiveRecords, followupRecordId, validateArchiveRecord } from '../src/mission/archive';
import {
  assessmentCatalogue,
  assessmentPlanner,
  evaluateAssessmentApplicability,
  type AssessmentEvidence,
  type AssessmentPolicy,
} from '../src/mission/assessments';
import { initialContext } from '../src/mission/context';
import { missionObservations } from '../src/mission/observations';
import { missionOverview } from '../src/mission/overview';
import {
  decodeMission,
  encodeMission,
  initialMissionState,
  missionReducer,
} from '../src/mission/state';
const source = () => archiveRecords()[0];
const option = (id: string) => assessmentCatalogue.find((o) => o.id === id)!;
const evidence = (id: string, patch: Partial<AssessmentEvidence> = {}): AssessmentEvidence => ({
  measurement: option(id).measurement,
  origin: 'fictional-individual',
  supported: false,
  existingRecord: id === 'exercise',
  excluded: false,
  ...patch,
});
const collect = () =>
  missionReducer(initialMissionState(), { type: 'retrieve-record', record: source() });
const applicable = (
  id: string,
  context = initialContext,
  ev = evidence(id),
  policy?: AssessmentPolicy,
) => evaluateAssessmentApplicability(option(id), context, ev, policy);

describe('genuine archive collection', () => {
  it('starts with the follow-up absent from the active set, bridge input packet and evidence, rather than excluded', () => {
    const s = initialMissionState(),
      m = missionOverview(s);
    expect(s.includedRecordIds).not.toContain(followupRecordId);
    expect(s.excludedRecordIds).toEqual([]);
    expect(m.records.map((r) => r.id)).toEqual(['mars-hr-jun15', 'mars-force-preflight']);
    expect(m.bridge.packet.observations.map((r) => r.id)).not.toContain(followupRecordId);
    expect(m.exercise.evidence.map((r) => r.id)).not.toContain(followupRecordId);
    expect(m.archivedRecords).toEqual([source()]);
    expect(m.exerciseComparison).toBeUndefined();
    expect(m.coverage).toMatchObject({ available: 0, total: 2 });
  });
  it('retrieval changes membership and produces the unchanged evaluator result with original provenance', () => {
    const s = collect(),
      m = missionOverview(s);
    expect(s.evidenceRevision).toBe(2);
    expect(m.records).toEqual(missionObservations());
    expect(m.archivedRecords).toEqual([]);
    expect(m.bridge.packet.observations.find((r) => r.id === followupRecordId)).toMatchObject({
      value: 140,
      unit: 'bpm',
      timestamp: '2040-06-28T10:00:00Z',
      sourceRecord: source().provenance.sourceRecord,
      session: source().session,
      protocol: source().protocol,
      acquisition: source().acquisition,
    });
    expect(m.exerciseComparison?.absolute).toBe(15);
    expect(m.coverage.available).toBe(1);
    expect(m.mobility.comparison).toBeUndefined();
    expect(m.strength.comparison).toBeUndefined();
    expect(m.reviewDisposition).toBe('No human review recorded.');
  });
  it('prevents duplicate retrieval, including when the retrieved record is excluded', () => {
    const s = collect();
    expect(missionReducer(s, { type: 'retrieve-record', record: source() })).toBe(s);
    const excluded = missionReducer(s, {
      type: 'record-availability',
      recordId: followupRecordId,
      available: false,
    });
    expect(missionReducer(excluded, { type: 'retrieve-record', record: source() })).toBe(excluded);
    expect(missionOverview(excluded).exerciseComparison).toBeUndefined();
  });
  it.each([
    ['value', { value: 139 }],
    ['id', { id: 'forged' }],
    ['unit', { unit: '%' }],
    ['time', { timestamp: '2040-06-27T10:00:00Z' }],
    ['session', { session: 'OTHER' }],
    ['protocol', { protocol: 'OTHER' }],
    ['origin', { origin: 'published-evidence' }],
    ['derived', { form: 'derived' }],
    ['window', { window: 'OTHER' }],
    ['source', { provenance: { ...source().provenance, sourceRecord: 'forged' } }],
    ['device', { acquisition: { ...source().acquisition, device: 'OTHER' } }],
    ['workload', { acquisition: { ...source().acquisition, workloadWatts: 101 } }],
    ['timing', { acquisition: { ...source().acquisition, timing: 'first-minute' } }],
    ['quality', { quality: { state: 'unknown', flags: [] } }],
  ])('rejects a changed %s atomically before awarding archive provenance', (_name, patch) => {
    const s = initialMissionState(),
      before = encodeMission(s);
    expect(() =>
      missionReducer(s, { type: 'retrieve-record', record: { ...source(), ...patch } }),
    ).toThrow();
    expect(encodeMission(s)).toBe(before);
  });
  it('validates source independently of property order and returns independent copies', () => {
    const reversed = Object.fromEntries(Object.entries(source()).reverse());
    expect(validateArchiveRecord(reversed, initialContext)).toEqual(source());
    const r = source();
    r.value = 99;
    expect(source().value).toBe(140);
  });
  it('cannot restore an archive-only record through the exclusion control', () => {
    expect(() =>
      missionReducer(initialMissionState(), {
        type: 'record-availability',
        recordId: followupRecordId,
        available: true,
      }),
    ).toThrow(/already included/);
  });
  it('separates exclusion from removal and supports recollection with monotonic evidence revisions', () => {
    const s = collect();
    const excluded = missionReducer(s, {
      type: 'record-availability',
      recordId: followupRecordId,
      available: false,
    });
    expect(excluded.includedRecordIds).toContain(followupRecordId);
    expect(missionOverview(excluded).requirements[0].state).toBe('excluded-records');
    expect(missionOverview(excluded).archivedRecords).toEqual([]);
    const removed = missionReducer(excluded, { type: 'remove-retrieved-record' });
    expect(removed.excludedRecordIds).toEqual([]);
    expect(removed.includedRecordIds).not.toContain(followupRecordId);
    expect(removed.evidenceRevision).toBe(4);
    expect(missionOverview(removed).coverage.available).toBe(0);
    expect(missionReducer(removed, { type: 'remove-retrieved-record' })).toBe(removed);
    expect(
      missionReducer(removed, { type: 'retrieve-record', record: source() }).evidenceRevision,
    ).toBe(5);
  });
  it('rejects retrieval when archive access is not among mission resources', () => {
    const s = initialMissionState();
    s.context.equipment = [];
    expect(() => missionReducer(s, { type: 'retrieve-record', record: source() })).toThrow(
      /archive/,
    );
  });
});

describe('applicability truth table', () => {
  it('offers record retrieval, with no new exercise or physical assessment', () => {
    expect(applicable('exercise')).toMatchObject({
      reasons: ['existing-record-retrievable'],
      canRetrieve: true,
      canPerformPhysicalTest: false,
    });
  });
  it('distinguishes supported information and intentional exclusion', () => {
    expect(
      applicable('exercise', initialContext, evidence('exercise', { supported: true })).reasons,
    ).toEqual(['information-available']);
    const excluded = applicable(
      'exercise',
      initialContext,
      evidence('exercise', { excluded: true, existingRecord: false }),
    );
    expect(excluded.reasons).toContain('reviewer-excluded');
    expect(excluded.canRetrieve).toBe(false);
  });
  it.each(['published-evidence', 'documented-format-synthetic', 'approved-live-hardware'])(
    'does not promote %s into individual assessment evidence',
    (origin) => {
      expect(
        applicable('exercise', initialContext, evidence('exercise', { origin, supported: true }))
          .reasons,
      ).toContain('unresolved');
      expect(
        applicable('exercise', initialContext, evidence('exercise', { origin })).canRetrieve,
      ).toBe(false);
    },
  );
  it('never labels excluded evidence available even if a caller reports support', () => {
    const result = applicable(
      'exercise',
      initialContext,
      evidence('exercise', { supported: true, excluded: true }),
    );
    expect(result.reasons).not.toContain('information-available');
    expect(result.reasons).toContain('reviewer-excluded');
    expect(result.canRetrieve).toBe(false);
  });
  it('rejects an unrelated measurement definition', () => {
    expect(
      applicable('exercise', initialContext, evidence('exercise', { measurement: 'resting-hr' }))
        .canRetrieve,
    ).toBe(false);
  });
  it('requires equipment for retrieval and never offers an imaginary record', () => {
    expect(applicable('exercise', { ...initialContext, equipment: [] }).reasons).toContain(
      'equipment-unavailable',
    );
    expect(applicable('exercise', { ...initialContext, equipment: [] }).canRetrieve).toBe(false);
    expect(
      applicable('exercise', initialContext, evidence('exercise', { existingRecord: false }))
        .canRetrieve,
    ).toBe(false);
  });
  it('lists concurrent aerobic blockers rather than hiding them behind one status', () => {
    expect(applicable('aerobic').reasons).toEqual(
      expect.arrayContaining([
        'additional-assessment-needed',
        'equipment-unavailable',
        'qualified-assistance-required',
        'supervision-required',
        'protocol-not-established',
      ]),
    );
  });
  it('distinguishes qualified assistance, equipment, protocol and supervision available versus missing', () => {
    const o = option('aerobic');
    const result = applicable(
      'aerobic',
      { ...initialContext, equipment: o.equipment, assistance: o.assistance },
      evidence('aerobic'),
      { approvedProtocols: [o.protocol!], supervisors: o.supervision },
    );
    expect(result.reasons).toEqual(['additional-assessment-needed']);
    expect(result.canPerformPhysicalTest).toBe(false);
    expect(result.canRetrieve).toBe(false);
  });
  it('retains missing protocol even with a device, operator and supervisor', () => {
    const o = option('aerobic');
    expect(
      applicable(
        'aerobic',
        { ...initialContext, equipment: o.equipment, assistance: o.assistance },
        evidence('aerobic'),
        { approvedProtocols: [], supervisors: o.supervision },
      ).reasons,
    ).toContain('protocol-not-established');
  });
  it('requires future phase and compatible gravity for mobility, retaining the Mars protocol gap after landing', () => {
    expect(applicable('mobility').reasons).toEqual(
      expect.arrayContaining([
        'future-phase-requirement',
        'environment-incompatible',
        'research-only',
        'protocol-not-established',
      ]),
    );
    const surface = applicable('mobility', {
      ...initialContext,
      phase: 'surface',
      gravity: 'mars-0.38g',
    });
    expect(surface.reasons).not.toContain('future-phase-requirement');
    expect(surface.reasons).not.toContain('environment-incompatible');
    expect(surface.reasons).toContain('protocol-not-established');
    expect(surface.canPerformPhysicalTest).toBe(false);
  });
  it('withholds retrieval and current comparison across a gravity mismatch', () => {
    const result = applicable('exercise', {
      ...initialContext,
      phase: 'surface',
      gravity: 'mars-0.38g',
    });
    expect(result.reasons).toContain('environment-incompatible');
    expect(result.canRetrieve).toBe(false);
  });
  it('labels alertness research-only and keeps potential self-report blocked without approval', () => {
    expect(applicable('alertness').reasons).toContain('research-only');
    expect(applicable('sleep').reasons).toContain('protocol-not-established');
    expect(applicable('sleep').reasons).not.toContain('equipment-unavailable');
    expect(applicable('pulse-oximetry').reasons).toContain('equipment-unavailable');
  });
  it('never offers a physical test, including with all hypothetical resources approved', () => {
    for (const o of assessmentCatalogue) {
      const result = evaluateAssessmentApplicability(
        o,
        { ...initialContext, equipment: o.equipment, assistance: o.assistance },
        evidence(o.id),
        { approvedProtocols: o.protocol ? [o.protocol] : [], supervisors: o.supervision },
      );
      expect(result.canPerformPhysicalTest).toBe(false);
      if (o.id !== 'exercise') expect(result.canRetrieve).toBe(false);
    }
  });
  it('keeps uncollected capacity and function unresolved after retrieval; vital signs cannot replace function', () => {
    const s = collect(),
      m = missionOverview(s),
      p = assessmentPlanner(s, m);
    expect(p.find((x) => x.option.id === 'exercise')?.reasons).toEqual(['information-available']);
    for (const id of ['aerobic', 'mobility', 'force', 'pulse-oximetry', 'sleep', 'alertness']) {
      expect(p.find((x) => x.option.id === id)?.reasons).not.toContain('information-available');
    }
    expect(m.coverage.ids).toEqual(['exercise', 'aerobic']);
    expect(m.bridge.packet.observations.every((o) => ['hr', 'force'].includes(o.measurement))).toBe(
      true,
    );
    expect(m.mobility.status).not.toBe('supported');
  });
});

describe('session and saved-state boundaries', () => {
  it('resumes collected membership, exclusions and session identity exactly', () => {
    const s = missionReducer(collect(), {
      type: 'record-availability',
      recordId: followupRecordId,
      available: false,
    });
    expect(decodeMission(encodeMission(s))).toEqual({ state: s, notice: '' });
  });
  it('restart separates generations even when numerical revisions reset', () => {
    const s = collect(),
      restarted = missionReducer(s, { type: 'restart' });
    expect(restarted.sessionId).not.toBe(s.sessionId);
    expect(restarted.evidenceRevision).toBe(1);
    expect(restarted.context.contextRevision).toBe(1);
    expect(restarted.includedRecordIds).not.toContain(followupRecordId);
    expect(missionOverview(restarted).coverage.available).toBe(0);
  });
  it('explicitly resets Phase 1 state rather than assuming old exclusions mean missing', () => {
    const old = {
      schemaVersion: 1,
      fixtureRevision: 'mission-2040-v1',
      context: initialContext,
      entered: true,
      excludedRecordIds: [],
      evidenceRevision: 10,
    };
    const restored = decodeMission(JSON.stringify(old));
    expect(restored.notice).toContain('older record model');
    expect(restored.state.includedRecordIds).not.toContain(followupRecordId);
    expect(restored.state.entered).toBe(false);
  });
  it.each([
    { includedRecordIds: ['foreign'] },
    { includedRecordIds: ['mars-hr-jun15', 'mars-hr-jun15'] },
    { excludedRecordIds: [followupRecordId] },
    { sessionId: 'old-session' },
    { evidenceRevision: 0 },
  ])('recovers invalid membership/revisions without reusing a session: %j', (patch) => {
    const s = initialMissionState(),
      result = decodeMission(JSON.stringify({ ...s, ...patch }));
    expect(result.notice).toContain('could not be resumed');
    expect(result.state.sessionId).not.toBe(s.sessionId);
    expect(missionOverview(result.state).coverage.available).toBe(0);
  });
});
