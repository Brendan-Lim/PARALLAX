import { allMissionObservations } from './richEvidence';
import type { MissionState } from './state';

export const currentVersions = {
  source: 'mission-sources-3',
  interpretation: 'interpretation-3',
  monitoringPolicy: 'monitoring-policy-2',
  reviewPolicy: 'fictional-review-3',
} as const;
export type Versions = { [K in keyof typeof currentVersions]: string };
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (typeof value === 'object' && value !== null)
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`)
      .join(',')}}`;
  return JSON.stringify(value);
}
export function localFingerprint(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return `local-fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
export interface EvidenceIdentity {
  missionId: string;
  astronautId: string;
  sessionId: string;
  contextRevision: number;
  evidenceRevision: number;
  fixtureRevision: string;
  versions: Versions;
  evidenceContextKey: string;
  fingerprint: string;
}
export function evidenceIdentity(
  state: MissionState,
  versions: Versions = currentVersions,
): EvidenceIdentity {
  const evidenceContextKey = canonical({
    context: state.context,
    lineage: state.evidenceLineage,
    included: [...state.includedRecordIds].sort(),
    excluded: [...state.excludedRecordIds].sort(),
    records: allMissionObservations().filter((r) => state.includedRecordIds.includes(r.id)),
  });
  return {
    missionId: state.context.missionId,
    astronautId: state.context.astronaut.id,
    sessionId: state.sessionId,
    contextRevision: state.context.contextRevision,
    evidenceRevision: state.evidenceRevision,
    fixtureRevision: state.fixtureRevision,
    versions: { ...versions },
    evidenceContextKey,
    fingerprint: localFingerprint(evidenceContextKey),
  };
}
export function identityMatches(
  basis: EvidenceIdentity,
  state: MissionState,
  versions: Versions = currentVersions,
) {
  // Exact canonical identity is authoritative; the short local fingerprint is only a display aid.
  return canonical(basis) === canonical(evidenceIdentity(state, versions));
}
export function planSetMatches(review: MissionState['reviews'][number], state: MissionState) {
  return (
    review.planRevision === state.planRevision &&
    canonical(review.monitoringPlans.map(({ plan }) => plan)) === canonical(state.monitoringPlans)
  );
}
export function reviewStatus(state: MissionState) {
  const latest = state.reviews.at(-1);
  if (!latest) return 'No human review recorded.';
  if (!identityMatches(latest.basis, state) || !planSetMatches(latest, state))
    return 'Earlier review no longer matches current evidence/context. New review required.';
  return latest.disposition === 'findings-reviewed'
    ? 'Review recorded for the current evidence.'
    : 'Further review requested for the current evidence.';
}
