import { describe, expect, it } from 'vitest';
import {
  compareAggregate,
  tandemRegister as source,
  type StudyGroup,
  type EyesCondition,
} from '../src/research/aggregate';
import { initialMissionState } from '../src/mission/state';
import { missionOverview } from '../src/mission/overview';
import { comparisonBridge } from '../src/mission/bridge';

describe('primary Table 3 aggregate reproduction', () => {
  it('preserves explicit rights, source, actual population, four groups and uncertainty boundaries', () => {
    expect(source).toMatchObject({
      doi: '10.3389/fphys.2024.1442239',
      license: 'CC BY 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      origin: 'published-scientific-aggregate',
      extractedOn: '2026-11-14',
    });
    expect(source.population).toContain('30-day');
    expect(source.groups.map((g) => [g.id, g.n])).toEqual([
      ['Control', 12],
      ['Exercise', 12],
      ['LBNP', 12],
      ['Seated', 11],
    ]);
    expect(source.rows).toHaveLength(8);
    expect(source.rows.every((r) => r.endpointPairedN === null)).toBe(true);
    expect(source.uncertainty).toContain('SD is not a confidence interval');
    expect(source.limitations.join(' ')).toContain('Table 4');
  });
  it.each([
    ['Control', 'eyes-closed', 85.3, 65.6, 11.8, 17.3, -19.7],
    ['Control', 'eyes-open', 99.2, 89.6, 1.92, 9, -9.6],
    ['Exercise', 'eyes-closed', 83.9, 62.6, 15.5, 22.7, -21.3],
    ['Exercise', 'eyes-open', 98.5, 87.9, 2.8, 11, -10.6],
    ['LBNP', 'eyes-closed', 83.2, 53.3, 17, 16.4, -29.9],
    ['LBNP', 'eyes-open', 97.19, 86.3, 5.14, 13.8, -10.89],
    ['Seated', 'eyes-closed', 85.6, 76.8, 15.1, 10.4, -8.8],
    ['Seated', 'eyes-open', 95.8, 88.2, 6.97, 10.4, -7.6],
  ] as const)(
    'reproduces %s %s, retaining the correct group header',
    (group, eyes, pre, post, preSD, postSD, delta) => {
      const result = compareAggregate(group, eyes, eyes);
      expect(result.before).toMatchObject({
        beforeMean: pre,
        beforeSD: preSD,
        afterMean: post,
        afterSD: postSD,
      });
      expect(result.supportedDifference).toBe(delta);
      expect(result.illustrativeArithmetic).toBeNull();
      expect(result.unit).toBe('percentage points');
      expect(result.origin).toBe('published-scientific-aggregate');
    },
  );
  it('withholds the deliberately incompatible +4.0 arithmetic instead of reporting an improvement', () => {
    const result = compareAggregate('Exercise', 'eyes-closed', 'eyes-open');
    expect(result.supportedDifference).toBeNull();
    expect(result.illustrativeArithmetic).toBe(4);
    expect(result.matched).toBe(false);
    expect(result.reason).toContain('constructed teaching counterexample');
  });
  it.each(['Control', 'Exercise', 'LBNP', 'Seated'] as const)(
    'withholds both incompatible directions in %s',
    (group) => {
      for (const [a, b] of [
        ['eyes-open', 'eyes-closed'],
        ['eyes-closed', 'eyes-open'],
      ] as const)
        expect(compareAggregate(group, a, b).supportedDifference).toBeNull();
    },
  );
  it('rejects unsupported endpoint or group and cannot contaminate individual assessment evidence', () => {
    expect(() =>
      compareAggregate('Astronaut' as StudyGroup, 'eyes-closed', 'eyes-closed'),
    ).toThrow();
    expect(() => compareAggregate('Exercise', 'rest' as EyesCondition, 'eyes-closed')).toThrow();
    const state = initialMissionState();
    const before = missionOverview(state);
    const result = compareAggregate('Exercise', 'eyes-closed', 'eyes-open');
    expect(() =>
      comparisonBridge(state.context, [result], {
        policy: 'explicit-assessment-selection-v1',
        recordIds: ['fake'],
      }),
    ).toThrow();
    expect(missionOverview(state)).toEqual(before);
    expect(result).not.toHaveProperty('predictedOutcome');
  });
});
