import { expect, it } from 'vitest';
import { freshCase } from '../src/data/cases';
import { evaluateMeasure, evaluate } from '../src/core/engine';
import { applyEntry, entryDraft } from '../src/core/entry';
import { healthActions } from '../src/core/actions';
import { initialSession, decodeSession, encodeSession } from '../src/core/session';
import { featuredScenarios, obtainedTaskFollowup } from '../src/data/scenarios';
import { validatePacket } from '../src/core/validate';

it('three featured scenarios cover missing direct, incompatible acquisition and dependent evidence', () => {
  expect(featuredScenarios).toHaveLength(3);
  const missing = freshCase('DEMO-02');
  expect(evaluateMeasure(missing, 'task').status).toBe('insufficient');
  expect(evaluateMeasure(missing, 'force').comparison?.absolute).toBe(27);
  const draft = entryDraft(
    { ...missing, observations: [...missing.observations, obtainedTaskFollowup] },
    'task',
    'followup',
  );
  const added = applyEntry(missing, draft);
  expect(evaluateMeasure(added, 'task').comparison?.absolute).toBe(5);
  expect(missing.observations.some((r) => r.phase === 'followup' && r.measurement === 'task')).toBe(
    false,
  );
  const flight = validatePacket(freshCase('DEMO-05-MISMATCH'));
  expect(evaluateMeasure(flight, 'hr').status).toBe('unresolved');
  expect(evaluateMeasure(flight, 'hr').comparison).toBeUndefined();
  const correction = entryDraft(flight, 'hr', 'followup');
  correction.acquisition!.workloadWatts = 100;
  const corrected = applyEntry(flight, correction);
  expect(evaluateMeasure(corrected, 'hr').comparison?.absolute).toBe(15);
  expect(evaluateMeasure(freshCase('DEMO-05'), 'hr').comparison?.absolute).toBe(15);
  expect(flight.observations[1].acquisition!.workloadWatts).toBe(120);
  const dependency = freshCase('DEMO-04');
  const unavailable = ['DEMO-04-force-followup'];
  expect(dependency.observations.find((r) => r.form === 'derived')?.derivedFrom).toEqual(
    unavailable,
  );
  expect(evaluateMeasure(dependency, 'force', unavailable).status).toBe('insufficient');
  expect(evaluateMeasure(dependency, 'task', unavailable).status).toBe('supported');
  expect(evaluate(dependency, unavailable).find((f) => f.id === 'overall')?.status).toBe('outside');
});
it('fixture resets and persistence retain acquisition origin and recompute current actions', () => {
  const p = freshCase('DEMO-05-MISMATCH');
  const session = { ...initialSession(), packet: p, missionPhase: 'inflight' as const };
  const stored = decodeSession(encodeSession(session)).session;
  expect(stored.packet.context?.kind).toBe('inflight-demo');
  expect(evaluateMeasure(stored.packet, 'hr').status).toBe('unresolved');
  expect(
    healthActions(stored.packet, [], stored.missionPhase).some((a) => a.findingIds.includes('hr')),
  ).toBe(true);
  const original = freshCase('DEMO-05-MISMATCH');
  stored.packet.observations[1].acquisition!.workloadWatts = 100;
  expect(original.observations[1].acquisition!.workloadWatts).toBe(120);
  expect(freshCase('DEMO-02').context?.kind).toBe('mission-demo');
  expect(freshCase('DEMO-04').observations.every((r) => !r.acquisition)).toBe(true);
});
