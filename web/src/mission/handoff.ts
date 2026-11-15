import type { MonitoringSnapshot } from '../monitoring/snapshot';
import { eventMeaning, eventOrigin, needsReview } from '../monitoring/semantics';
import type { MissionState } from './state';
import {
  identityMatches,
  planSetMatches,
  evidenceIdentity,
  canonical,
  type EvidenceIdentity,
} from './identity';
import {
  dispositions,
  reviewReasons,
  humanPriorities,
  planCurrency,
  type ReviewSnapshot,
} from './review';
export type ReviewCurrency = 'current-review' | 'stale-review' | 'historical-snapshot';
export function reviewCurrency(review: ReviewSnapshot, state: MissionState): ReviewCurrency {
  if (!identityMatches(review.basis, state) || !planSetMatches(review, state))
    return 'stale-review';
  return state.reviews.at(-1)?.id === review.id ? 'current-review' : 'historical-snapshot';
}
export const currencyLabels: Record<ReviewCurrency, string> = {
  'current-review': 'Current review',
  'stale-review': 'Stale review · historical snapshot · new review required',
  'historical-snapshot': 'Historical snapshot · superseded by a later review',
};
export interface HandoffDocument {
  monitoringUpdate?: {
    message: string;
    furtherReviewRequired: boolean;
    newEventIds: string[];
    newSamples: number;
    newTransitions: number;
    newAcknowledgments: number;
  };
  schemaVersion: 1;
  snapshot: ReviewSnapshot;
  currency: ReviewCurrency;
  exportedAtLocal: string;
  currentIdentity: EvidenceIdentity;
  sections: { heading: string; lines: string[] }[];
}
/** Preview and both downloads receive this same canonical handoff object. */
export function handoffDocument(
  review: ReviewSnapshot,
  state: MissionState,
  now = new Date().toISOString(),
  liveMonitoring?: MonitoringSnapshot,
): HandoffDocument {
  const currency = reviewCurrency(review, state);
  const r = review;
  const savedMonitoring = r.monitoring;
  const comparable = liveMonitoring?.run?.basis.sessionId === r.basis.sessionId;
  const newEvents = comparable
    ? liveMonitoring.events.filter((e) => !savedMonitoring?.events.some((old) => old.id === e.id))
    : [];
  const newSamples = comparable
    ? liveMonitoring.samples.filter(
        (sample) => !savedMonitoring?.samples.some((old) => old.id === sample.id),
      ).length
    : 0;
  const newTransitions = comparable
    ? liveMonitoring.transitions.filter(
        (t) => !savedMonitoring?.transitions.some((old) => old.id === t.id),
      ).length
    : 0;
  const newAcknowledgments = comparable
    ? liveMonitoring.acknowledgments.filter(
        (a) => !savedMonitoring?.acknowledgments.some((old) => old.id === a.id),
      ).length
    : 0;
  const furtherReviewRequired = newEvents.some(needsReview);
  const monitoringUpdate = {
    furtherReviewRequired,
    newTransitions,
    newAcknowledgments,
    newEventIds: newEvents.map((e) => e.id),
    newSamples,
    message: furtherReviewRequired
      ? 'New monitoring events were not included in this review. Further monitoring review required.'
      : newEvents.length || newSamples || newTransitions || newAcknowledgments
        ? 'New monitoring information is available after the saved snapshot. Ordinary samples do not invalidate the evidence or designation.'
        : !liveMonitoring
          ? !savedMonitoring
            ? 'Historical review predates monitoring snapshots; no telemetry was included. Current comparison is pending.'
            : 'Current monitoring comparison is pending. Saved contents remain unchanged.'
          : liveMonitoring.availability === 'unavailable'
            ? 'Current monitoring ledger unavailable. Later information cannot be checked.'
            : !savedMonitoring
              ? 'Historical review predates monitoring snapshots; no telemetry was included.'
              : !comparable && liveMonitoring.run
                ? 'The current monitoring run belongs to another mission generation. The saved snapshot remains historical.'
                : 'No later monitoring information identified in the latest-run comparison.',
  };
  const sections = [
    {
      heading: 'Mission context',
      lines: [
        r.context.missionName,
        `${r.context.astronaut.name} (${r.context.astronaut.id}), fictional crew`,
        `${r.context.phase}; ${r.context.gravity}; fictional time ${r.fictionalRecordedAt}`,
        `Upcoming: ${r.context.nextActivity.label} at ${r.context.nextActivity.at}`,
      ],
    },
    {
      heading: 'Recorded health findings',
      lines: r.findings.map((f) => `${f.domain}: ${f.recordedObservation} ${f.meaning}`),
    },
    {
      heading: 'Evidence support',
      lines: [
        ...r.findings.map((f) => `${f.domain}: ${f.evidenceStatus}; ${f.concernBasis}.`),
        ...r.records.map(
          (o) =>
            `${o.id}: ${o.value} ${o.unit}; ${o.timestamp}; ${o.protocol}; ${o.provenance.sourceId}/${o.provenance.sourceRecord}; ${r.excludedRecordIds.includes(o.id) ? 'excluded' : 'included'}. Acquisition: ${canonical(o.acquisition)}; quality: ${canonical(o.quality)}`,
        ),
      ],
    },
    {
      heading: 'Unresolved assessment requirements',
      lines: [
        `Unresolved: ${r.unresolvedRequirementIds.join(', ')}.`,
        `Information available for ${r.coverage.available} of ${r.coverage.total} ${r.context.phase} items: ${r.coverage.ids.join(', ')}. This is information coverage only.`,
        ...r.findings
          .filter((f) => f.evidenceStatus !== 'supported')
          .map((f) => `${f.domain}: ${f.unresolvedInformation}`),
      ],
    },
    {
      heading: 'Relevant interpretation',
      lines: r.findings.map(
        (f) =>
          `${f.domain}: ${f.scientificRelevance} Mission relevance: ${f.missionRelevance} Limitation: ${f.limitation} Review action: ${f.reviewAction} Sources: ${f.sourceIds.join(', ')}.`,
      ),
    },
    {
      heading: 'Monitoring-plan status',
      lines: r.monitoringPlans.length
        ? r.monitoringPlans.map(
            ({ plan: p, currencyAtReview }) =>
              `${p.id}: heart-rate observations for cardiovascular review; ${currencyAtReview} when reviewed; ${planCurrency(p, state)} against current evidence. Designated by ${p.designatedBy}. Device not connected; ${p.basis.versions.monitoringPolicy === 'monitoring-policy-1' ? 'observation source not implemented at designation' : 'synthetic documented-format source available; live source unavailable'}; ${r.monitoring?.run?.plan.id === p.id ? 'bounded synthetic replay included in this review' : 'no replay included for this designation'}. Potential source: ${p.channel.id}, datatype ${p.channel.datatype}, quality ${p.channel.qualityDatatype}; live source available: no. Required context: ${p.channel.context} Limitations: ${p.channel.limitation} Basis: ${p.basis.fingerprint}; ${canonical(p.basis.versions)}.`,
          )
        : [
            'Monitoring candidate identified; no fictional requirement designated. No device connected; monitoring not started.',
          ],
    },
    {
      heading: 'Monitoring snapshot and source',
      lines: savedMonitoring
        ? [
            `Local review cutoff: ${savedMonitoring.cutoff}; ledger ${savedMonitoring.availability}. ${savedMonitoring.limitation}`,
            ...(savedMonitoring.run
              ? [
                  `Run ${savedMonitoring.run.id}; plan ${savedMonitoring.run.plan.id}; plan revision ${savedMonitoring.run.planRevision}; session ${savedMonitoring.run.basis.sessionId}. Replay ${savedMonitoring.run.status}; ${savedMonitoring.run.cursor}/8 samples at cutoff.`,
                  `Source ${savedMonitoring.run.source}; adapter ${savedMonitoring.run.adapter}; fixture ${savedMonitoring.run.fixture}; acquisition ${canonical(savedMonitoring.run.acquisition)}; source policy ${savedMonitoring.run.basis.versions.monitoringPolicy}; event policy ${savedMonitoring.run.eventPolicy}; timing policy ${savedMonitoring.run.temporalPolicy}. Level 1 synthetic documented-format compatibility; no physical connection.`,
                ]
              : ['No monitoring run included.']),
            ...savedMonitoring.samples.map(
              (sample) =>
                `${sample.id}: source ${sample.sourceId}; original ${sample.ticks} ticks (1/256-second, relative); raw ${sample.rawValue} ${sample.unit}; mask ${sample.mask ?? 'missing'}; ${sample.usability}; ${sample.qualityConditions.join(', ')}. Actual processing ${sample.receivedAt}; absolute acquisition unknown; payload ${sample.payloadId}.`,
            ),
          ]
        : [
            'This historical review contains no monitoring snapshot. No telemetry has been added retroactively.',
          ],
    },
    {
      heading: 'Monitoring events, delivery and acknowledgment',
      lines: savedMonitoring?.events.length
        ? savedMonitoring.events.map((event) => {
            const receipt = savedMonitoring.transitions.find(
              (t) => t.eventId === event.id && t.kind === 'displayed-receipt',
            );
            const attempt = savedMonitoring.transitions.find(
              (t) => t.eventId === event.id && t.kind === 'attempt',
            );
            const ack = savedMonitoring.acknowledgments.find((a) => a.eventId === event.id);
            return `${event.id}: ${event.type}; origin ${eventOrigin(event)}. ${eventMeaning(event)} Source observation ${event.observationId ?? 'none; independent simulation'}; created locally ${event.createdAt}. ${attempt ? 'Delivery attempt ' + attempt.at + '.' : 'No delivery attempt included.'} ${receipt ? 'Displayed receipt ' + receipt.at + '; companion ' + receipt.companionId + '.' : 'No displayed receipt included.'} ${ack ? 'Acknowledged by ' + ack.role + ' at ' + ack.at + '.' : 'Not acknowledged at cutoff.'} Included in fictional review ${r.id}; disposition ${dispositions[r.disposition]}. Notification acknowledgment and monitoring recovery do not establish medical resolution.`;
          })
        : ['No monitoring events included in this saved snapshot.'],
    },
    {
      heading: 'Current monitoring envelope after saved review',
      lines: [
        monitoringUpdate.message,
        `Later event IDs: ${monitoringUpdate.newEventIds.join(', ') || 'none identified'}; new samples in latest run: ${newSamples}; later delivery transitions ${newTransitions}; later acknowledgments ${newAcknowledgments}. Saved contents remain unchanged. This comparison is limited to retained latest-run history; it cannot establish that no other events ever occurred.`,
      ],
    },
    {
      heading: 'Human-review disposition',
      lines: [
        r.reviewer,
        dispositions[r.disposition],
        `Selected reasons: ${r.reasons.map((reason) => reviewReasons[reason]).join('; ')}.`,
        `Human-selected priority: ${humanPriorities[r.priority]}. This selection belongs to the fictional reviewer.`,
        'This records a fictional workflow action. It provides no medical or mission clearance.',
      ],
    },
    {
      heading: 'Currency and provenance',
      lines: [
        currencyLabels[currency],
        `Review ID: ${r.id}; mission ${r.basis.missionId}; astronaut ${r.basis.astronautId}; session ${r.basis.sessionId}.`,
        `Created locally: ${r.createdAtLocal}; fictional mission time: ${r.fictionalRecordedAt}; export created locally: ${now}.`,
        `Context revision ${r.basis.contextRevision}; evidence revision ${r.basis.evidenceRevision}; fixture ${r.basis.fixtureRevision}; plan revision ${r.planRevision}.`,
        `Versions: ${canonical(r.basis.versions)}.`,
        `Snapshot fingerprint ${r.basis.fingerprint}; current fingerprint ${evidenceIdentity(state).fingerprint}. Exact canonical identity, session and revisions determine currency; local fingerprints do not authenticate records.`,
        'The saved snapshot is preserved. Currency and export time describe this handoff envelope. History retains the latest five reviews and five designations.',
      ],
    },
    {
      heading: 'Scientific limitations',
      lines: [
        ...r.limitations,
        'Two exercise observations are a paired history, not a validated longitudinal trend. Synthetic device replay remains separate from assessment evidence.',
      ],
    },
    {
      heading: 'Relevant sources',
      lines: r.sources.map(
        (s) =>
          `${s.id}: ${s.reference}. ${s.url} Locator: ${s.locator}. Population/context: ${s.population} Supported finding: ${s.finding} Boundary: ${s.boundary} Product consequence: ${s.consequence}`,
      ),
    },
  ];
  return {
    schemaVersion: 1,
    snapshot: r,
    monitoringUpdate,
    currency,
    exportedAtLocal: now,
    currentIdentity: evidenceIdentity(state),
    sections,
  };
}
const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export function handoffHtml(doc: HandoffDocument) {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>PARALLAX fictional mission review</title><style>body{font:16px/1.6 system-ui,sans-serif;max-width:75ch;margin:3rem auto;padding:0 1.25rem;color:#172225}p{overflow-wrap:anywhere}h2{margin-top:2rem}</style><h1>PARALLAX fictional mission review</h1><p>${escapeHtml(currencyLabels[doc.currency])}</p>${doc.sections.map((s) => `<section><h2>${escapeHtml(s.heading)}</h2>${s.lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}</section>`).join('')}<script type="application/json" id="canonical-review">${JSON.stringify(doc).replace(/</g, '\\u003c')}</script></html>`;
}
