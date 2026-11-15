import { describe, expect, it } from 'vitest';
import { evaluate, evaluateMeasure, formatNumber } from '../src/core/engine';
import { freshCase } from '../src/data/cases';
import { parseImport, validatePacket } from '../src/core/validate';
import { decodeSession, encodeSession, initialSession } from '../src/core/session';
import { reviewMarkdown } from '../src/core/review';
import type { Measure } from '../src/core/model';

describe('independently specified arithmetic', () => {
  it('does not round a tiny nonzero change into a displayed zero', () => {
    expect(formatNumber(0.000001)).toBe('1.000e-6');
    expect(formatNumber(-0)).toBe('0');
  });
  it.each([
    ['force', 50, 5, 'N'],
    ['cardio', 15, null, 'bpm'],
    ['tandem', -15, null, 'percentage points'],
    ['task', 6, 30, 's'],
  ] as const)('%s uses the right absolute and relative units', (key, absolute, relative, unit) => {
    const f = evaluateMeasure(freshCase(), key);
    expect(f.status).toBe('supported');
    expect(f.comparison?.absolute).toBe(absolute);
    expect(f.comparison?.relative).toBe(relative);
    expect(f.comparison?.changeUnit).toBe(unit);
  });
  it('equal values do not establish clinical equivalence', () => {
    const p = freshCase();
    p.observations[1].value = 1000;
    const f = evaluateMeasure(p, 'force');
    expect(f.comparison?.absolute).toBe(0);
    expect(f.comparison?.direction).toBe('unchanged');
    expect(f.explanation).toContain('not evidence of clinical equivalence');
  });
  it('contains numeric overflow instead of supporting Infinity', () => {
    const p = freshCase();
    p.observations[2].value = -Number.MAX_VALUE;
    p.observations[3].value = Number.MAX_VALUE;
    expect(evaluateMeasure(p, 'cardio').status).toBe('unresolved');
  });
});

describe('reference evidence rubric', () => {
  it('removing a task observation preserves force support and original records', () => {
    const p = freshCase();
    const copy = JSON.stringify(p);
    const unavailable = ['DEMO-01-task-followup'];
    expect(evaluateMeasure(p, 'task', unavailable).status).toBe('insufficient');
    expect(evaluateMeasure(p, 'force', unavailable).status).toBe('supported');
    expect(JSON.stringify(p)).toBe(copy);
    expect(evaluateMeasure(p, 'task')).toEqual(evaluate(p).find((f) => f.id === 'task'));
  });
  it('empty observations do not default to zero', () => {
    const p = freshCase();
    p.observations = [];
    const f = evaluateMeasure(p, 'task');
    expect(f.status).toBe('insufficient');
    expect(f.comparison).toBeUndefined();
  });
  it.each(['protocol', 'window', 'sourceId'] as const)('different %s blocks support', (key) => {
    const p = freshCase();
    p.observations[1][key] = 'different';
    expect(evaluateMeasure(p, 'force').status).toBe('unresolved');
  });
  it('same session blocks a false longitudinal comparison', () => {
    const p = freshCase();
    p.observations[1].session = p.observations[0].session;
    expect(evaluateMeasure(p, 'force').status).toBe('unresolved');
  });
  it('valid known dates support comparison', () => {
    const p = freshCase();
    p.observations[0].timestamp = '2026-11-14T01:23:00.000Z';
    p.observations[1].timestamp = '2026-11-14T01:23:00.186Z';
    expect(evaluateMeasure(validatePacket(p), 'force').status).toBe('supported');
  });
  it('unknown dates remain explicit limitations', () => {
    expect(evaluateMeasure(freshCase(), 'force').limitations.join(' ')).toContain(
      'Exact acquisition time is unknown',
    );
  });
  it('declared quality conflicts block support', () => {
    const p = freshCase();
    p.observations[1].issues = ['Source timestamps contradict the nominal phase'];
    expect(evaluateMeasure(p, 'force').status).toBe('unresolved');
  });
  it('multiple direct follow-ups require explicit selection', () => {
    const p = freshCase();
    p.observations.push({ ...p.observations[1], id: 'extra', sourceRecord: 'extra' });
    expect(evaluateMeasure(p, 'force').status).toBe('unresolved');
  });
  it('a derived observation does not increase independent support', () => {
    const p = freshCase();
    p.observations.push({
      ...p.observations[1],
      id: 'derived',
      form: 'derived',
      derivedFrom: [p.observations[1].id],
    });
    const f = evaluateMeasure(validatePacket(p), 'force');
    expect(f.status).toBe('supported');
    expect(f.evidence).toHaveLength(2);
    expect(f.excluded).toHaveLength(1);
  });
  it('an unrelated domain cannot replace missing functional evidence', () => {
    const p = freshCase('DEMO-02');
    expect(evaluateMeasure(p, 'force').status).toBe('supported');
    expect(evaluateMeasure(p, 'task').status).toBe('insufficient');
  });
  it('all available observations leave broad claims outside scope', () => {
    expect(
      evaluate(freshCase())
        .filter((f) => f.status === 'outside')
        .map((f) => f.id),
    ).toEqual(['overall', 'clearance']);
  });
  it('different domain directions are not data contradictions', () => {
    expect(
      evaluate(freshCase())
        .slice(0, 4)
        .map((f) => f.status),
    ).toEqual(['supported', 'supported', 'supported', 'supported']);
  });
  it('is deterministic under repeated interactions and record order', () => {
    const p = freshCase();
    const before = evaluate(p);
    for (let i = 0; i < 10; i++) {
      evaluate(p, [p.observations[7].id]);
      expect(evaluate(p)).toEqual(before);
    }
    p.observations.reverse();
    expect(evaluateMeasure(p, 'force').comparison?.absolute).toBe(50);
  });
});

describe('strict demonstration ingestion', () => {
  it('accepts and clones a valid synthetic packet', () => {
    const p = freshCase();
    const output = validatePacket(p);
    output.observations[0].value = 1;
    expect(p.observations[0].value).toBe(1000);
  });
  it.each([
    ['unit', 'kg'],
    ['value', '1050'],
    ['value', null],
    ['value', Number.NaN],
    ['value', Infinity],
    ['value', -2],
    ['measurement', 'readiness'],
    ['phase', 'after'],
    ['origin', 'observed'],
    ['timestamp', '2026-02-30T00:00:00Z'],
    ['timestamp', 'yesterday'],
    ['id', ''],
    ['sourceRecord', ''],
    ['form', 'estimated'],
    ['caseId', 'other'],
    ['unexpected', 'field'],
  ])('rejects malformed %s=%s', (key, value) => {
    const p = freshCase();
    (p.observations[0] as unknown as Record<string, unknown>)[key] = value;
    expect(() => validatePacket(p)).toThrow();
  });
  it('rejects an out-of-range percentage', () => {
    const p = freshCase();
    p.observations[4].value = 101;
    expect(() => validatePacket(p)).toThrow();
  });
  it('rejects duplicate identifiers', () => {
    const p = freshCase();
    p.observations.push(p.observations[0]);
    expect(() => validatePacket(p)).toThrow(/duplicate/);
  });
  it('rejects missing and cyclic derivation dependencies', () => {
    const p = freshCase();
    p.observations[0].form = 'derived';
    p.observations[0].derivedFrom = ['missing'];
    expect(() => validatePacket(p)).toThrow(/dependency/);
    p.observations[0].derivedFrom = [p.observations[1].id];
    p.observations[1].form = 'derived';
    p.observations[1].derivedFrom = [p.observations[0].id];
    expect(() => validatePacket(p)).toThrow(/circular/);
  });
  it('rejects derived data labelled as direct', () => {
    const p = freshCase();
    p.observations[0].derivedFrom = [p.observations[1].id];
    expect(() => validatePacket(p)).toThrow(/direct observations/);
  });
  it('rejects malformed and oversized JSON', () => {
    expect(() => parseImport('{broken')).toThrow(/not valid JSON/);
    expect(() => parseImport(' '.repeat(250001))).toThrow(/250 KB/);
    expect(() => parseImport('測'.repeat(100000))).toThrow(/250 KB/);
  });
  it('accepts negative signed HR response without applying force constraints', () => {
    const p = freshCase();
    p.observations[2].value = -5;
    expect(() => validatePacket(p)).not.toThrow();
  });
});

describe('review and persistence', () => {
  it('review reflects newly imported values and missing evidence', () => {
    const p = freshCase();
    p.observations[1].value = 1200;
    const out = reviewMarkdown(
      p,
      ['DEMO-01-task-followup'],
      ['task'],
      'Why is task evidence unavailable?',
      '2026-11-14T03:09:28.131Z',
    );
    expect(out).toContain('+200 N');
    expect(out).toContain('Insufficient evidence');
    expect(out).toContain('not NASA participant');
    expect(out).toContain('task-followup (original retained)');
    expect(out).toContain('Marked for qualified review');
    expect(out).not.toContain('Follow-up: 26 s');
  });
  it('round-trips a versioned synthetic session', () => {
    const s = initialSession();
    s.unavailable = ['DEMO-01-task-followup'];
    s.marked = ['task'];
    expect(decodeSession(encodeSession(s)).session).toEqual(s);
  });
  it('invalid saved state visibly restores a safe default', () => {
    const out = decodeSession('{broken');
    expect(out.notice).toContain('invalid');
    expect(out.session.packet.case.id).toBe('DEMO-01');
  });
  it.each(['force', 'cardio', 'tandem', 'task'] as Measure[])(
    'removing all %s records removes its support',
    (key) => {
      const p = freshCase();
      const hidden = p.observations.filter((r) => r.measurement === key).map((r) => r.id);
      expect(evaluateMeasure(p, key, hidden).status).toBe('insufficient');
    },
  );
});
