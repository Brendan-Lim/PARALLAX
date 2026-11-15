import { describe, expect, it } from 'vitest';
import { freshCase } from '../src/data/cases';
import { obtainedTaskFollowup } from '../src/data/scenarios';
import { applyEntry, entryDraft } from '../src/core/entry';
import { reviewMarkdown } from '../src/core/review';
import type { CasePacket, Finding } from '../src/core/model';
import { handoffSummary } from '../src/components/handoffSummary';

const report = (
  packet: CasePacket,
  unavailable: string[],
  selected: Finding['id'],
  note = '',
  marked: string[] = [],
) =>
  reviewMarkdown(packet, unavailable, marked, note, '2026-11-14T07:00:00.000Z', {
    missionPhase: packet.context?.kind === 'inflight-demo' ? 'inflight' : 'transition',
    receipts: {},
    planCompleted: false,
    selected,
  });
const opening = (r: string) => r.split('\n## Supporting detail and provenance\n')[0];
const item = (r: string, label: string) => handoffSummary(r).find((i) => i.label === label)?.value;

/** Every preview value must be text the downloaded file actually opens with. */
function expectFaithful(r: string) {
  // Question lines are quoted in the file; compare their text without the quote marker.
  const raw = opening(r).replace(/^> ?/gm, '');
  const first = raw.replace(/\s+/g, ' ');
  const items = handoffSummary(r);
  expect(items.length).toBeGreaterThan(2);
  for (const { label, value } of items) {
    if (label === 'Supported comparisons') {
      const listed = raw
        .split('### Relevant supported findings')[1]
        .split('###')[0]
        .split('\n')
        .filter((l) => l.startsWith('- ')).length;
      expect(value).toBe(listed ? `${listed}, each with its own direct records` : 'None');
      continue;
    }
    const parts = value
      .replace(/; not independent$/, '')
      .split(/ · |; /)
      .map((p) => p.trim())
      .filter(Boolean);
    for (const part of parts) expect(first, `${label}: ${part}`).toContain(part);
  }
}

const missingEntered = () => {
  const original = freshCase('DEMO-02');
  return applyEntry(
    original,
    entryDraft(
      { ...original, observations: [...original.observations, obtainedTaskFollowup] },
      'task',
      'followup',
    ),
  );
};

describe('handoff preview is read from the exported report', () => {
  it('missing evidence names the missing requirement', () => {
    const r = report(freshCase('DEMO-02'), [], 'task');
    expectFaithful(r);
    expect(item(r, 'Selected finding')).toContain('Insufficient evidence');
    expect(item(r, 'Unresolved requirement')).toBe('A direct follow-up observation');
  });
  it('a validated entry removes the requirement', () => {
    const r = report(missingEntered(), [], 'task');
    expectFaithful(r);
    expect(item(r, 'Selected finding')).toContain('Direct observations support this');
    expect(item(r, 'Unresolved requirement')).toBeUndefined();
  });
  it('compatible and incompatible measurements', () => {
    const ok = report(freshCase('DEMO-05'), [], 'hr');
    expectFaithful(ok);
    expect(item(ok, 'Selected finding')).toContain('+15 bpm');
    const bad = report(freshCase('DEMO-05-MISMATCH'), [], 'hr');
    expectFaithful(bad);
    expect(item(bad, 'Selected finding')).toContain('Unresolved observations');
  });
  it('dependent observations distinguish the excluded original from its active copy', () => {
    const r = report(freshCase('DEMO-04'), ['DEMO-04-force-followup'], 'force', 'Find it.');
    expectFaithful(r);
    expect(item(r, 'Question')).toBe('Find it.');
    expect(item(r, 'Excluded original')).toBe('DEMO-04-force-followup');
    expect(item(r, 'Dependent copy')).toContain('DEMO-04-force-display-copy');
    expect(item(r, 'Excluded dependent copy')).toBeUndefined();
    expect(item(r, 'Next review action')).toBe('Find the missing force record');
  });
  it('an excluded derived copy is never labelled as an original record', () => {
    const r = report(
      freshCase('DEMO-04'),
      ['DEMO-04-force-followup', 'DEMO-04-force-display-copy'],
      'force',
    );
    expectFaithful(r);
    expect(item(r, 'Excluded original')).toBe('DEMO-04-force-followup');
    expect(item(r, 'Excluded dependent copy')).toContain('DEMO-04-force-display-copy');
    expect(opening(r)).not.toMatch(/Excluded original record\(s\): [^.]*display-copy/);
    expect(r).toContain('Simulated unavailable dependent copy: DEMO-04-force-display-copy');
  });
  it('lists other unresolved findings separately from the selected one', () => {
    const p = freshCase('DEMO-04');
    const task = p.observations.find((o) => o.measurement === 'task' && o.phase === 'followup')!;
    const r = report(p, ['DEMO-04-force-followup', task.id], 'force');
    expectFaithful(r);
    expect(item(r, 'Other unresolved issues')).toBe('Recorded task completion time change');
  });
  it('an outside-scope selection keeps unresolved issues visible', () => {
    const r = report(freshCase('DEMO-04'), ['DEMO-04-force-followup'], 'overall');
    expectFaithful(r);
    expect(item(r, 'Selected finding')).toContain('Outside validated scope');
    expect(item(r, 'Unresolved issues')).toBe('Recorded muscular force change');
  });
  it('custom imported packets, multi-line questions and marked findings', () => {
    const p = freshCase('DEMO-04');
    p.case = { ...p.case, id: 'IMPORTED-1', title: 'Imported review' };
    p.observations = p.observations.map((o) => ({ ...o, caseId: 'IMPORTED-1' }));
    const r = report(p, [], 'task', 'First line.\nSecond line.', ['force']);
    expectFaithful(r);
    expect(item(r, 'Question')).toBe('First line. Second line.');
    expect(item(r, 'Marked for review')).toBe('Recorded muscular force change');
    expect(item(r, 'Selected finding')).toContain('Direct observations support this');
  });
  it('omits the preview rather than guessing when the opening is absent', () => {
    expect(handoffSummary('# Unrelated text')).toEqual([]);
  });
});
