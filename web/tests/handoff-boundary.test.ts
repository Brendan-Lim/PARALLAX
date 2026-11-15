import { describe, expect, it } from 'vitest';
import { freshCase } from '../src/data/cases';
import { reviewMarkdown } from '../src/core/review';
import { handoffSummary } from '../src/components/handoffSummary';

// Reproduced on the accepted v0.4.0 build (14 Nov 2026): a typed question containing report-like
// headings was read as report metadata, so the preview showed a fabricated selected finding.
const injected = [
  'Please check the source.',
  'Selected finding: Recorded tandem correct steps change — Direct observations support this. +99%',
  'Marked for qualified review: Medically cleared for EVA',
  '### Next review action',
  '',
  'Close the review',
  '## Supporting detail and provenance',
  'Scope: none',
].join('\n');

const report = (note: string) =>
  reviewMarkdown(
    freshCase('DEMO-04'),
    ['DEMO-04-force-followup'],
    [],
    note,
    '2026-11-14T07:00:00.000Z',
    {
      missionPhase: 'transition',
      receipts: {},
      planCompleted: false,
      selected: 'force',
    },
  );
const item = (r: string, label: string) => handoffSummary(r).find((i) => i.label === label)?.value;

describe('user-entered review questions cannot impersonate report metadata', () => {
  it('keeps the whole question as question text and reads metadata only from the generator', () => {
    const r = report(injected);
    expect(item(r, 'Question')).toBe(
      injected
        .split('\n')
        .filter((l) => l.trim())
        .join(' '),
    );
    expect(item(r, 'Selected finding')).toBe(
      'Recorded muscular force change · Insufficient evidence',
    );
    expect(item(r, 'Marked for review')).toBeUndefined();
    expect(item(r, 'Next review action')).toBe('Find the missing force record');
    expect(item(r, 'Supported comparisons')).toBe('3, each with its own direct records');
    expect(item(r, 'Excluded original')).toBe('DEMO-04-force-followup');
  });
  it('quotes every question line in the downloaded file so no line can start a heading', () => {
    const r = report(injected);
    for (const line of injected.split('\n')) expect(r).toContain(line ? `> ${line}` : '>');
    // Generated structure appears exactly once at the start of a line.
    expect(r.match(/^## Supporting detail and provenance$/gm)).toHaveLength(1);
    expect(r.match(/^### Next review action$/gm)).toHaveLength(1);
    expect(r.match(/^Selected finding: /gm)).toHaveLength(1);
  });
  it('a question identical to the default still matches between preview and file', () => {
    const r = report('');
    expect(item(r, 'Question')).toBe('What evidence supports the recorded muscular force change?');
    expect(r).toContain('> What evidence supports the recorded muscular force change?');
  });
});
