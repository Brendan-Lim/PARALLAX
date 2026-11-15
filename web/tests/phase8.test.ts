import { packMission, unpackMission } from '../src/mission/storageEncoding';
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PairedObservationChart } from '../src/mission/PairedObservationChart';
import {
  initialMissionState,
  initialRichMissionState,
  missionReducer,
  decodeMission,
  encodeMission,
} from '../src/mission/state';
import { missionOverview } from '../src/mission/overview';
import {
  allMissionObservations,
  descriptiveRecords,
  descriptiveComparisons,
} from '../src/mission/richEvidence';
import { missionObservations, validateObservations } from '../src/mission/observations';
import { missionChapter, surfaceDiary } from '../src/mission/chapters';
import { missionPhases, initialContext } from '../src/mission/context';
import { identityMatches, evidenceIdentity, canonical } from '../src/mission/identity';
import { createReview, validateReview } from '../src/mission/review';
import { archiveRecords } from '../src/mission/archive';
import { handoffDocument, handoffHtml } from '../src/mission/handoff';
import {
  availableScenarioMatches,
  freshGuidedCase,
  encodeGuided,
  decodeGuided,
  workspaceSessionFrom,
} from '../src/site/guidedState';
import { evaluate } from '../src/core/engine';
import { comparisonBridge } from '../src/mission/bridge';
import { readPlanning } from '../src/mission/PlanningRequest';

describe('Phase 8 chart annotation regression', () => {
  it('plots only the known observation and places missing-record copy outside the SVG', () => {
    const html = renderToStaticMarkup(
      createElement(PairedObservationChart, {
        early: { value: 125, label: '15 June 2040' },
        unit: 'bpm',
        title: 'Exercise',
        description: 'One available observation',
        missingLabel: '28 June: in archive, not in this review',
      }),
    );
    const svg = html.slice(html.indexOf('<svg'), html.indexOf('</svg>'));
    expect(svg.match(/<circle/g)).toHaveLength(1);
    expect(svg).not.toContain('in archive');
    expect(html.indexOf('28 June')).toBeGreaterThan(html.indexOf('</svg>'));
    expect(svg).toContain('aria-describedby');
  });
  it.each([125, 125.01, 140])(
    'separates values and long labels for a later value of %s',
    (value) => {
      const html = renderToStaticMarkup(
        createElement(PairedObservationChart, {
          early: {
            value: 125,
            label: 'Wednesday 15 June 2040, final minute of a recorded cycling session',
          },
          late: { value, label: 'Thursday 28 June 2040, matching recorded conditions' },
          unit: 'bpm',
          title: 'Pair',
          description: 'Value-axis comparison',
          difference: 'Difference',
        }),
      );
      const svg = html.slice(0, html.indexOf('</svg>'));
      expect(svg).toContain('y="58"');
      expect(svg).toContain('y="160"');
      expect(svg).not.toContain('Wednesday');
      expect(html).toContain('Wednesday');
      expect(svg.match(/<circle/g)).toHaveLength(2);
    },
  );
});
describe('versioned fictional health register', () => {
  it('preserves original fixture identities and values', () => {
    expect(missionObservations().map((r) => [r.id, r.value])).toEqual([
      ['mars-hr-jun15', 125],
      ['mars-hr-jun28', 140],
      ['mars-force-preflight', 1000],
    ]);
    expect(initialMissionState().includedRecordIds).toHaveLength(2);
  });
  it('validates every new record with distinct source identity', () => {
    const records = validateObservations(
      allMissionObservations(),
      initialRichMissionState().context,
    );
    expect(records).toHaveLength(10);
    expect(
      new Set(descriptiveRecords().map((r) => r.provenance.sourceRecord + r.measurement)).size,
    ).toBe(7);
  });
  it.each([
    'unit',
    'value',
    'protocol',
    'acquisition',
    'origin',
    'timestamp',
    'gravity',
    'provenance',
  ])('rejects invalid new-record %s', (field) => {
    const r = descriptiveRecords()[0] as unknown as Record<string, unknown>;
    r[field] = field === 'value' ? -1 : 'invalid';
    expect(() => validateObservations([r], initialContext)).toThrow();
  });
  it('rejects unknown calibration/qualification fields and absent acquisition declarations', () => {
    const r = descriptiveRecords()[0];
    if (r.measurement !== 'vo2peak') throw Error();
    r.acquisition.qualification = 'visitor';
    expect(() => validateObservations([r], initialContext)).toThrow();
  });
  it('rejects incompatible diary reporting periods', () => {
    const r = descriptiveRecords().find((r) => r.measurement === 'reported-sleep-duration')!;
    if (r.measurement !== 'reported-sleep-duration') throw Error();
    r.acquisition.periodStart = r.acquisition.periodEnd;
    expect(() => validateObservations([r], initialContext)).toThrow();
  });
  it('does not extend the legacy evaluator contract to new quantities', () => {
    expect(() =>
      comparisonBridge(initialContext, descriptiveRecords(), {
        recordIds: [],
        policy: 'explicit-assessment-selection-v1',
      }),
    ).toThrow(/legacy bridge/);
  });
  it('supports two of three requirements before retrieval and three after actual retrieval', () => {
    const s = initialRichMissionState();
    expect(missionOverview(s).coverage).toMatchObject({
      available: 2,
      total: 3,
      ids: ['exercise', 'aerobic', 'sleep'],
    });
    const next = missionReducer(s, { type: 'retrieve-record', record: archiveRecords()[0] });
    expect(missionOverview(next).coverage.available).toBe(3);
    expect(missionOverview(next).exerciseComparison?.absolute).toBe(15);
    expect(
      missionOverview(missionReducer(next, { type: 'remove-retrieved-record' })).coverage.available,
    ).toBe(2);
  });
  it('compares measured oxygen uptake and equivalent diary periods separately', () => {
    const c = missionOverview(initialRichMissionState()).descriptive;
    expect(c.map((r) => [r.measurement, r.difference])).toEqual([
      ['vo2peak', -0.1],
      ['reported-sleep-duration', -1],
    ]);
  });
  it('withholds comparisons for changed device calibration, flagged quality or excluded source', () => {
    for (const kind of ['calibration', 'quality', 'excluded']) {
      const records = allMissionObservations();
      const r = records.find(
        (r) => r.measurement === 'vo2peak' && r.comparisonRole === 'followup',
      )!;
      if (r.measurement !== 'vo2peak') throw Error();
      if (kind === 'calibration') r.acquisition.calibration = 'another-declaration';
      if (kind === 'quality') r.quality.flags = ['unresolved-quality'];
      expect(
        descriptiveComparisons(records, initialContext, kind === 'excluded' ? [r.id] : [])[0]
          .supported,
      ).toBe(false);
    }
  });
  it('binds all new evidence to identity, currency, schema 2 and canonical exports', () => {
    const s = initialRichMissionState();
    const review = createReview(s, {
      disposition: 'findings-reviewed',
      reasons: ['exercise-context'],
      priority: 'routine-review',
    });
    validateReview(review);
    expect(review.schemaVersion).toBe(2);
    expect(review.findings).toHaveLength(5);
    expect(review.coverage.available).toBe(2);
    expect(decodeMission(encodeMission({ ...s, reviews: [review] })).state.reviews).toEqual([
      review,
    ]);
    const removed = missionReducer(s, {
      type: 'record-availability',
      recordId: s.includedRecordIds.find((id) => id.includes('vo2peak-2040-06-27'))!,
      available: false,
    });
    expect(identityMatches(evidenceIdentity(s), removed)).toBe(false);
    expect(missionOverview(removed).coverage.available).toBe(1);
    const doc = handoffDocument(review, { ...s, reviews: [review] });
    expect(doc.snapshot.records).toHaveLength(6);
    expect(handoffHtml(doc)).toContain('reported-sleep-duration');
    expect(canonical(doc.snapshot)).toBe(canonical(review));
  });
  it('preserves legacy schema 1 reviews without adding new records on reload', () => {
    const s = initialMissionState();
    const review = createReview(s, {
      disposition: 'findings-reviewed',
      reasons: ['exercise-context'],
      priority: 'routine-review',
    });
    expect(review.schemaVersion).toBe(1);
    expect(
      decodeMission(encodeMission({ ...s, reviews: [review] })).state.includedRecordIds,
    ).toEqual(s.includedRecordIds);
  });
});
describe('chronological chapter isolation', () => {
  it.each(missionPhases)('%s validates a dated projection without future records', (phase) => {
    const c = missionChapter(phase);
    expect(validateObservations(c.records, c.context)).toEqual(c.records);
    expect(c.records.every((r) => r.timestamp <= c.context.fictionalNow)).toBe(true);
    if (phase === 'preflight') {
      expect(c.records.every((r) => r.missionPhase === 'preflight')).toBe(true);
      expect(c.records.some((r) => r.measurement === 'exercise-hr')).toBe(false);
    }
  });
  it('does not mutate active saved work, membership, plans or immutable reviews', () => {
    let s = initialRichMissionState();
    s = missionReducer(s, { type: 'designate-monitoring' });
    const before = encodeMission(s);
    for (const p of missionPhases) missionChapter(p);
    expect(encodeMission(s)).toBe(before);
    expect(surfaceDiary.validatedPerformance).toBe(false);
    expect(missionChapter('surface').descriptive.every((c) => !c.supported)).toBe(true);
  });
});
describe('available evaluator-backed scenarios', () => {
  it('DEMO-01 retains all four precise endpoints and undo/transfer state', () => {
    const c = freshGuidedCase('complete');
    const findings = evaluate(c.packet);
    expect(
      findings
        .filter((f) => f.comparison)
        .map((f) => [f.id, f.comparison!.baseline.value, f.comparison!.followup.value]),
    ).toEqual([
      ['force', 1000, 1050],
      ['cardio', 20, 35],
      ['tandem', 95, 80],
      ['task', 20, 26],
    ]);
    const edited = {
      ...c,
      unavailable: ['DEMO-01-force-followup'],
      undo: { packet: c.packet, unavailable: [] },
      reached: 4,
    };
    const store = decodeGuided(encodeGuided({ cases: { complete: edited }, completed: [] }));
    expect(
      evaluate(store.cases.complete!.packet, store.cases.complete!.unavailable).find(
        (f) => f.id === 'force',
      )?.comparison,
    ).toBeUndefined();
    expect(workspaceSessionFrom('complete', edited).unavailable).toEqual(edited.unavailable);
    expect(edited.undo.packet).toEqual(c.packet);
  });
  it('DEMO-05 remains a compatible 100 W comparison', () => {
    const c = freshGuidedCase('exercise');
    expect(evaluate(c.packet).find((f) => f.id === 'hr')?.comparison?.absolute).toBe(15);
  });
});
it('planning persistence accepts bounded fixed fictional requests and rejects visitor fields', () => {
  expect(
    readPlanning(
      '[{"version":1,"need":"surface-mobility","recordedAt":"2026-11-15T12:00:00Z","status":"for-qualified-review"}]',
    ),
  ).toHaveLength(1);
  expect(readPlanning('[{"version":1,"need":"surface-mobility","visitorHealth":"x"}]')).toEqual([]);
});

it('lossless shared-value storage preserves canonical state and rejects cyclic/bomb references', () => {
  const s = initialRichMissionState();
  const packed = packMission(s);
  expect(unpackMission(JSON.parse(packed))).toEqual(s);
  const bad = JSON.parse(packed);
  bad.values[0] = { $ref: 0 };
  expect(() => unpackMission(bad)).toThrow();
  expect(() =>
    unpackMission({
      storageSchemaVersion: 3,
      encoding: 'shared-values-v1',
      values: [Array(10001).fill({ $ref: 0 })],
      state: { $ref: 0 },
    }),
  ).toThrow();
});

it.each(['complete', 'exercise'] as const)(
  'positive %s teaching rejects colliding edited fixture identifiers',
  (key) => {
    const c = freshGuidedCase(key);
    expect(availableScenarioMatches(c.packet)).toBe(true);
    c.packet.observations[0].value += 1;
    expect(availableScenarioMatches(c.packet)).toBe(false);
    expect(c.packet.case.id).toBe(key === 'complete' ? 'DEMO-01' : 'DEMO-05');
  },
);
