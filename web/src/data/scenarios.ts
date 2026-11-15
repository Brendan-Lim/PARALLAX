import { freshCase } from './cases';
import type { CasePacket, Observation } from '../core/model';
import { applyEntry, entryDraft } from '../core/entry';

export const featuredScenarios = [
  {
    id: 'DEMO-02',
    number: '01',
    title: 'Missing Evidence',
    context: 'Gravity-transition review · Earth assessments',
    description: 'Force has a reference and follow-up. The separate task has only a reference.',
    investigate: 'Enter an already obtained fictional follow-up and reassess.',
    measure: 'task',
  },
  {
    id: 'DEMO-05-MISMATCH',
    number: '02',
    title: 'Incompatible Measurements',
    context: 'In-flight cycling · fictional microgravity',
    description: 'Both heart rates are present. Their recorded workloads differ: 100 W and 120 W.',
    investigate: 'Inspect the source conditions, correct the fictional record and undo.',
    measure: 'hr',
  },
  {
    id: 'DEMO-04',
    number: '03',
    title: 'Dependent Observations',
    context: 'Multisystem review · Earth assessments',
    description: 'A second display of the force result depends on the same direct observation.',
    investigate: 'Exclude its source and see which comparisons still have evidence.',
    measure: 'force',
  },
] as const;

/** A separate, explicitly fictional source slip; never enters evidence before validated entry. */
export const obtainedTaskFollowup: Observation = {
  ...freshCase('DEMO-02').observations.find((r) => r.measurement === 'task')!,
  id: 'DEMO-02-task-followup-entry',
  phase: 'followup',
  session: 'POST-DEMO',
  value: 29,
  sourceRecord: 'DEMO-02/task/followup',
};

// Fixture content, including provenance and dependencies, binds the teaching material.
// Case IDs are user-supplied labels. Object key order is immaterial to JSON imports.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => `${JSON.stringify(key)}:${canonical(v)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}

const demonstrationStates = featuredScenarios.map((scenario) => {
  const original = freshCase(scenario.id);
  const states = [original];
  if (scenario.id === 'DEMO-02')
    states.push(
      applyEntry(
        original,
        entryDraft(
          { ...original, observations: [...original.observations, obtainedTaskFollowup] },
          'task',
          'followup',
        ),
      ),
    );
  if (scenario.id === 'DEMO-05-MISMATCH') {
    const correction = entryDraft(original, 'hr', 'followup');
    correction.acquisition!.workloadWatts = 100;
    states.push(applyEntry(original, correction));
  }
  return { scenario, states: states.map(canonical) };
});

/** Exact fictional fixtures and their explicit teaching transitions only. No input is repaired. */
export function featuredScenarioFor(packet: CasePacket, unavailable: string[] = []) {
  const match = demonstrationStates.find(
    ({ scenario, states }) => scenario.id === packet.case.id && states.includes(canonical(packet)),
  );
  if (
    !match ||
    unavailable.some((id) => match.scenario.id !== 'DEMO-04' || id !== 'DEMO-04-force-followup')
  )
    return undefined;
  return match.scenario;
}

export function obtainedTaskSuggestion(packet: CasePacket, unavailable: string[]) {
  return featuredScenarioFor(packet, unavailable)?.id === 'DEMO-02' &&
    !packet.observations.some((r) => r.measurement === 'task' && r.phase === 'followup')
    ? obtainedTaskFollowup
    : undefined;
}
