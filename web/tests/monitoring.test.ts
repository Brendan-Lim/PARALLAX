import { expect, it } from 'vitest';
import { freshCase } from '../src/data/cases';
import { applyEntry, entryDraft } from '../src/core/entry';
import { evaluate, evaluateMeasure } from '../src/core/engine';
import { currentActionState, healthActions } from '../src/core/actions';
import { missionContext, feasibility, missionPhases } from '../src/core/context';
import { initialSession, encodeSession, decodeSession } from '../src/core/session';
import { reviewMarkdown } from '../src/core/review';
import { validatePacket } from '../src/core/validate';
import { publishedAssociations, sources } from '../src/data/science';

it('manual entry restores a missing task claim with hand-calculated change', () => {
  const packet = freshCase('DEMO-02');
  const next = applyEntry(packet, {
    ...entryDraft(packet, 'task', 'followup'),
    value: '30',
    session: 'POST-DEMO',
    sourceRecord: 'manual-task-followup',
  });
  expect(evaluateMeasure(next, 'task').comparison?.absolute).toBe(6);
  expect(evaluateMeasure(next, 'task').comparison?.relative).toBe(25);
  expect(evaluateMeasure(next, 'force').comparison?.absolute).toBe(27);
  expect(packet.observations).toHaveLength(7);
  expect(next.observations).toHaveLength(8);
});
it.each(['', ' ', 'NaN', 'Infinity', '-1', '0x10'])(
  'invalid task entry %s is rejected atomically',
  (value) => {
    const p = freshCase();
    const before = JSON.stringify(p);
    expect(() => applyEntry(p, { ...entryDraft(p, 'task', 'followup'), value })).toThrow();
    expect(JSON.stringify(p)).toBe(before);
  },
);
it('manual units and malformed dates use the shared validator', () => {
  const p = freshCase();
  expect(() => applyEntry(p, { ...entryDraft(p, 'force', 'followup'), unit: 'kg' })).toThrow(
    /unit/,
  );
  expect(() =>
    applyEntry(p, { ...entryDraft(p, 'force', 'followup'), timestamp: '2026-02-30T00:00:00Z' }),
  ).toThrow(/timestamp/);
});
it('manual updates retain source issues and reject ambiguous replacement', () => {
  const p = freshCase();
  p.observations[1].issues = ['Unverified calibration'];
  expect(
    evaluateMeasure(
      applyEntry(p, { ...entryDraft(p, 'force', 'followup'), value: '1100' }),
      'force',
    ).status,
  ).toBe('unresolved');
  p.observations.push({ ...p.observations[1], id: 'duplicate' });
  expect(() => applyEntry(p, entryDraft(p, 'force', 'followup'))).toThrow();
});
it('missing evidence creates a record-management action, never triage', () => {
  const a = healthActions(freshCase('DEMO-02'), [], 'transition').find(
    (a) => a.id === 'task-missing',
  )!;
  expect(a.category).toBe('Record verification');
  expect(a.target).toBe('entry');
  expect(a.reason).toContain('cannot be established from muscular force');
  expect(a.limitation).toContain('already obtained authorised assessment');
});
it('restoration replaces the missing action and requires new review', () => {
  const p = freshCase();
  const a = healthActions(p, ['DEMO-01-task-followup'], 'transition').find(
    (a) => a.id === 'task-missing',
  )!;
  const receipts = { [a.id]: { signature: a.signature, state: 'Awaiting observation' as const } };
  expect(currentActionState(a, receipts)).toBe('Awaiting observation');
  const restored = healthActions(p, [], 'transition');
  expect(restored.some((a) => a.id === 'task-missing')).toBe(false);
  expect(
    currentActionState(
      restored.find((a) => a.id === 'task-review')!,
      receipts,
    ),
  ).toBe('Not reviewed');
});
it('incompatible records create verification rather than a medical conclusion', () => {
  const p = freshCase('DEMO-03');
  const a = healthActions(p, [], 'surface').find((a) => a.id === 'task-verify')!;
  expect(a.category).toBe('Record verification');
  expect(a.reason).toContain('incompatible measurement protocol');
  expect(evaluateMeasure(p, 'task').comparison).toBeUndefined();
});
it('different changes remain qualified-review questions without a causal explanation', () => {
  const a = healthActions(freshCase(), [], 'transition').find((a) => a.id === 'different-changes')!;
  expect(a.findingIds).toEqual(['force', 'task']);
  expect(a.category).toBe('Qualified review');
  expect(a.reason).toContain('No cause is assigned');
});
it('published context cannot substitute for any individual task record', () => {
  expect(publishedAssociations.map((a) => a.d)).toEqual([-0.305, 0.398, -0.428]);
  expect(sources.find((s) => s.id === 'bed-rest')?.boundary).toContain(
    'does not report study outcomes',
  );
  for (const phase of Object.keys(missionPhases) as (keyof typeof missionPhases)[])
    expect(
      healthActions(freshCase('DEMO-02'), [], phase).some((a) => a.id === 'task-missing'),
    ).toBe(true);
});
it('in-flight explanations change feasibility without mutating ground records', () => {
  const p = freshCase();
  const before = JSON.stringify(p);
  expect(feasibility(p, 'inflight', 'task')).toContain('not an in-flight microgravity assessment');
  expect(feasibility(p, 'surface', 'task')).toContain('already obtained authorised assessment');
  expect(missionContext(p, 'inflight').acquisition).toContain('Earth-based');
  expect(JSON.stringify(p)).toBe(before);
});
it.each(['preflight', 'inflight', 'transition', 'surface', 'analog'] as const)(
  'bed rest remains an analog in phase %s',
  (phase) => {
    const c = missionContext(freshCase('DEMO-03'), phase);
    expect(c.phase).toBe('analog');
    expect(c.identity).toBe('Synthetic bed-rest analog');
    expect(c.acquisition).toContain('Earth');
  },
);
it('legacy imports remain setting-unspecified, not presumed astronaut data', () => {
  const p = freshCase();
  delete p.context;
  expect(missionContext(validatePacket(p), 'inflight').identity).toContain('unspecified');
});
it('heart rate and MAP stay distinct from posture HR response', () => {
  let p = freshCase();
  for (const [measurement, unit, values] of [
    ['hr', 'bpm', [60, 65]],
    ['map', 'mmHg', [85, 82]],
  ] as const)
    for (const [i, phase] of (['baseline', 'followup'] as const).entries())
      p = applyEntry(p, {
        ...entryDraft(p, measurement, phase),
        value: String(values[i]),
        unit,
        session: i ? 'POST' : 'PRE',
        protocol: `demo-${measurement}`,
        window: 'demo-window',
        sourceId: 'synthetic-device',
        sourceRecord: `${measurement}-${phase}`,
      });
  expect(evaluateMeasure(p, 'hr').comparison?.absolute).toBe(5);
  expect(evaluateMeasure(p, 'map').comparison?.absolute).toBe(-3);
  expect(evaluateMeasure(p, 'cardio').comparison?.absolute).toBe(15);
});
it('plan completion and acknowledgement cannot confer support or clearance', () => {
  const s = initialSession();
  s.planCompleted = true;
  s.unavailable = ['DEMO-01-task-followup'];
  const a = healthActions(s.packet, s.unavailable, s.missionPhase).find(
    (a) => a.id === 'task-missing',
  )!;
  s.receipts[a.id] = { signature: a.signature, state: 'Acknowledged' };
  expect(currentActionState(a, s.receipts)).toBe('Acknowledged');
  expect(evaluateMeasure(s.packet, 'task', s.unavailable).status).toBe('insufficient');
  expect(
    evaluate(s.packet)
      .filter((f) => f.status === 'outside')
      .map((f) => f.id),
  ).toEqual(['overall', 'clearance']);
  const out = reviewMarkdown(s.packet, s.unavailable, [], s.note, '2026-11-14T01:00:00Z', s);
  expect(out).toContain('recorded completed');
  expect(out).toContain('not evidence of function or medical clearance');
});
it('relevant evidence changes invalidate review while unrelated changes retain it', () => {
  const p = freshCase();
  const a = healthActions(p, [], 'transition').find((a) => a.id === 'force-review')!;
  const receipts = { [a.id]: { signature: a.signature, state: 'Acknowledged' as const } };
  const next = structuredClone(p);
  next.observations[1].value = 1100;
  expect(
    currentActionState(
      healthActions(next, [], 'transition').find((v) => v.id === a.id)!,
      receipts,
    ),
  ).toBe('Not reviewed');
  expect(
    currentActionState(
      healthActions(p, ['DEMO-01-task-followup'], 'transition').find((v) => v.id === a.id)!,
      receipts,
    ),
  ).toBe('Acknowledged');
  expect(
    currentActionState(
      healthActions(p, [], 'inflight').find((v) => v.id === a.id)!,
      receipts,
    ),
  ).toBe('Not reviewed');
});
it('context, receipts, plan completion and undo persist and validate', () => {
  const s = initialSession();
  const a = healthActions(s.packet, [], s.missionPhase)[0];
  s.receipts[a.id] = { signature: a.signature, state: 'Recorded for qualified review' };
  s.undo = { packet: freshCase('DEMO-02'), unavailable: [] };
  s.planCompleted = true;
  s.missionPhase = 'inflight';
  expect(decodeSession(encodeSession(s)).session).toEqual(s);
  expect(
    decodeSession(JSON.stringify({ ...s, version: 1, missionPhase: 'Mars-ready' })).notice,
  ).toContain('invalid');
});
it('legacy sessions migrate without inventing a completed plan', () => {
  const s = decodeSession(
    JSON.stringify({ version: 1, packet: freshCase(), unavailable: [], marked: [], note: '' }),
  );
  expect(s.notice).toBe('');
  expect(s.session.missionPhase).toBe('transition');
  expect(s.session.planCompleted).toBe(false);
});
it('exports retain context, evidence gaps, action reasons and current acknowledgement', () => {
  const s = initialSession();
  s.packet = freshCase('DEMO-02');
  s.missionPhase = 'inflight';
  const a = healthActions(s.packet, [], s.missionPhase).find((a) => a.id === 'task-missing')!;
  s.receipts[a.id] = { signature: a.signature, state: 'Awaiting observation' };
  const out = reviewMarkdown(
    s.packet,
    [],
    ['task'],
    'Ask which result exists.',
    '2026-11-14T01:00:00Z',
    s,
  );
  for (const text of [
    'In-flight microgravity',
    'Earth-based',
    'Insufficient evidence',
    'Awaiting observation',
    'Record verification',
    'not an in-flight microgravity assessment',
    'https://www.nasa.gov/',
    'Ask which result',
  ])
    expect(out).toContain(text);
  expect(out).not.toContain('Follow-up: 26 s');
});

it('predefined human-study cases validate and match the scoring rubric', async () => {
  const { readFileSync } = await import('node:fs');
  for (const [name, absolute] of [
    ['A', 40],
    ['B', 60],
  ] as const) {
    const p = validatePacket(
      JSON.parse(
        readFileSync(new URL(`../../docs/evaluation/case-${name}.json`, import.meta.url), 'utf8'),
      ),
    );
    expect(evaluateMeasure(p, 'force').comparison?.absolute).toBe(absolute);
    expect(evaluateMeasure(p, 'force').comparison?.relative).toBe(5);
    expect(evaluateMeasure(p, 'tandem').status).toBe('unresolved');
    expect(evaluateMeasure(p, 'task').status).toBe('insufficient');
    expect(missionContext(p, 'inflight').phase).toBe('analog');
  }
});
