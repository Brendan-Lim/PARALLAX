import { expect, it } from 'vitest';
import { freshCase } from '../src/data/cases';
import { evaluateMeasure } from '../src/core/engine';
import type { CasePacket, Measure } from '../src/core/model';

// Expected values are frozen from REFERENCE_RUBRIC.md arithmetic, not engine output.
const challenge: {
  name: string;
  measure: Measure;
  change: (p: CasePacket) => void;
  status: string;
  absolute?: number;
  relative?: number | null;
}[] = [
  {
    name: 'zero baseline',
    measure: 'force',
    change: (p) => {
      p.observations[0].value = 0;
      p.observations[1].value = 10;
    },
    status: 'supported',
    absolute: 10,
    relative: null,
  },
  {
    name: 'negative signed response',
    measure: 'cardio',
    change: (p) => {
      p.observations[2].value = -8;
      p.observations[3].value = -3;
    },
    status: 'supported',
    absolute: 5,
    relative: null,
  },
  {
    name: 'missing task baseline',
    measure: 'task',
    change: (p) => {
      p.observations = p.observations.filter((r) => r.id !== 'DEMO-01-task-baseline');
    },
    status: 'insufficient',
  },
  {
    name: 'changed task protocol',
    measure: 'task',
    change: (p) => {
      p.observations[7].protocol = 'another-task';
    },
    status: 'unresolved',
  },
  {
    name: 'reversed dates',
    measure: 'force',
    change: (p) => {
      p.observations[0].timestamp = '2026-11-14T01:23:00.284Z';
      p.observations[1].timestamp = '2026-11-14T01:23:00.186Z';
    },
    status: 'unresolved',
  },
  {
    name: 'duplicate provenance',
    measure: 'force',
    change: (p) => {
      p.observations[1].sourceRecord = p.observations[0].sourceRecord;
    },
    status: 'unresolved',
  },
  {
    name: 'derived-only followup',
    measure: 'force',
    change: (p) => {
      p.observations[1].form = 'derived';
      p.observations[1].derivedFrom = [p.observations[0].id];
    },
    status: 'insufficient',
  },
  {
    name: 'no observations',
    measure: 'task',
    change: (p) => {
      p.observations = [];
    },
    status: 'insufficient',
  },
];
it.each(challenge)(
  'reserved challenge: $name',
  ({ change, measure, status, absolute, relative }) => {
    const p = freshCase();
    change(p);
    const f = evaluateMeasure(p, measure);
    expect(f.status).toBe(status);
    if (absolute !== undefined) expect(f.comparison?.absolute).toBe(absolute);
    if (relative !== undefined) expect(f.comparison?.relative).toBe(relative);
  },
);
