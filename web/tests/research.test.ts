import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { researchGroups, researchOutcomes } from '../src/data/research';
import { publishedAssociations } from '../src/data/science';
import { freshCase } from '../src/data/cases';
import { evaluate } from '../src/core/engine';
import { healthActions } from '../src/core/actions';
import { validatePacket } from '../src/core/validate';
const manifest = JSON.parse(
  readFileSync(new URL('../../docs/science/RESEARCH_VALUES_V3.json', import.meta.url), 'utf8'),
);
describe('V3 published facts and evidence boundaries', () => {
  it('displays only the primary-text transcription values with per-value provenance', () => {
    // Expected values were independently read from Discussion, not generated from application data.
    expect(researchOutcomes.map((o) => o.values)).toEqual([
      { iss: 31, control: 38, exercise: 23 },
      { iss: 66, control: 54, exercise: 42 },
    ]);
    expect(researchGroups.map((g) => g.n)).toEqual([13, 10, 9]);
    expect(publishedAssociations.map((a) => a.d)).toEqual([-0.305, 0.398, -0.428]);
    for (const outcome of researchOutcomes)
      for (const group of researchGroups) {
        const row = manifest.sources.find(
          (r: { id: string }) => r.id === outcome.id + '-' + group.id,
        );
        expect(row.value).toBe(outcome.values[group.id]);
        expect(row.cohort_n).toBe(group.n);
        for (const field of [
          'source_locator',
          'statistic',
          'transformation',
          'limitations',
          'reuse',
          'timepoint',
          'outcome_definition',
          'population',
          'original_unit',
        ])
          expect(row[field]).toBeTruthy();
      }
    for (const a of publishedAssociations)
      expect(
        manifest.sources.find((r: { id: string }) => r.id === 'association-' + a.measure).value,
      ).toBe(a.d);
  });
  it('excluding one task record changes its comparison and action while force and scope remain identical', () => {
    const packet = freshCase();
    const before = evaluate(packet);
    const after = evaluate(packet, ['DEMO-01-task-followup']);
    for (const id of ['force', 'cardio', 'tandem', 'overall', 'clearance'])
      expect(after.find((f) => f.id === id)).toEqual(before.find((f) => f.id === id));
    expect(after.find((f) => f.id === 'task')?.status).toBe('insufficient');
    expect(after.find((f) => f.id === 'task')?.comparison).toBeUndefined();
    expect(
      healthActions(packet, ['DEMO-01-task-followup'], 'transition').map((a) => a.id),
    ).toContain('task-missing');
    expect(evaluate(packet)).toEqual(before);
    expect(packet.observations.find((r) => r.id === 'DEMO-01-task-followup')?.value).toBe(26);
  });
  it('retains a derived copy without accepting it as independent evidence when its direct source is excluded', () => {
    const packet = validatePacket(freshCase('DEMO-04'));
    const force = evaluate(packet, ['DEMO-04-force-followup']).find((f) => f.id === 'force')!;
    expect(force.status).toBe('insufficient');
    expect(force.excluded[0].derivedFrom).toEqual(['DEMO-04-force-followup']);
    expect(force.issues.join(' ')).toContain('not independent direct observations');
  });
});
