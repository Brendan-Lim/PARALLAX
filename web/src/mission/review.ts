import { allMissionObservations, isRich } from './richEvidence';
import { validateMonitoringSnapshot, type MonitoringSnapshot } from '../monitoring/snapshot';
import type { MissionState } from './state';
import { validateContext, type MissionContext } from './context';
import { fixtureRevision, validateObservations, type FictionalObservation } from './observations';
import { missionOverview } from './overview';
import {
  healthInterpretations,
  interpretationSources,
  reviewOrderLabels,
  type HealthInterpretation,
  type InterpretationSource,
} from './interpretation';
import {
  canonical,
  evidenceIdentity,
  identityMatches,
  localFingerprint,
  currentVersions,
  type EvidenceIdentity,
} from './identity';
import { channelContracts, channelSource } from './channels';
import { exact, object, requireValid, text, strings } from './validation';

export const historyLimit = 5;
export const fictionalReviewer = 'Fictional CMO · demo reviewer' as const;
export const dispositions = {
  'information-requested': 'Further information requested',
  'monitoring-requested': 'Monitoring review requested',
  'findings-reviewed': 'Findings reviewed; unresolved requirements retained',
  'qualified-review-needed': 'Additional qualified review needed',
} as const;
export type Disposition = keyof typeof dispositions;
export const reviewReasons = {
  'functional-unknown': 'Post-landing function remains unknown',
  'aerobic-missing': 'Appropriate aerobic-capacity result missing',
  'exercise-context': 'Exercise records and limitations reviewed',
  'force-followup': 'Compatible force follow-up missing',
  'monitoring-context': 'Future monitoring needs activity, time and quality context',
  'oxygen-reviewed': 'Recorded oxygen-uptake observations reviewed',
  'sleep-reviewed': 'Reported sleep information reviewed',
  'interruption-reviewed': 'Monitoring interruption reviewed',
  'acquisition-limits': 'Acquisition and signal-quality limitations retained',
} as const;
export type ReviewReason = keyof typeof reviewReasons;
export function availableReviewReasons(state: MissionState, monitoring?: MonitoringSnapshot) {
  const model = missionOverview(state);
  return Object.fromEntries(
    Object.entries(reviewReasons).filter(([id]) => {
      if (id === 'aerobic-missing') return !model.rich;
      if (id === 'oxygen-reviewed')
        return model.descriptive.some((c) => c.measurement === 'vo2peak' && c.supported);
      if (id === 'sleep-reviewed')
        return model.descriptive.some(
          (c) => c.measurement === 'reported-sleep-duration' && c.supported,
        );
      if (id === 'interruption-reviewed')
        return !!monitoring?.events.some((e) => e.type === 'monitoring-interruption');
      return true;
    }),
  ) as Partial<Record<ReviewReason, string>>;
}
export const humanPriorities = {
  'routine-review': 'Retain for further review',
  'before-activity': 'Request review before the upcoming activity',
} as const;
export type HumanPriority = keyof typeof humanPriorities;
export interface ReviewSelection {
  disposition: Disposition;
  reasons: ReviewReason[];
  priority: HumanPriority;
}
export interface MonitoringPlan {
  id: string;
  watchId: 'cardiovascular';
  observation: 'device-heart-rate';
  designatedBy: typeof fictionalReviewer;
  rationale: 'contextual-cardiovascular-review';
  createdAtLocal: string;
  fictionalAt: string;
  basis: EvidenceIdentity;
  channel: {
    id: 'astro-hr';
    measurement: 'device-heart-rate';
    unit: 'bpm';
    datatype: 19;
    qualityDatatype: 1000;
    context: string;
    limitation: string;
  };
  /** Live/recorded acquisition availability; synthetic format support is disclosed separately. */
  sourceAvailable: false;
}
export interface ReviewSnapshot {
  monitoring?: MonitoringSnapshot;
  schemaVersion: 1 | 2;
  id: string;
  reviewer: typeof fictionalReviewer;
  disposition: Disposition;
  reasons: ReviewReason[];
  priority: HumanPriority;
  createdAtLocal: string;
  fictionalRecordedAt: string;
  basis: EvidenceIdentity;
  context: MissionContext;
  records: FictionalObservation[];
  excludedRecordIds: string[];
  findings: HealthInterpretation[];
  coverage: { available: number; total: number; ids: string[] };
  unresolvedRequirementIds: string[];
  monitoringPlans: { plan: MonitoringPlan; currencyAtReview: 'current' | 'stale' }[];
  planRevision: number;
  sources: InterpretationSource[];
  limitations: string[];
}
export const reviewLimitations = [
  'All individual observations and reviewer actions are fictional. The fixed demo role authenticates no medical authority.',
  'Software-generated findings describe recorded evidence only. General hazards and group research are not individual diagnoses or predictions.',
  'Aerobic capacity, current muscular-force change and post-landing functional outcome remain unestablished. Information coverage is not health, safety or readiness.',
  'No treatment, exercise adjustment, autonomous clearance, continuation or abort decision is provided.',
  'No device is connected. Bounded synthetic HR/quality replay and local companion notifications are available; absolute physiological freshness is unknown. Historical exercise change supplies no alarm threshold.',
  'Local fingerprints compare software state only. Browser storage is editable and evictable; this is neither tamper-proof nor a regulated medical record.',
];
export function reviewLimits(state: MissionState) {
  return isRich(state.includedRecordIds)
    ? reviewLimitations.map((line, i) =>
        i === 2
          ? 'Recorded absolute VO₂peak and reported sleep remain descriptive. True VO₂max, current muscular-force change and post-landing function remain unestablished. Information coverage is not readiness.'
          : line,
      )
    : reviewLimitations;
}
export function freezeSnapshot<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freezeSnapshot);
    Object.freeze(value);
  }
  return value;
}
export function validateSelection(input: unknown): asserts input is ReviewSelection {
  requireValid(
    object(input) &&
      exact(input, ['disposition', 'reasons', 'priority']) &&
      typeof input.disposition === 'string' &&
      Object.hasOwn(dispositions, input.disposition) &&
      typeof input.priority === 'string' &&
      Object.hasOwn(humanPriorities, input.priority) &&
      strings(input.reasons, 9) &&
      input.reasons.length > 0 &&
      new Set(input.reasons).size === input.reasons.length &&
      input.reasons.every((r) => Object.hasOwn(reviewReasons, r)),
    'Choose a bounded fictional disposition, priority and at least one review reason.',
  );
}
export const uuid = (x: unknown): x is string =>
  typeof x === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const localTime = (x: unknown): x is string =>
  typeof x === 'string' &&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(x) &&
  Number.isFinite(Date.parse(x)) &&
  new Date(x).toISOString() === x;
const positive = (x: unknown) => Number.isSafeInteger(x) && Number(x) >= 1;
const nonnegative = (x: unknown) => Number.isSafeInteger(x) && Number(x) >= 0;
const boundedText = (x: unknown, max = 2000): x is string =>
  text(x, max) && [...x].every((c) => c.charCodeAt(0) >= 32);
function validateHistoricalRecords(
  input: unknown,
  context: MissionContext,
  historicalFixture: string,
): FictionalObservation[] {
  requireValid(Array.isArray(input) && input.length <= 200, 'Invalid historical record list.');
  const normalized = input.map((r) => {
    requireValid(
      object(r) && object(r.provenance) && r.provenance.fixtureRevision === historicalFixture,
      'Historical fixture identity mismatch.',
    );
    return { ...r, provenance: { ...r.provenance, fixtureRevision } };
  });
  validateObservations(normalized, context);
  // Historical records are exported, never fed to the current evaluator.
  return structuredClone(input) as FictionalObservation[];
}
export function validateIdentity(x: unknown): asserts x is EvidenceIdentity {
  requireValid(
    object(x) &&
      exact(x, [
        'missionId',
        'astronautId',
        'sessionId',
        'contextRevision',
        'evidenceRevision',
        'fixtureRevision',
        'versions',
        'evidenceContextKey',
        'fingerprint',
      ]),
    'Invalid evidence identity fields.',
  );
  requireValid(
    x.missionId === 'DEMO-MARS-01' &&
      x.astronautId === 'FICTIONAL-01' &&
      uuid(x.sessionId) &&
      positive(x.contextRevision) &&
      positive(x.evidenceRevision) &&
      text(x.fixtureRevision, 80),
    'Invalid evidence identity.',
  );
  requireValid(
    object(x.versions) &&
      exact(x.versions, Object.keys(currentVersions)) &&
      Object.values(x.versions).every((v) => typeof v === 'string' && /^[a-z0-9.-]{1,80}$/.test(v)),
    'Invalid source/policy versions.',
  );
  requireValid(
    boundedText(x.evidenceContextKey, 40000) &&
      x.fingerprint === localFingerprint(x.evidenceContextKey),
    'Invalid local evidence key.',
  );
  const key: unknown = JSON.parse(x.evidenceContextKey);
  requireValid(
    object(key) &&
      exact(key, ['context', 'lineage', 'included', 'excluded', 'records']) &&
      (key.lineage === '' || uuid(key.lineage)) &&
      strings(key.included) &&
      strings(key.excluded),
    'Invalid evidence key contents.',
  );
  const keyContext = validateContext(key.context);
  requireValid(
    keyContext.missionId === x.missionId && keyContext.astronaut.id === x.astronautId,
    'Evidence subject/mission mismatch.',
  );
  const records = validateHistoricalRecords(
    key.records,
    key.context as unknown as MissionContext,
    x.fixtureRevision,
  );
  requireValid(
    canonical(key) === x.evidenceContextKey &&
      records.length === key.included.length &&
      key.included.every((id) => records.some((r) => r.id === id)) &&
      new Set(key.included).size === key.included.length &&
      new Set(key.excluded).size === key.excluded.length &&
      key.excluded.every((id) => (key.included as string[]).includes(id)),
    'Evidence membership mismatch.',
  );
  requireValid(
    (key.context as unknown as MissionContext).contextRevision === x.contextRevision,
    'Context identity mismatch.',
  );
}
export function createMonitoringPlan(
  state: MissionState,
  now = new Date().toISOString(),
): MonitoringPlan {
  requireValid(localTime(now), 'Invalid local creation time.');
  return freezeSnapshot({
    id: crypto.randomUUID(),
    watchId: 'cardiovascular',
    observation: 'device-heart-rate',
    designatedBy: fictionalReviewer,
    rationale: 'contextual-cardiovascular-review',
    createdAtLocal: now,
    fictionalAt: state.context.fictionalNow,
    basis: evidenceIdentity(state),
    channel: structuredClone(channelContracts[0]),
    sourceAvailable: false,
  });
}
export function planCurrency(plan: MonitoringPlan, state: MissionState) {
  return identityMatches(plan.basis, state) ? ('current' as const) : ('stale' as const);
}
export function planAvailability(plan: MonitoringPlan, state: MissionState) {
  return [
    'Fictional monitoring requirement designated',
    'Compatible device channel identified',
    'Device not connected',
    plan.basis.versions.monitoringPolicy === 'monitoring-policy-1'
      ? 'Observation source not implemented'
      : 'Synthetic documented-format source available; live source unavailable',
    'Monitoring not yet started',
    ...(planCurrency(plan, state) === 'stale' ? ['Monitoring plan stale'] : []),
  ];
}
export function validatePlan(x: unknown): asserts x is MonitoringPlan {
  requireValid(
    object(x) &&
      exact(x, [
        'id',
        'watchId',
        'observation',
        'designatedBy',
        'rationale',
        'createdAtLocal',
        'fictionalAt',
        'basis',
        'channel',
        'sourceAvailable',
      ]),
    'Invalid monitoring plan fields.',
  );
  requireValid(
    uuid(x.id) &&
      x.watchId === 'cardiovascular' &&
      x.observation === 'device-heart-rate' &&
      x.designatedBy === fictionalReviewer &&
      x.rationale === 'contextual-cardiovascular-review' &&
      localTime(x.createdAtLocal) &&
      typeof x.fictionalAt === 'string' &&
      object(x.channel) &&
      exact(x.channel, Object.keys(channelContracts[0])) &&
      x.channel.id === 'astro-hr' &&
      x.channel.measurement === 'device-heart-rate' &&
      x.channel.unit === 'bpm' &&
      x.channel.datatype === 19 &&
      x.channel.qualityDatatype === 1000 &&
      boundedText(x.channel.context) &&
      boundedText(x.channel.limitation) &&
      x.sourceAvailable === false,
    'Invalid fictional monitoring designation.',
  );
  validateIdentity(x.basis);
  const key = JSON.parse(x.basis.evidenceContextKey);
  requireValid(x.fictionalAt === key.context.fictionalNow, 'Plan fictional clock mismatch.');
}
export function createReview(
  state: MissionState,
  selection: ReviewSelection,
  now = new Date().toISOString(),
  monitoring?: MonitoringSnapshot,
): ReviewSnapshot {
  validateSelection(selection);
  requireValid(localTime(now), 'Invalid local creation time.');
  if (monitoring) {
    validateMonitoringSnapshot(monitoring);
    requireValid(
      !monitoring.run || monitoring.run.basis.sessionId === state.sessionId,
      'Monitoring snapshot belongs to another mission generation.',
    );
  }
  const model = missionOverview(state);
  const allowed = availableReviewReasons(state, monitoring);
  requireValid(
    selection.reasons.every((r) => Object.hasOwn(allowed, r)),
    'Review reasons no longer match the available observations. Inspect the current findings.',
  );
  return freezeSnapshot(
    structuredClone({
      schemaVersion: isRich(state.includedRecordIds) ? 2 : 1,
      ...(monitoring ? { monitoring } : {}),
      id: crypto.randomUUID(),
      reviewer: fictionalReviewer,
      ...selection,
      createdAtLocal: now,
      fictionalRecordedAt: state.context.fictionalNow,
      basis: evidenceIdentity(state),
      context: state.context,
      records: model.records,
      excludedRecordIds: [...state.excludedRecordIds].sort(),
      findings: healthInterpretations(state, model),
      coverage: model.coverage,
      unresolvedRequirementIds: model.requirements
        .filter((r) => r.state !== 'available-records')
        .map((r) => r.id),
      monitoringPlans: state.monitoringPlans.map((plan) => ({
        plan,
        currencyAtReview: planCurrency(plan, state),
      })),
      planRevision: state.planRevision,
      sources: [...interpretationSources, channelSource],
      limitations: reviewLimits(state),
    }),
  );
}
const interpretationFields = [
  'id',
  'domain',
  'requirement',
  'recordedObservation',
  'evidenceStatus',
  'meaning',
  'scientificRelevance',
  'sourceIds',
  'missionRelevance',
  'limitation',
  'reviewAction',
  'unresolvedInformation',
  'monitoringRelationship',
  'potentialSource',
  'monitoringLimitation',
  'priority',
  'priorityReason',
  'concernBasis',
];
function validateFinding(x: unknown) {
  requireValid(
    object(x) && exact(x, interpretationFields),
    'Invalid snapshot interpretation fields.',
  );
  requireValid(
    ['functional', 'aerobic', 'cardiovascular', 'musculoskeletal', 'sleep'].includes(
      String(x.id),
    ) &&
      [
        'supported',
        'missing',
        'excluded',
        'incompatible',
        'unresolved',
        'historical-reference',
      ].includes(String(x.evidenceStatus)) &&
      Object.hasOwn(reviewOrderLabels, String(x.priority)) &&
      ['unresolved-capability', 'recorded-difference', 'information-gap'].includes(
        String(x.concernBasis),
      ),
    'Invalid interpretation status.',
  );
  requireValid(
    strings(x.sourceIds, 4) &&
      x.sourceIds.length > 0 &&
      x.sourceIds.every((id) => interpretationSources.some((s) => s.id === id)),
    'Unknown interpretation source.',
  );
  for (const key of interpretationFields.filter((k) => k !== 'sourceIds'))
    requireValid(boundedText(x[key]), 'Invalid interpretation text.');
}
export function validateReview(x: unknown): asserts x is ReviewSnapshot {
  requireValid(
    object(x) &&
      exact(x, [
        'schemaVersion',
        ...(Object.hasOwn(x, 'monitoring') ? ['monitoring'] : []),
        'id',
        'reviewer',
        'disposition',
        'reasons',
        'priority',
        'createdAtLocal',
        'fictionalRecordedAt',
        'basis',
        'context',
        'records',
        'excludedRecordIds',
        'findings',
        'coverage',
        'unresolvedRequirementIds',
        'monitoringPlans',
        'planRevision',
        'sources',
        'limitations',
      ]),
    'Invalid saved review fields.',
  );
  validateSelection({ disposition: x.disposition, reasons: x.reasons, priority: x.priority });
  requireValid(
    (x.schemaVersion === 1 || x.schemaVersion === 2) &&
      uuid(x.id) &&
      x.reviewer === fictionalReviewer &&
      localTime(x.createdAtLocal) &&
      nonnegative(x.planRevision),
    'Invalid fictional review record.',
  );
  validateIdentity(x.basis);
  if (Object.hasOwn(x, 'monitoring')) {
    validateMonitoringSnapshot(x.monitoring);
    if (x.monitoring.run) {
      validateIdentity(x.monitoring.run.basis);
      validatePlan(x.monitoring.run.plan);
    }
    requireValid(
      !x.monitoring.run || x.monitoring.run.basis.sessionId === x.basis.sessionId,
      'Snapshot generation mismatch.',
    );
  }
  const context = validateContext(x.context);
  const records = validateHistoricalRecords(x.records, context, x.basis.fixtureRevision);
  const key = JSON.parse(x.basis.evidenceContextKey);
  requireValid(
    canonical(context) === canonical(key.context) &&
      canonical(records) === canonical(key.records) &&
      canonical(x.excludedRecordIds) === canonical(key.excluded) &&
      x.fictionalRecordedAt === context.fictionalNow &&
      x.basis.missionId === context.missionId &&
      x.basis.astronautId === context.astronaut.id,
    'Snapshot evidence/context mismatch.',
  );
  requireValid(
    Array.isArray(x.findings) && x.findings.length === (x.schemaVersion === 2 ? 5 : 4),
    'Snapshot needs four health domains.',
  );
  x.findings.forEach(validateFinding);
  requireValid(
    new Set(x.findings.map((f) => (f as HealthInterpretation).id)).size ===
      (x.schemaVersion === 2 ? 5 : 4),
    'Duplicate health domain.',
  );
  const coverage = x.coverage;
  requireValid(
    object(coverage) &&
      exact(coverage, ['available', 'total', 'ids']) &&
      nonnegative(coverage.available) &&
      positive(coverage.total) &&
      Number(coverage.available) <= Number(coverage.total) &&
      strings(coverage.ids, 4) &&
      coverage.ids.length === coverage.total &&
      new Set(coverage.ids).size === coverage.ids.length &&
      coverage.ids.every((id) => ['exercise', 'aerobic', 'mobility', 'sleep'].includes(id)),
    'Invalid coverage snapshot.',
  );
  requireValid(
    strings(x.unresolvedRequirementIds, 4) &&
      new Set(x.unresolvedRequirementIds).size === x.unresolvedRequirementIds.length &&
      (x.schemaVersion === 2 || x.unresolvedRequirementIds.includes('aerobic')) &&
      x.unresolvedRequirementIds.includes('mobility') &&
      x.unresolvedRequirementIds.every((id) =>
        ['exercise', 'aerobic', 'mobility', 'sleep'].includes(id),
      ),
    'Invalid unresolved requirements.',
  );
  requireValid(
    Array.isArray(x.monitoringPlans) && x.monitoringPlans.length <= historyLimit,
    'Invalid monitoring history.',
  );
  for (const p of x.monitoringPlans) {
    requireValid(
      object(p) &&
        exact(p, ['plan', 'currencyAtReview']) &&
        ['current', 'stale'].includes(String(p.currencyAtReview)),
      'Invalid plan snapshot.',
    );
    validatePlan(p.plan);
    requireValid(
      p.currencyAtReview === (canonical(p.plan.basis) === canonical(x.basis) ? 'current' : 'stale'),
      'Plan snapshot currency mismatch.',
    );
  }
  requireValid(
    new Set(x.monitoringPlans.map((p) => (p as { plan: MonitoringPlan }).plan.id)).size ===
      x.monitoringPlans.length,
    'Duplicate snapshot monitoring plan.',
  );
  requireValid(
    Array.isArray(x.sources) && [5, 7].includes(x.sources.length),
    'Missing review sources.',
  );
  const sources = [...interpretationSources, channelSource];
  for (const s of x.sources) {
    requireValid(
      object(s) &&
        exact(s, Object.keys(sources[0])) &&
        Object.values(s).every((v) => boundedText(v)) &&
        sources.some((known) => s.id === known.id && s.url === known.url),
      'Invalid review source.',
    );
  }
  requireValid(
    new Set(x.sources.map((s) => (s as InterpretationSource).id)).size === x.sources.length &&
      Array.isArray(x.limitations) &&
      x.limitations.length <= 8 &&
      x.limitations.every((line) => boundedText(line)) &&
      x.limitations.length >= reviewLimitations.length,
    'Invalid review limitations.',
  );
  if (
    canonical(x.basis.versions) === canonical(currentVersions) &&
    x.basis.fixtureRevision === fixtureRevision
  ) {
    const historical: MissionState = {
      schemaVersion: 2,
      fixtureRevision,
      sessionId: x.basis.sessionId,
      context,
      entered: true,
      includedRecordIds: key.included,
      excludedRecordIds: key.excluded,
      evidenceRevision: x.basis.evidenceRevision,
      reviewSchemaVersion: 1,
      evidenceLineage: key.lineage,
      planRevision: Number(x.planRevision),
      monitoringPlans: [],
      reviews: [],
      droppedHistory: { plans: 0, reviews: 0 },
    };
    const expected = missionOverview(historical);
    const allowed = availableReviewReasons(
      historical,
      x.monitoring as MonitoringSnapshot | undefined,
    );
    requireValid(
      (x.reasons as ReviewReason[]).every((r) => Object.hasOwn(allowed, r)),
      'Current review reasons do not match the available observations.',
    );
    requireValid(
      canonical(records) ===
        canonical(allMissionObservations().filter((r) => key.included.includes(r.id))) &&
        canonical(x.findings) === canonical(healthInterpretations(historical, expected)) &&
        canonical(x.coverage) === canonical(expected.coverage) &&
        canonical(x.unresolvedRequirementIds) ===
          canonical(
            expected.requirements.filter((r) => r.state !== 'available-records').map((r) => r.id),
          ) &&
        canonical(x.sources) === canonical([...interpretationSources, channelSource]) &&
        canonical(x.limitations) === canonical(reviewLimits(historical)),
      'Generated snapshot does not match its source evidence and templates.',
    );
  }
}
