import { measures, type CasePacket, type Finding } from './model';
import { evaluate } from './engine';
import { feasibility, actionApplicability, type MissionPhase } from './context';

export const actionStates = [
  'Not reviewed',
  'Acknowledged',
  'Awaiting observation',
  'Recorded for qualified review',
] as const;
export type ActionState = (typeof actionStates)[number];
export interface HealthAction {
  id: string;
  findingIds: Finding['id'][];
  title: string;
  category: 'Informational' | 'Record verification' | 'Qualified review';
  reason: string;
  sourceIds: string[];
  limitation: string;
  target: 'entry' | 'evidence' | 'plan';
  signature: string;
  applicability: string;
}
/** Acknowledgement belongs to an exact evidence/context revision, never to a diagnosis. */
export function healthActions(
  packet: CasePacket,
  unavailable: readonly string[],
  phase: MissionPhase,
): HealthAction[] {
  const findings = evaluate(packet, unavailable);
  const actions: HealthAction[] = [];
  const signature = (ids: Finding['id'][]) =>
    JSON.stringify({
      context: packet.context ?? null,
      phase,
      findings: findings
        .filter((f) => ids.includes(f.id))
        .map((f) => ({
          id: f.id,
          status: f.status,
          records: [...f.evidence, ...f.excluded, ...f.unavailable].sort((a, b) =>
            a.id.localeCompare(b.id),
          ),
          missing: f.requirements,
          issues: f.issues,
        })),
      unavailable: [...unavailable]
        .filter((id) => packet.observations.some((r) => r.id === id && ids.includes(r.measurement)))
        .sort(),
    });
  for (const f of findings) {
    if (f.id === 'overall' || f.id === 'clearance') continue;
    const missing = f.status === 'insufficient';
    const unresolved = f.status === 'unresolved';
    const applicable = actionApplicability(packet, phase, f.id);
    actions.push({
      id: `${f.id}-${missing ? 'missing' : unresolved ? 'verify' : 'review'}`,
      findingIds: [f.id],
      applicability: !applicable.actionable
        ? applicable.state
        : missing
          ? 'Expected record missing'
          : unresolved
            ? 'Record present but incompatible or unresolved'
            : 'Supported recorded comparison',
      title: !applicable.actionable
        ? `Preserve the ${measures[f.id].short.toLowerCase()} evidence limitation`
        : missing
          ? `Find the missing ${f.id === 'task' ? 'functional' : f.id === 'force' ? 'force' : measures[f.id].short.toLowerCase()} record`
          : unresolved
            ? `Verify ${measures[f.id].short.toLowerCase()} records before comparing`
            : `Review the recorded ${f.id === 'task' ? 'task' : f.id === 'hr' ? 'heart-rate' : f.id} change`,
      category: missing || unresolved ? 'Record verification' : 'Informational',
      reason: !applicable.actionable
        ? applicable.explanation
        : missing
          ? `${f.requirements.join(' and ')} ${f.requirements.length > 1 ? 'are' : 'is'} unavailable. ${f.id === 'task' ? 'The task outcome cannot be established from muscular force or research associations.' : 'Another domain cannot supply this value.'} Add only a result already obtained through an authorised assessment, or await the record.`
          : unresolved
            ? `${f.issues.join(' ')} Inspect units, protocol, source and sessions; no numerical or medical conclusion is assigned.`
            : `${f.explanation} Inspect its evidence and NASA context; a recorded difference does not establish clinical significance.`,
      sourceIds: f.contextIds,
      limitation: feasibility(packet, phase, f.id),
      target: missing && applicable.actionable ? 'entry' : 'evidence',
      signature: signature([f.id]),
    });
  }
  const force = findings.find((f) => f.id === 'force')?.comparison;
  const task = findings.find((f) => f.id === 'task')?.comparison;
  if (force && task && force.absolute >= 0 && task.absolute > 0)
    actions.unshift({
      id: 'different-changes',
      applicability: 'Qualified interpretation of separate measurements',
      findingIds: ['force', 'task'],
      title: 'Preserve the different recorded changes',
      category: 'Qualified review',
      reason:
        'Force did not decrease while this separate task took longer. These measure different aspects of function; preserve both for qualified interpretation. No cause is assigned.',
      sourceIds: ['study', 'egress'],
      limitation:
        'A question for the crew medical officer or qualified reviewer, not a diagnosis or medical urgency level.',
      target: 'evidence',
      signature: signature(['force', 'task']),
    });
  actions.push({
    id: 'existing-plan',
    applicability: 'Existing fictional plan only',
    findingIds: [packet.context?.kind === 'inflight-demo' ? 'hr' : 'force'],
    title: 'Review the existing prescribed plan',
    category: 'Informational',
    reason:
      'Exercise monitoring makes countermeasure education relevant. Review the fictional existing plan without changing its prescription.',
    sourceIds: ['exercise', 'exercise-overview', 'aerobic'],
    limitation:
      'Only the responsible qualified team can prescribe or change a plan. Recording an activity does not establish function or clearance.',
    target: 'plan',
    signature: signature([packet.context?.kind === 'inflight-demo' ? 'hr' : 'force']),
  });
  return actions;
}
export interface ActionReceipt {
  signature: string;
  state: ActionState;
}
export function currentActionState(
  action: HealthAction,
  receipts: Record<string, ActionReceipt>,
): ActionState {
  return receipts[action.id]?.signature === action.signature
    ? receipts[action.id].state
    : 'Not reviewed';
}
