import type { MissionState } from './state';
import { missionOverview } from './overview';
import { identityMatches, planSetMatches } from './identity';
import { planCurrency } from './review';
import { bindingMatches, type Ledger } from '../monitoring/model';
export const guideRoutes = [
  'mission/preflight',
  'mission/transit',
  'mission/health',
  'mission/monitoring',
  'mission/monitoring/interruption',
  'mission/health/review',
  'mission/surface',
  'mission/surface/completed',
] as const;
export function guideStep(hash: string) {
  if (hash.includes('/completed')) return 7;
  if (hash.includes('/preflight')) return 0;
  if (hash.includes('/transit')) return 1;
  if (hash.includes('/surface')) return 6;
  if (hash.includes('/interruption')) return 4;
  if (hash.includes('/monitoring') || hash.includes('/designation')) return 3;
  if (hash.includes('/review') || hash.includes('/saved') || hash.includes('/actions')) return 5;
  return 2;
}
/** Progress consumes the real projections and committed ledger; UI visits cannot replace them. */
export function guideFacts(state: MissionState, ledger: Ledger | null) {
  const model = missionOverview(state);
  const candidate = ledger?.runs.filter((r) => r.basis.sessionId === state.sessionId).at(-1);
  const run =
    candidate && bindingMatches(candidate, state) && candidate.status !== 'stale'
      ? candidate
      : undefined;
  const samples = ledger?.samples.filter((s) => s.runId === run?.id) ?? [];
  const signature = samples.find(
    (s) =>
      s.observation.relativeSeconds === 3 &&
      s.observation.originalValue === 72 &&
      s.observation.originalQualityCode === 2 &&
      s.observation.usability === 'withheld',
  );
  const event = ledger?.events.find(
    (e) =>
      !!signature &&
      e.runId === run?.id &&
      e.observationId === signature.id &&
      e.type === 'monitoring-interruption' &&
      e.reason === 'quality',
  );
  const ack = event && ledger?.acknowledgments.find((a) => a.eventId === event.id);
  const receipt =
    event &&
    ledger?.transitions.find((t) => t.eventId === event.id && t.kind === 'displayed-receipt');
  const review = state.reviews.at(-1);
  const events = ledger?.events.filter((e) => e.runId === run?.id) ?? [];
  const saved =
    !!review &&
    identityMatches(review.basis, state) &&
    planSetMatches(review, state) &&
    !!run &&
    review.monitoring?.availability === 'available' &&
    review.monitoring.run?.id === run.id &&
    samples.every((s) => review.monitoring?.samples.some((x) => x.id === s.id)) &&
    !!ack &&
    review.monitoring.acknowledgments.some((a) => a.id === ack.id) &&
    events.every((e) => review.monitoring?.events.some((x) => x.id === e.id)) &&
    !!event &&
    review.monitoring.events.some((e) => e.id === event.id);
  return {
    retrieved: !!model.exerciseComparison,
    designated: state.monitoringPlans.some((p) => planCurrency(p, state) === 'current'),
    usable: samples.some((s) => s.observation.usability === 'usable'),
    interrupted: !!event,
    acknowledged: !!ack && !!receipt,
    saved,
    run,
    event,
    review,
  };
}

/** The first unmet demonstration prerequisite, independent of local review validity. */
export function guideRecovery(state: MissionState, ledger: Ledger | null) {
  const f = guideFacts(state, ledger);
  const result = (title: string, why: string, route: string, companion = false) => ({
    title,
    why,
    route,
    companion,
  });
  if (!f.retrieved)
    return result(
      'Retrieve missing evidence',
      'The exercise follow-up is not in the current comparison.',
      'mission/health/assessments',
    );
  if (!f.designated)
    return result(
      'Designate monitoring',
      'No current monitoring designation covers this evidence.',
      'mission/health/designation',
    );
  if (!f.run || !f.usable)
    return result(
      'Continue device demonstration',
      'The associated replay must include a usable observation.',
      'mission/monitoring',
    );
  if (!f.interrupted)
    return result(
      'Inspect or process the relevant sample',
      'Process the quality interruption at 3 s using the source controls.',
      'mission/monitoring/interruption',
    );
  if (!f.acknowledged)
    return result(
      'Open companion and acknowledge',
      'The demonstration needs a display receipt and acknowledgment of the quality interruption. A locally saved review remains a valid snapshot.',
      `mission/companion/${state.sessionId}/${f.run.id}`,
      true,
    );
  if (!f.saved)
    return result(
      'Save an updated review',
      'The acknowledgment or newer monitoring information is outside the saved cutoff, or evidence/designation changed. Preserve an updated snapshot; earlier reviews remain unchanged.',
      'mission/health/review',
    );
  return null;
}
