import { freshCase } from '../data/cases';
import { featuredScenarios } from '../data/scenarios';
import { validatePacket } from '../core/validate';
import type { CasePacket, Measure } from '../core/model';
import type { MissionPhase } from '../core/context';
import { decodeSession, encodeSession, initialSession, type Session } from '../core/session';

/**
 * Guided teaching state. It is stored under its own key and never shares state with the advanced
 * workspace session (`parallax.synthetic.session.v1`). Data moves into the workspace only through
 * an explicit, confirmed transfer.
 */
export const guidedKey = 'parallax.guided.v1';
export const stepCount = 5;

const fixture = (id: string) => featuredScenarios.find((s) => s.id === id)!;

export const guidedScenarios = [
  {
    key: 'complete',
    slug: 'complete-health-record',
    caseId: 'DEMO-01',
    title: 'Understanding a complete health record',
    measure: 'force' as Measure,
    phase: 'transition' as MissionPhase,
    question: 'What do four available comparisons tell us?',
    summary:
      'Inspect force, postural HR response, tandem performance and task duration separately.',
    steps: ['Record', 'Postural response', 'Tandem performance', 'Task duration', 'Meaning'],
  },
  {
    key: 'exercise',
    slug: 'exercise-response',
    caseId: 'DEMO-05',
    title: 'Reviewing exercise response in space',
    measure: 'hr' as Measure,
    phase: 'inflight' as MissionPhase,
    question: 'How did heart rate differ at the same recorded workload?',
    summary: 'Two available in-flight sessions at 100 W, with matching acquisition declarations.',
    steps: ['Record', 'Heart rate', 'Conditions', 'Inspect source', 'Meaning'],
  },
  {
    key: 'missing',
    slug: 'missing-evidence',
    caseId: 'DEMO-02',
    title: fixture('DEMO-02').title,
    measure: fixture('DEMO-02').measure as Measure,
    phase: 'transition' as MissionPhase,
    question: 'Does more strength mean easier movement?',
    summary: 'A force result is recorded. The task result after the mission is not.',
    steps: ['Question', 'Strength', 'The gap', 'Investigate', 'Meaning'],
  },
  {
    key: 'conditions',
    slug: 'incompatible-measurements',
    caseId: 'DEMO-05-MISMATCH',
    title: fixture('DEMO-05-MISMATCH').title,
    measure: fixture('DEMO-05-MISMATCH').measure as Measure,
    phase: 'inflight' as MissionPhase,
    question: 'Did exercise heart rate change between two sessions?',
    summary: 'Two heart-rate readings were taken at different recorded workloads.',
    steps: ['Question', 'Heart rate', 'Conditions', 'Investigate', 'Meaning'],
  },
  {
    key: 'copy',
    slug: 'dependent-observations',
    caseId: 'DEMO-04',
    title: fixture('DEMO-04').title,
    measure: fixture('DEMO-04').measure as Measure,
    phase: 'transition' as MissionPhase,
    question: 'Two records show 1,050 N. Are they two measurements?',
    summary: 'A displayed force value was copied from the original assessment record.',
    steps: ['Question', 'Two records', 'The source', 'Investigate', 'Meaning'],
  },
] as const;
export type GuidedScenario = (typeof guidedScenarios)[number];
export type ScenarioKey = GuidedScenario['key'];
export const scenarioBySlug = (slug: string) => guidedScenarios.find((s) => s.slug === slug);
export const scenarioByKey = (key: ScenarioKey) => guidedScenarios.find((s) => s.key === key)!;

export interface GuidedCase {
  packet: CasePacket;
  unavailable: string[];
  undo: { packet: CasePacket; unavailable: string[] } | null;
  note: string;
  /** Furthest step reached, used only to offer "Continue" on the scenario list. */
  reached: number;
}
export interface GuidedStore {
  cases: Partial<Record<ScenarioKey, GuidedCase>>;
  completed: ScenarioKey[];
}

export const freshGuidedCase = (key: ScenarioKey): GuidedCase => ({
  packet: freshCase(scenarioByKey(key).caseId),
  unavailable: [],
  undo: null,
  note: '',
  reached: 1,
});
export const emptyGuided = (): GuidedStore => ({ cases: {}, completed: [] });

const strings = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((s) => typeof s === 'string');

/** Rejects anything that is not a validated packet of the scenario's own fixture case. */
export function decodeGuided(raw: string | null): GuidedStore {
  if (!raw || raw.length > 600_000) return emptyGuided();
  try {
    const data = JSON.parse(raw);
    if (data?.version !== 1) return emptyGuided();
    const store = emptyGuided();
    for (const s of guidedScenarios) {
      const c = data.cases?.[s.key];
      if (!c) continue;
      const packet = validatePacket(c.packet);
      if (packet.case.id !== s.caseId) continue;
      const ids = new Set(packet.observations.map((r) => r.id));
      if (!strings(c.unavailable) || typeof c.note !== 'string' || c.note.length > 1000) continue;
      let undo: GuidedCase['undo'] = null;
      if (c.undo) {
        const previous = validatePacket(c.undo.packet);
        if (previous.case.id !== s.caseId || !strings(c.undo.unavailable)) continue;
        undo = { packet: previous, unavailable: c.undo.unavailable };
      }
      const reached = Number.isInteger(c.reached) ? Math.min(Math.max(c.reached, 1), 5) : 1;
      store.cases[s.key] = {
        packet,
        unavailable: [...new Set<string>(c.unavailable)].filter((id) => ids.has(id)),
        undo,
        note: c.note,
        reached,
      };
    }
    store.completed = strings(data.completed)
      ? guidedScenarios.map((s) => s.key).filter((k) => data.completed.includes(k))
      : [];
    return store;
  } catch {
    return emptyGuided();
  }
}
export const encodeGuided = (store: GuidedStore) => JSON.stringify({ version: 1, ...store });

/** The workspace session a transfer would create. Review receipts and marks start empty. */
export function workspaceSessionFrom(key: ScenarioKey, c: GuidedCase): Session {
  return {
    ...initialSession(),
    packet: structuredClone(c.packet),
    unavailable: [...c.unavailable],
    note: c.note,
    missionPhase: scenarioByKey(key).phase,
  };
}

/** True when replacing the stored workspace session would discard nothing but the default case. */
export function workspaceIsDefault(raw: string | null): boolean {
  if (!raw) return true;
  const { session, notice } = decodeSession(raw);
  return !notice && encodeSession(session) === encodeSession(initialSession());
}

/** Positive teaching copy is bound to the actual complete fixture, never its user-editable ID alone. */
export function availableScenarioMatches(packet: CasePacket) {
  return (
    ['DEMO-01', 'DEMO-05'].includes(packet.case.id) &&
    JSON.stringify(packet) === JSON.stringify(freshCase(packet.case.id))
  );
}
