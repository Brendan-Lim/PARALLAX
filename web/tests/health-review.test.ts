import { describe, expect, it } from 'vitest';
import {
  initialMissionState,
  missionReducer,
  decodeMission,
  encodeMission,
} from '../src/mission/state';
import { missionObservations } from '../src/mission/observations';
import { comparisonBridge } from '../src/mission/bridge';
import { missionOverview } from '../src/mission/overview';
import { healthInterpretations, interpretationSources } from '../src/mission/interpretation';
import {
  canonical,
  currentVersions,
  evidenceIdentity,
  identityMatches,
  localFingerprint,
  reviewStatus,
} from '../src/mission/identity';
import { channelContracts } from '../src/mission/channels';
import {
  dispositions,
  fictionalReviewer,
  historyLimit,
  planAvailability,
  planCurrency,
  validatePlan,
  validateReview,
  type ReviewSelection,
} from '../src/mission/review';
import { handoffDocument, handoffHtml, reviewCurrency } from '../src/mission/handoff';
import { persistMission } from '../src/mission/writer';

const selection: ReviewSelection = {
  disposition: 'findings-reviewed',
  reasons: ['functional-unknown', 'aerobic-missing', 'exercise-context'],
  priority: 'routine-review',
};
const collected = () =>
  missionReducer(initialMissionState(), {
    type: 'retrieve-record',
    record: missionObservations()[1],
  });
const designate = (s = collected()) => missionReducer(s, { type: 'designate-monitoring' });
const reviewed = () => missionReducer(designate(), { type: 'save-review', selection });
const surface = () => ({
  ...initialMissionState().context,
  phase: 'surface' as const,
  gravity: 'mars-0.38g' as const,
  fictionalNow: '2040-06-30T14:00:00Z',
  nextActivity: {
    label: 'Review lander-to-habitat transfer',
    kind: 'surface-transfer' as const,
    at: '2040-07-01T10:00:00Z',
  },
});

describe('deterministic health interpretation', () => {
  it('starts with four domain-specific questions and genuine missing exercise evidence', () => {
    const s = initialMissionState();
    const f = healthInterpretations(s);
    expect(f.map((x) => x.id)).toEqual([
      'functional',
      'aerobic',
      'cardiovascular',
      'musculoskeletal',
    ]);
    expect(f.find((x) => x.id === 'cardiovascular')).toMatchObject({
      evidenceStatus: 'missing',
      concernBasis: 'information-gap',
    });
    expect(canonical(f)).not.toContain('+15');
    expect(missionOverview(s).coverage).toMatchObject({ available: 0, total: 2 });
  });
  it('interprets exactly the supported pair without inventing a cause or personalised action', () => {
    const f = healthInterpretations(collected()).find((x) => x.id === 'cardiovascular')!;
    expect(f.recordedObservation).toBe(
      '15 June 2040: 125 bpm; 28 June 2040: 140 bpm; +15 bpm at 100 W.',
    );
    expect(f.meaning).toContain('same workload, monitor, protocol and final-minute');
    expect(f.limitation).toContain('cause of any difference is unknown');
    expect(f).toMatchObject({
      evidenceStatus: 'supported',
      concernBasis: 'recorded-difference',
      priority: 'interpretation-available',
    });
    expect(canonical(f)).not.toMatch(
      /caused by|dehydration|illness|VO2max (?:of|is|=) [0-9]|reduce exercise|increase exercise/,
    );
  });
  it.each(['excluded', 'removed'] as const)(
    'withholds numeric interpretation when %s',
    (operation) => {
      const s = missionReducer(
        collected(),
        operation === 'excluded'
          ? { type: 'record-availability', recordId: 'mars-hr-jun28', available: false }
          : { type: 'remove-retrieved-record' },
      );
      const f = healthInterpretations(s).find((x) => x.id === 'cardiovascular')!;
      expect(f.evidenceStatus).toBe(operation === 'excluded' ? 'excluded' : 'missing');
      expect(canonical(f)).not.toContain('+15');
      expect(f.priority).toBe('information-candidate');
    },
  );
  it('withholds incompatible current-context arithmetic while retaining historical source facts', () => {
    const s = missionReducer(collected(), { type: 'context-change', context: surface() });
    const f = healthInterpretations(s).find((x) => x.id === 'cardiovascular')!;
    expect(f.evidenceStatus).toBe('incompatible');
    expect(canonical(f)).not.toContain('+15');
    expect(missionOverview(s).exercise.comparison?.absolute).toBe(15);
  });
  it('consumes an evaluator incompatibility rather than overriding its finding', () => {
    const s = collected();
    const rows = missionObservations();
    if (rows[1].measurement === 'exercise-hr') rows[1].acquisition.workloadWatts = 120;
    const bridge = comparisonBridge(s.context, rows, {
      policy: 'explicit-assessment-selection-v1',
      recordIds: rows.map((r) => r.id),
    });
    const model = {
      ...missionOverview(s),
      exercise: bridge.findings.find((f) => f.id === 'hr')!,
      exerciseComparison: undefined,
    };
    const f = healthInterpretations(s, model).find((x) => x.id === 'cardiovascular')!;
    expect(f.evidenceStatus).toBe('unresolved');
    expect(canonical(f)).not.toContain('+15');
  });
  it('preserves force, capacity and functional unknowns after successful retrieval', () => {
    const f = healthInterpretations(collected());
    expect(f.find((x) => x.id === 'musculoskeletal')?.recordedObservation).toContain('1,000 N');
    expect(f.find((x) => x.id === 'musculoskeletal')?.meaning).toContain(
      'Current muscular force and its change remain unknown',
    );
    expect(f.find((x) => x.id === 'aerobic')?.recordedObservation).toContain(
      'No suitable aerobic-capacity',
    );
    expect(f[0]).toMatchObject({ id: 'functional', concernBasis: 'unresolved-capability' });
    expect(f[0].recordedObservation).toContain('No post-landing');
    expect(f[0].limitation).toContain('do not demonstrate impairment');
    expect(missionOverview(collected()).coverage).toMatchObject({ available: 1, total: 2 });
  });
  it.each(['functional', 'aerobic', 'cardiovascular', 'musculoskeletal'])(
    'grounds %s in explicit population, locator and applicability boundaries',
    (id) => {
      const f = healthInterpretations(collected()).find((x) => x.id === id)!;
      for (const sourceId of f.sourceIds) {
        const source = interpretationSources.find((s) => s.id === sourceId)!;
        expect(source.url).toMatch(/^https:\/\//);
        expect(source.locator.length).toBeGreaterThan(10);
        expect(source.population.length).toBeGreaterThan(20);
        expect(source.boundary.length).toBeGreaterThan(30);
        expect(source.consequence.length).toBeGreaterThan(20);
      }
      expect(f.missionRelevance).toContain('Mars landing');
      expect(f.priorityReason.length).toBeGreaterThan(40);
    },
  );
  it('orders unresolved function first and explains requirements separately from recorded concern', () => {
    for (const s of [initialMissionState(), collected()]) {
      const f = healthInterpretations(s);
      expect(f.slice(0, 2).map((x) => x.priority)).toEqual([
        'activity-requirement-unresolved',
        'activity-requirement-unresolved',
      ]);
      expect(f[0].priorityReason).toContain('not an observed individual impairment');
      expect(f[3].priorityReason).toContain('not ranked as a present medical concern');
      expect(canonical(f)).not.toMatch(/severityScore|riskScore|Somers/);
    }
  });
});

describe('monitoring plan and identity', () => {
  it('requires an explicit fictional designation without starting monitoring', () => {
    const s = collected();
    expect(s.monitoringPlans).toEqual([]);
    const designated = designate(s);
    const plan = designated.monitoringPlans[0];
    expect(plan).toMatchObject({
      designatedBy: fictionalReviewer,
      sourceAvailable: false,
      observation: 'device-heart-rate',
      watchId: 'cardiovascular',
      channel: { datatype: 19, qualityDatatype: 1000, unit: 'bpm' },
    });
    expect(planAvailability(plan, designated)).toEqual([
      'Fictional monitoring requirement designated',
      'Compatible device channel identified',
      'Device not connected',
      'Synthetic documented-format source available; live source unavailable',
      'Monitoring not yet started',
    ]);
    expect(plan.channel.context).toContain('sample-aligned quality');
    expect(plan.channel.limitation).toContain('cannot replace the cycling pair');
    expect(plan).not.toHaveProperty('threshold');
    expect(plan).not.toHaveProperty('connected');
    expect(missionReducer(designated, { type: 'designate-monitoring' })).toBe(designated);
    expect(() => validatePlan(plan)).not.toThrow();
  });
  it('retains separate channel contracts and explicit pressure limitations', () => {
    expect(channelContracts.map((c) => [c.measurement, c.datatype, c.qualityDatatype])).toEqual([
      ['device-heart-rate', 19, 1000],
      ['breathing-rate', 33, 1001],
      ['oxygen-saturation', 66, 1002],
      ['systolic-pressure-estimate', 98, 1005],
    ]);
    expect(channelContracts[3].limitation).toContain(
      'cannot supply cuff pressure, diastolic pressure or MAP',
    );
  });
  it('binds mission, astronaut, session, revisions, exact records and all policies', () => {
    const s = collected();
    const id = evidenceIdentity(s);
    expect(id).toMatchObject({
      missionId: 'DEMO-MARS-01',
      astronautId: 'FICTIONAL-01',
      sessionId: s.sessionId,
      contextRevision: 1,
      evidenceRevision: 2,
      fixtureRevision: s.fixtureRevision,
      versions: currentVersions,
    });
    expect(JSON.parse(id.evidenceContextKey).records[1]).toEqual(missionObservations()[1]);
    expect(identityMatches(id, s)).toBe(true);
    const reordered = JSON.parse(JSON.stringify(s));
    reordered.context = Object.fromEntries(Object.entries(reordered.context).reverse());
    expect(identityMatches(id, reordered)).toBe(true);
  });
  it.each(['source', 'interpretation', 'monitoringPolicy', 'reviewPolicy'] as const)(
    'invalidates currency after %s version changes',
    (version) => {
      const s = designate();
      const id = s.monitoringPlans[0].basis;
      expect(identityMatches(id, s, { ...currentVersions, [version]: 'changed-2' })).toBe(false);
    },
  );
  it.each(['retrieve', 'remove', 'exclude', 'restore', 'context', 'restart'] as const)(
    'makes earlier plans stale after %s',
    (operation) => {
      let s = operation === 'retrieve' ? initialMissionState() : collected();
      if (operation === 'restore')
        s = missionReducer(s, {
          type: 'record-availability',
          recordId: 'mars-hr-jun28',
          available: false,
        });
      s = designate(s);
      const plan = s.monitoringPlans[0];
      if (operation === 'retrieve')
        s = missionReducer(s, { type: 'retrieve-record', record: missionObservations()[1] });
      if (operation === 'remove') s = missionReducer(s, { type: 'remove-retrieved-record' });
      if (operation === 'exclude')
        s = missionReducer(s, {
          type: 'record-availability',
          recordId: 'mars-hr-jun28',
          available: false,
        });
      if (operation === 'restore')
        s = missionReducer(s, {
          type: 'record-availability',
          recordId: 'mars-hr-jun28',
          available: true,
        });
      if (operation === 'context')
        s = missionReducer(s, { type: 'context-change', context: surface() });
      if (operation === 'restart') s = missionReducer(s, { type: 'restart' });
      expect(planCurrency(plan, s)).toBe('stale');
      expect(planAvailability(plan, s)).toContain('Monitoring plan stale');
      expect(s.monitoringPlans[0]).toBe(plan);
    },
  );
  it('does not equate divergent revisions or restored numbers', () => {
    const base = initialMissionState();
    const a = missionReducer(base, { type: 'retrieve-record', record: missionObservations()[1] });
    const b = missionReducer(base, {
      type: 'record-availability',
      recordId: 'mars-force-preflight',
      available: false,
    });
    expect(a.evidenceRevision).toBe(b.evidenceRevision);
    expect(evidenceIdentity(a)).not.toEqual(evidenceIdentity(b));
    const before = evidenceIdentity(a);
    const undone = missionReducer(a, { type: 'remove-retrieved-record' });
    const restored = missionReducer(undone, {
      type: 'retrieve-record',
      record: missionObservations()[1],
    });
    expect(missionOverview(restored).exerciseComparison?.absolute).toBe(15);
    expect(identityMatches(before, restored)).toBe(false);
  });
  it('does not rely on revisions alone for two concurrent equivalent mutations', () => {
    const base = initialMissionState();
    const a = missionReducer(base, { type: 'retrieve-record', record: missionObservations()[1] });
    const b = missionReducer(base, { type: 'retrieve-record', record: missionObservations()[1] });
    expect(a.evidenceRevision).toBe(b.evidenceRevision);
    expect(a.sessionId).toBe(b.sessionId);
    expect(evidenceIdentity(a).fingerprint).not.toBe(evidenceIdentity(b).fingerprint);
  });
});

describe('fictional human review snapshots', () => {
  it('starts without review and records the real findings, missing requirements and plan', () => {
    expect(reviewStatus(initialMissionState())).toBe('No human review recorded.');
    const s = reviewed();
    const r = s.reviews[0];
    expect(r.reviewer).toBe(fictionalReviewer);
    expect(r.findings.find((f) => f.id === 'cardiovascular')?.recordedObservation).toContain(
      '+15 bpm',
    );
    expect(r.unresolvedRequirementIds).toEqual(['aerobic', 'mobility']);
    expect(r.coverage).toMatchObject({ available: 1, total: 2 });
    expect(r.monitoringPlans[0].currencyAtReview).toBe('current');
    expect(r.createdAtLocal).not.toBe(r.fictionalRecordedAt);
    expect(reviewStatus(s)).toBe('Review recorded for the current evidence.');
    expect(reviewCurrency(r, s)).toBe('current-review');
    expect(() => validateReview(r)).not.toThrow();
  });
  it.each(Object.keys(dispositions))(
    'records the bounded %s disposition without clearance',
    (disposition) => {
      const s = missionReducer(collected(), {
        type: 'save-review',
        selection: { ...selection, disposition: disposition as ReviewSelection['disposition'] },
      });
      expect(s.reviews[0].disposition).toBe(disposition);
      expect(s.reviews[0]).not.toHaveProperty('cleared');
      expect(reviewStatus(s)).toContain(
        disposition === 'findings-reviewed' ? 'Review recorded' : 'Further review requested',
      );
    },
  );
  it('preserves immutable historical contents when the active comparison becomes unsupported', () => {
    const original = reviewed();
    const r = original.reviews[0];
    const before = JSON.stringify(r);
    expect(() => {
      r.findings[0].meaning = 'changed';
    }).toThrow();
    expect(() => r.reasons.push('force-followup')).toThrow();
    const changed = missionReducer(original, { type: 'remove-retrieved-record' });
    expect(missionOverview(changed).exerciseComparison).toBeUndefined();
    expect(healthInterpretations(changed)[2].recordedObservation).not.toContain('+15');
    expect(JSON.stringify(changed.reviews[0])).toBe(before);
    expect(reviewCurrency(r, changed)).toBe('stale-review');
    expect(planCurrency(changed.monitoringPlans[0], changed)).toBe('stale');
    expect(reviewStatus(changed)).toContain('New review required');
    const restored = missionReducer(changed, {
      type: 'retrieve-record',
      record: missionObservations()[1],
    });
    expect(reviewCurrency(r, restored)).toBe('stale-review');
  });
  it('stales a review after changing the monitoring plan without changing evidence', () => {
    const s = missionReducer(collected(), { type: 'save-review', selection });
    const next = designate(s);
    expect(next.evidenceRevision).toBe(s.evidenceRevision);
    expect(reviewCurrency(s.reviews[0], next)).toBe('stale-review');
  });
  it('separates restart generations while retaining earlier snapshots', () => {
    const s = reviewed();
    const next = missionReducer(s, { type: 'restart' });
    expect(next.sessionId).not.toBe(s.sessionId);
    expect(next.reviews[0]).toBe(s.reviews[0]);
    expect(reviewCurrency(next.reviews[0], next)).toBe('stale-review');
    expect(planCurrency(next.monitoringPlans[0], next)).toBe('stale');
    const back = collected();
    expect(reviewCurrency(next.reviews[0], back)).toBe('stale-review');
  });
  it('round trips the complete snapshot and freezes resumed histories', () => {
    const s = reviewed();
    const decoded = decodeMission(encodeMission(s));
    expect(decoded).toEqual({ state: s, notice: '' });
    expect(Object.isFrozen(decoded.state.reviews[0].findings[0])).toBe(true);
    expect(Object.isFrozen(decoded.state.monitoringPlans[0].basis.versions)).toBe(true);
  });
  it('migrates Phase 2 selections without fabricating a review', () => {
    const s = collected();
    const {
      reviewSchemaVersion: _schema,
      evidenceLineage: _lineage,
      planRevision: _revision,
      monitoringPlans: _plans,
      reviews: _reviews,
      droppedHistory: _dropped,
      ...old
    } = s;
    void [_schema, _lineage, _revision, _plans, _reviews, _dropped];
    const resumed = decodeMission(JSON.stringify(old));
    expect(resumed.state.sessionId).toBe(s.sessionId);
    expect(resumed.state.includedRecordIds).toEqual(s.includedRecordIds);
    expect(resumed.state.reviews).toEqual([]);
    expect(resumed.notice).toContain('Phase 2 mission was resumed');
  });
  it('bounds plan and review history with explicit eviction counts', () => {
    let s = collected();
    for (let i = 0; i < 8; i++) {
      s = missionReducer(s, { type: 'context-change', context: { ...s.context } });
      s = designate(s);
      s = missionReducer(s, { type: 'save-review', selection });
    }
    expect(s.reviews).toHaveLength(historyLimit);
    expect(s.monitoringPlans).toHaveLength(historyLimit);
    expect(s.droppedHistory).toEqual({ plans: 3, reviews: 3 });
    expect(encodeMission(s).length).toBeLessThan(300000);
    expect(decodeMission(encodeMission(s))).toEqual({ state: s, notice: '' });
  });
  it.each([
    { disposition: 'cleared', reasons: ['functional-unknown'], priority: 'routine-review' },
    { disposition: 'findings-reviewed', reasons: [], priority: 'routine-review' },
    {
      disposition: 'findings-reviewed',
      reasons: ['functional-unknown', 'functional-unknown'],
      priority: 'routine-review',
    },
    {
      disposition: 'findings-reviewed',
      reasons: ['# Generated medical clearance'],
      priority: 'routine-review',
    },
    { disposition: 'findings-reviewed', reasons: ['functional-unknown'], priority: 'emergency' },
    { ...selection, reviewer: 'Real physician' },
  ])('rejects unbounded review selection %j', (bad) => {
    const s = collected();
    expect(() =>
      missionReducer(s, { type: 'save-review', selection: bad as ReviewSelection }),
    ).toThrow();
    expect(s.reviews).toEqual([]);
  });
  it.each(['role', 'version', 'nested-plan', 'findings', 'context', 'duplicate', 'oversize'])(
    'rejects invalid saved %s records visibly',
    (kind) => {
      const s = JSON.parse(encodeMission(reviewed()));
      if (kind === 'role') s.reviews[0].reviewer = 'NASA flight surgeon';
      if (kind === 'version') s.reviews[0].schemaVersion = 100;
      if (kind === 'nested-plan') s.reviews[0].monitoringPlans[0].plan.sourceAvailable = true;
      if (kind === 'findings') s.reviews[0].findings[0].sourceIds = ['invented-source'];
      if (kind === 'context')
        s.reviews[0].context.nextActivity.label = 'Changed without matching basis';
      if (kind === 'duplicate') s.reviews.push(s.reviews[0]);
      if (kind === 'oversize') s.reviews = Array(6).fill(s.reviews[0]);
      const decoded = decodeMission(JSON.stringify(s));
      expect(decoded.notice).toContain('could not be resumed');
      expect(decoded.state.reviews).toEqual([]);
    },
  );
});

describe('canonical handoff and writer boundaries', () => {
  it('uses one object for preview, HTML and structured JSON and retains exact evidence', () => {
    const s = reviewed();
    const doc = handoffDocument(s.reviews[0], s, '2026-11-14T12:00:00.000Z');
    const html = handoffHtml(doc);
    expect(doc.sections).toHaveLength(13);
    expect(doc.snapshot).toBe(s.reviews[0]);
    for (const section of doc.sections) expect(html).toContain(section.heading);
    const embedded = html.match(/id="canonical-review">([\s\S]*?)<\/script>/)![1];
    expect(JSON.parse(embedded)).toEqual(JSON.parse(JSON.stringify(doc)));
    expect(html).toContain('+15 bpm');
    expect(html).toContain('1 of 2 approach');
    expect(html).toContain(fictionalReviewer);
    expect(html).toContain('aerobic, mobility');
    expect(html).not.toContain('UNVERIFIED');
    expect(doc.currency).toBe('current-review');
  });
  it('exports stale historical findings alongside current envelope currency', () => {
    const s = reviewed();
    const before = JSON.stringify(s.reviews[0]);
    const next = missionReducer(s, { type: 'remove-retrieved-record' });
    const doc = handoffDocument(next.reviews[0], next);
    expect(doc.currency).toBe('stale-review');
    expect(JSON.stringify(doc.snapshot)).toBe(before);
    expect(
      doc.sections.find((x) => x.heading === 'Currency and provenance')?.lines.join(' '),
    ).toContain('new review required');
    expect(
      doc.sections.find((x) => x.heading === 'Monitoring-plan status')?.lines.join(' '),
    ).toContain('stale against current evidence');
    expect(doc.snapshot.findings[2].recordedObservation).toContain('+15');
  });
  it('marks an earlier matching review as a superseded historical snapshot', () => {
    const s = reviewed();
    const next = missionReducer(s, { type: 'save-review', selection });
    expect(reviewCurrency(next.reviews[0], next)).toBe('historical-snapshot');
    expect(reviewCurrency(next.reviews[1], next)).toBe('current-review');
  });
  it('escapes HTML and embedded JSON without accepting user-authored headings', () => {
    const s = reviewed();
    const doc = structuredClone(handoffDocument(s.reviews[0], s));
    doc.sections[0].lines.push('<script>alert(1)</script><h1>Clearance</h1>');
    const html = handoffHtml(doc);
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;h1&gt;Clearance&lt;/h1&gt;');
    expect(html).toContain('\\u003cscript>');
    expect(html.match(/<h1>/g)).toHaveLength(1);
  });
  it('writes only against the exact expected raw state and preserves a newer writer', () => {
    let raw: string | null = null;
    let writes = 0;
    const storage = {
      getItem: () => raw,
      setItem: (_key: string, value: string) => {
        raw = value;
        writes++;
      },
    };
    const s = collected();
    const saved = persistMission(storage, null, s);
    expect(writes).toBe(1);
    raw = encodeMission(missionReducer(s, { type: 'remove-retrieved-record' }));
    const newest = raw;
    expect(() => persistMission(storage, saved, reviewed())).toThrow('mission-write-conflict');
    expect(raw).toBe(newest);
    expect(writes).toBe(1);
  });
});

describe('saved history currency across implementation changes', () => {
  it('retains valid snapshots as stale after a fixture-generation reset', () => {
    const s = reviewed();
    const changed = { ...s, fixtureRevision: 'older-fixture-0' };
    const result = decodeMission(JSON.stringify(changed));
    expect(result.notice).toContain('new mission generation');
    expect(result.state.sessionId).not.toBe(s.sessionId);
    expect(result.state.reviews).toEqual(s.reviews);
    expect(result.state.monitoringPlans).toEqual(s.monitoringPlans);
    expect(reviewCurrency(result.state.reviews[0], result.state)).toBe('stale-review');
  });
  it('validates historical fixture envelopes independently of the current source fixture', () => {
    const s = JSON.parse(encodeMission(reviewed()));
    const convert = (basis: (typeof s.reviews)[0]['basis']) => {
      const key = JSON.parse(basis.evidenceContextKey);
      for (const r of key.records) r.provenance.fixtureRevision = 'historical-fixture-0';
      basis.fixtureRevision = 'historical-fixture-0';
      basis.evidenceContextKey = canonical(key);
      basis.fingerprint = localFingerprint(basis.evidenceContextKey);
    };
    convert(s.monitoringPlans[0].basis);
    convert(s.reviews[0].basis);
    convert(s.reviews[0].monitoringPlans[0].plan.basis);
    for (const r of s.reviews[0].records) r.provenance.fixtureRevision = 'historical-fixture-0';
    const result = decodeMission(JSON.stringify(s));
    expect(result.notice).toBe('');
    expect(result.state.reviews[0].records[0].provenance.fixtureRevision).toBe(
      'historical-fixture-0',
    );
    expect(reviewCurrency(result.state.reviews[0], result.state)).toBe('stale-review');
  });
  it.each(['source', 'interpretation', 'monitoringPolicy', 'reviewPolicy'] as const)(
    'retains older %s versions visibly stale after reload',
    (version) => {
      const s = JSON.parse(encodeMission(reviewed()));
      s.reviews[0].basis.versions[version] = 'previous-0';
      s.monitoringPlans[0].basis.versions[version] = 'previous-0';
      s.reviews[0].monitoringPlans[0].plan.basis.versions[version] = 'previous-0';
      const result = decodeMission(JSON.stringify(s));
      expect(result.notice).toBe('');
      expect(result.state.reviews).toEqual(s.reviews);
      expect(reviewCurrency(result.state.reviews[0], result.state)).toBe('stale-review');
      expect(planCurrency(result.state.monitoringPlans[0], result.state)).toBe('stale');
    },
  );
  it('rejects mismatched generated content for the current interpretation templates', () => {
    const s = JSON.parse(encodeMission(reviewed()));
    s.reviews[0].findings[2].meaning = 'The astronaut is cleared for landing.';
    expect(decodeMission(JSON.stringify(s)).notice).toContain('could not be resumed');
  });
  it('preserves exact identity even when a short fingerprint could collide', () => {
    const s = collected();
    const basis = evidenceIdentity(s);
    const changed = structuredClone(basis);
    changed.evidenceContextKey = changed.evidenceContextKey.replace(
      'Mars landing',
      'Mars transfer',
    );
    changed.fingerprint = basis.fingerprint;
    expect(identityMatches(changed, s)).toBe(false);
  });
  it('records excluded historical force as excluded and keeps a force change unknown', () => {
    const s = missionReducer(collected(), {
      type: 'record-availability',
      recordId: 'mars-force-preflight',
      available: false,
    });
    const f = healthInterpretations(s).find((x) => x.id === 'musculoskeletal')!;
    expect(f.evidenceStatus).toBe('excluded');
    expect(f.recordedObservation).not.toContain('1,000');
    expect(f.meaning).toContain('remain unknown');
  });
});

it('keeps different plan designations distinct even with equal plan revisions and evidence', () => {
  const base = collected();
  const a = missionReducer(designate(base), { type: 'save-review', selection });
  const b = designate(base);
  const divergent = { ...b, reviews: a.reviews };
  expect(a.planRevision).toBe(b.planRevision);
  expect(evidenceIdentity(a)).toEqual(evidenceIdentity(b));
  expect(a.monitoringPlans[0].id).not.toBe(b.monitoringPlans[0].id);
  expect(reviewCurrency(a.reviews[0], divergent)).toBe('stale-review');
  expect(reviewStatus(divergent)).toContain('New review required');
});
