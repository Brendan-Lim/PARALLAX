import { expect, it } from 'vitest';
import { freshCase } from '../src/data/cases';
import { reviewMarkdown } from '../src/core/review';
it('puts a selected source problem before complete provenance without discarding the appendix', () => {
  const p = freshCase('DEMO-04');
  const report = reviewMarkdown(
    p,
    ['DEMO-04-force-followup'],
    ['force'],
    'Verify the original force observation.',
    '2026-11-14T07:00:00.000Z',
    { missionPhase: 'transition', receipts: {}, planCompleted: false, selected: 'force' },
  );
  const first = report.split('## Supporting detail and provenance')[0];
  for (const text of [
    'Selected review question',
    'Verify the original force observation.',
    'DEMO-04-force-followup',
    'Affected comparisons',
    'Relevant supported findings',
    'Next review action',
    'Scope:',
  ])
    expect(first).toContain(text);
  expect(report).toContain('Derived record excluded from independent support');
  expect(report).toContain('Scientific context');
  expect(report).not.toContain('Change: +50 N');
  expect(first).toContain('Recorded task completion time change: +30%');
});
