import { expect, it } from 'vitest';
import { freshCase } from '../src/data/cases';
import { applyEntry, entryDraft } from '../src/core/entry';
import { evaluateMeasure } from '../src/core/engine';
import { parseImport } from '../src/core/validate';
import {
  featuredScenarios,
  featuredScenarioFor,
  obtainedTaskFollowup,
  obtainedTaskSuggestion,
} from '../src/data/scenarios';

it('binds teaching sources to complete fixture content and exact validated transitions', () => {
  for (const scenario of featuredScenarios) {
    const original = freshCase(scenario.id);
    expect(featuredScenarioFor(original)?.id).toBe(scenario.id);
    // A semantically identical JSON fixture is still the intended fiction, regardless of key order.
    const reordered = Object.fromEntries(Object.entries(original).reverse());
    expect(featuredScenarioFor(parseImport(JSON.stringify(reordered)))?.id).toBe(scenario.id);
    expect(featuredScenarioFor(original, [original.observations[0].id])).toBeUndefined();
  }
  const missing = freshCase('DEMO-02');
  expect(obtainedTaskSuggestion(missing, [])).toEqual(obtainedTaskFollowup);
  const entered = applyEntry(
    missing,
    entryDraft(
      { ...missing, observations: [...missing.observations, obtainedTaskFollowup] },
      'task',
      'followup',
    ),
  );
  expect(featuredScenarioFor(entered)?.id).toBe('DEMO-02');
  expect(obtainedTaskSuggestion(entered, [])).toBeUndefined();
  expect(evaluateMeasure(entered, 'task').comparison?.absolute).toBe(5);
  const mismatch = freshCase('DEMO-05-MISMATCH');
  const corrected = entryDraft(mismatch, 'hr', 'followup');
  corrected.acquisition!.workloadWatts = 100;
  expect(featuredScenarioFor(applyEntry(mismatch, corrected))?.id).toBe('DEMO-05-MISMATCH');
  expect(featuredScenarioFor(freshCase('DEMO-04'), ['DEMO-04-force-followup'])?.id).toBe('DEMO-04');
});

for (const scenario of featuredScenarios) {
  for (const field of ['value', 'protocol', 'sourceRecord', 'session', 'issues'] as const) {
    it(`withholds curated material for imported ${scenario.id} with changed ${field}`, () => {
      const edited = freshCase(scenario.id);
      const record = edited.observations[0];
      if (field === 'value') record.value += 7;
      else if (field === 'issues') record.issues = ['unverified source'];
      else record[field] = 'different-fictional-record';
      const imported = parseImport(JSON.stringify(edited));
      expect(imported.observations[0]).toEqual(record);
      expect(featuredScenarioFor(imported)).toBeUndefined();
      expect(obtainedTaskSuggestion(imported, [])).toBeUndefined();
    });
  }
}

it('does not claim force dependency for a copy linked to a different record', () => {
  const packet = freshCase('DEMO-04');
  packet.observations.find((r) => r.form === 'derived')!.derivedFrom = [
    packet.observations.find((r) => r.measurement === 'task')!.id,
  ];
  expect(featuredScenarioFor(parseImport(JSON.stringify(packet)))).toBeUndefined();
  expect(evaluateMeasure(packet, 'force', ['DEMO-04-force-followup']).status).toBe('insufficient');
});

it('withholds teaching sources after arbitrary workload, context, case metadata or added record changes', () => {
  const packet = freshCase('DEMO-05-MISMATCH');
  packet.observations[1].acquisition!.workloadWatts = 180;
  expect(featuredScenarioFor(packet)).toBeUndefined();
  const changedOrigin = freshCase('DEMO-02');
  changedOrigin.context!.kind = 'bed-rest-analog';
  expect(featuredScenarioFor(changedOrigin)).toBeUndefined();
  const renamed = freshCase('DEMO-04');
  renamed.case.description = 'An unrelated synthetic investigation';
  expect(featuredScenarioFor(renamed)).toBeUndefined();
  const extra = freshCase('DEMO-02');
  extra.observations.push({ ...extra.observations[0], id: 'extra-record' });
  expect(featuredScenarioFor(extra)).toBeUndefined();
  const arbitraryEntry = entryDraft(freshCase('DEMO-02'), 'task', 'followup');
  Object.assign(arbitraryEntry, { value: '99', session: 'POST-DEMO', sourceRecord: 'custom/task' });
  expect(featuredScenarioFor(applyEntry(freshCase('DEMO-02'), arbitraryEntry))).toBeUndefined();
});
