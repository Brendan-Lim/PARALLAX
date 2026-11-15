import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { freshCase } from '../src/data/cases';
import { evaluate, evaluateMeasure, comparisonSummary } from '../src/core/engine';
import { healthActions, currentActionState } from '../src/core/actions';
import { validatePacket } from '../src/core/validate';
import { missionContext } from '../src/core/context';
import { applyEntry, entryDraft } from '../src/core/entry';
import { reviewMarkdown } from '../src/core/review';
import { decodeSession, encodeSession, initialSession } from '../src/core/session';
import { researchAssociations, researchAssociationMethod } from '../src/data/research';
import { createElement } from 'react';
import { Result } from '../src/site/charts';

it('zero baselines retain supported absolute units in both actual rendered result summaries', () => {
  const p = freshCase();
  p.observations.find((r) => r.id === 'DEMO-01-force-baseline')!.value = 0;
  p.observations.find((r) => r.id === 'DEMO-01-force-followup')!.value = 10;
  p.observations.find((r) => r.id === 'DEMO-01-task-baseline')!.value = 0;
  p.observations.find((r) => r.id === 'DEMO-01-task-followup')!.value = 6;
  const findings = evaluate(p);
  // The guided result line replaces the removed Discover experiment as the rendered summary.
  const html = ['force', 'task']
    .map((id) =>
      renderToStaticMarkup(
        createElement(Result, { finding: findings.find((f) => f.id === id)!, label: id }),
      ),
    )
    .join('\n');
  expect(html).toContain('+10 N (relative % undefined: zero baseline)');
  expect(html).toContain('+6 s (relative % undefined: zero baseline)');
  expect(comparisonSummary(evaluateMeasure(p, 'task', ['DEMO-01-task-followup']))).toBe('unknown');
  expect(reviewMarkdown(p, [], [], '')).toContain(
    'relative percentage undefined: baseline is zero; absolute change supported',
  );
});
it('flight identity and acquisition metadata survive import, persistence and independent review phases', () => {
  const p = validatePacket(freshCase('DEMO-05'));
  const s = { ...initialSession(), packet: p, missionPhase: 'inflight' as const };
  expect(decodeSession(encodeSession(s)).session).toEqual(s);
  for (const phase of ['preflight', 'inflight', 'surface'] as const) {
    expect(missionContext(p, phase).identity).toContain('fictional microgravity records');
    expect(missionContext(freshCase(), phase).identity).toContain('ground assessment records');
    expect(missionContext(freshCase('DEMO-03'), phase).identity).toBe('Synthetic bed-rest analog');
  }
  expect(p.observations.map((r) => r.acquisition?.activity)).toEqual([
    'cycling-exercise',
    'cycling-exercise',
  ]);
});
it('compatible cycling HR supports only a hand-calculated +15 bpm comparison', () => {
  const p = freshCase('DEMO-05');
  const f = evaluateMeasure(p, 'hr');
  expect(f.status).toBe('supported');
  expect(f.comparison?.absolute).toBe(15);
  expect(f.comparison?.relative).toBeNull();
  expect(comparisonSummary(f)).toBe('+15 bpm');
  expect(f.limitations.join(' ')).toContain(
    'resting HR, posture-related HR difference and directly assessed aerobic capacity',
  );
  expect(evaluate(p).find((f) => f.id === 'task')?.status).toBe('insufficient');
  expect(
    evaluate(p)
      .filter((f) => ['overall', 'clearance'].includes(f.id))
      .every((f) => f.status === 'outside'),
  ).toBe(true);
});
it.each(['workloadWatts', 'timing', 'device', 'activity', 'setting'] as const)(
  'engine withholds HR when acquisition %s differs, without disturbing other findings',
  (key) => {
    const p = freshCase('DEMO-05');
    // Engine defence in depth also handles data that has not traversed the validator.
    Object.assign(p.observations[1].acquisition!, {
      [key]: key === 'workloadWatts' ? 120 : 'different-recorded-condition',
    });
    const f = evaluateMeasure(p, 'hr');
    expect(f.status).toBe('unresolved');
    expect(f.comparison).toBeUndefined();
    expect(f.evidence.map((r) => r.value)).toEqual([125, 140]);
    expect(f.issues.join(' ')).toContain(key === 'workloadWatts' ? '100 W and 120 W' : 'differ:');
    expect(evaluateMeasure(p, 'task').status).toBe('insufficient');
  },
);
it('missing acquisition cannot silently become compatible and malformed input is rejected', () => {
  const p = freshCase('DEMO-05');
  delete p.observations[1].acquisition;
  expect(() => validatePacket(p)).toThrow(/requires explicit acquisition/);
  expect(evaluateMeasure(p, 'hr').status).toBe('unresolved');
  const q = freshCase('DEMO-05');
  q.observations[1].acquisition!.workloadWatts = NaN;
  expect(() => validatePacket(q)).toThrow(/acquisition/);
});
it('entry retains selected source conditions, reassesses mismatch and invalidates acknowledgement', () => {
  const p = freshCase('DEMO-05');
  const original = healthActions(p, [], 'inflight').find((a) => a.id === 'hr-review')!;
  const draft = entryDraft(p, 'hr', 'followup');
  draft.acquisition!.workloadWatts = 120;
  const q = applyEntry(p, draft);
  const action = healthActions(q, [], 'inflight').find((a) => a.id === 'hr-verify')!;
  expect(action.applicability).toContain('present but incompatible');
  expect(evaluateMeasure(q, 'hr').comparison).toBeUndefined();
  expect(p.observations[1].acquisition!.workloadWatts).toBe(100);
  expect(
    currentActionState(action, {
      [original.id]: { signature: original.signature, state: 'Acknowledged' },
    }),
  ).toBe('Not reviewed');
  expect(entryDraft(q, 'hr', 'followup').acquisition!.workloadWatts).toBe(120);
});
it('flight and in-flight ground reviews never request absent Earth posture, walking or task tests', () => {
  for (const p of [freshCase('DEMO-05'), freshCase('DEMO-02')]) {
    const actions = healthActions(p, [], 'inflight');
    for (const id of ['cardio', 'tandem', 'task']) {
      const a = actions.find((a) => a.findingIds.includes(id as 'task'))!;
      expect(a.target).toBe('evidence');
      expect(a.title).not.toMatch(/Find the missing/);
      expect(a.reason).toContain('do not perform a ground test aboard a spacecraft');
    }
  }
  expect(
    healthActions(freshCase('DEMO-02'), [], 'transition').find((a) => a.id === 'task-missing')
      ?.target,
  ).toBe('entry');
});
it('current flight review exports acquisition, unresolved evidence, plan and question without a false transmission', () => {
  const p = freshCase('DEMO-05');
  p.observations[1].acquisition!.timing = 'different-phase';
  const report = reviewMarkdown(
    p,
    [],
    ['hr'],
    'Verify whether the session phase matches.',
    '2026-11-14T07:00:00.000Z',
    { missionPhase: 'inflight', receipts: {}, planCompleted: true },
  );
  for (const text of [
    'fictional microgravity records',
    'workloadWatts',
    'different-phase',
    'recorded measurement timings differ',
    'Relevant future assessment not yet available',
    'recorded completed',
    'Verify whether the session phase matches.',
    'Nothing has been transmitted',
  ])
    expect(report).toContain(text);
  expect(report).not.toContain('Change: +15 bpm');
});
it('seven associations match independently transcribed primary text and units with correct multiplicity interpretation', () => {
  const manifest = JSON.parse(
    readFileSync(new URL('../../docs/science/RESEARCH_VALUES_FINAL.json', import.meta.url), 'utf8'),
  );
  for (const association of researchAssociations) {
    const row = manifest.sources.find(
      (r: { id: string }) => r.id === 'association-' + association.measure,
    );
    expect(row.value).toBe(association.d);
    expect(row.physiological_original_unit).toBe(association.originalUnit);
    expect(row.source_locator).toContain('Table 3');
  }
  expect(researchAssociations.map((a) => a.d)).toEqual([
    -0.349, -0.305, -0.319, -0.293, -0.456, -0.428, 0.398,
  ]);
  expect(researchAssociations.map((a) => a.originalUnit)).toEqual([
    'L',
    'N',
    'W',
    'J',
    'continuous equilibrium score',
    '% correct steps',
    'bpm (standing minus prone)',
  ]);
  expect(researchAssociationMethod).toContain('105 association tests');
  expect(researchAssociationMethod).toContain('66 mixed-model');
  expect(researchAssociationMethod).toContain('rounded, never exactly zero');
});
