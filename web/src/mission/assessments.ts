import type { Gravity, MissionContext, MissionPhase } from './context';
import { measurementDefinitions, type PublishedEvidence } from './observations';
import { requirementDefinitions } from './requirements';
import type { MissionState } from './state';
import type { missionOverview } from './overview';
import { followupRecordId } from './archive';

export interface AssessmentOption {
  id: string;
  label: string;
  domain: string;
  measurement: string;
  rationale: string;
  option: string;
  phases: MissionPhase[];
  gravity: Gravity | 'protocol-specific';
  equipment: string[];
  assistance: string[];
  supervision: string[];
  protocol: string | null;
  maturity: 'fictional-record' | 'defined-method-required' | 'research-only';
  collection: 'archive-only' | 'deferred';
  source: PublishedEvidence;
  additionalSource?: { url: string; label: string };
  limitation: string;
  next: string;
}
const requirement = (id: string) => requirementDefinitions.find((r) => r.id === id)!;
const fatigueSource: PublishedEvidence = {
  origin: 'published-evidence',
  sourceUrl:
    'https://www.nasa.gov/human-systems-integration-division/human-performance/fatigue-countermeasures-laboratory/',
  locator: 'NASA Fatigue Countermeasures Laboratory, PVT+ and sleep diaries',
  population: 'Field and laboratory fatigue research',
  acquisitionContext: 'Instrument-specific research; no approval for this fictional mission.',
};
const flightPhases: MissionPhase[] = ['transit', 'approach', 'surface'];

/** Selected from the 18-candidate research review. Only obtained-record retrieval is enabled. */
export const assessmentCatalogue: readonly AssessmentOption[] = [
  {
    id: 'exercise',
    label: 'Recorded exercise response',
    domain: 'Exercise physiology',
    measurement: 'exercise-hr',
    rationale:
      'A compatible follow-up lets the review compare heart rate at the recorded workload.',
    option: 'Retrieve the 28 June session from the fictional onboard exercise archive.',
    phases: ['transit', 'approach'],
    gravity: 'microgravity',
    equipment: ['onboard-record-archive'],
    assistance: [],
    supervision: [],
    protocol: null,
    maturity: 'fictional-record',
    collection: 'archive-only',
    source: requirement('exercise').source,
    limitation:
      'Two exercise readings describe a recorded difference. They do not establish VO2max, cardiovascular danger, clinical deterioration or overall fitness.',
    next: 'Inspect the source and its acquisition conditions before adding it to the review.',
  },
  {
    id: 'aerobic',
    label: 'Aerobic capacity',
    domain: 'Cardiovascular performance',
    measurement: 'vo2max',
    rationale:
      'NASA Human Performance V1 4002/4003 concerns aerobic capacity for surface EVA and retention of pre-mission capacity. Exercise heart rate at 100 W cannot establish either requirement.',
    option: 'A qualified team would select an approved direct or indirect aerobic-capacity method.',
    phases: flightPhases,
    gravity: 'protocol-specific',
    equipment: ['authorised-aerobic-capacity-assessment-system'],
    assistance: ['qualified-exercise-team'],
    supervision: ['qualified-medical-supervisor'],
    protocol: 'approved-aerobic-capacity-method',
    maturity: 'defined-method-required',
    collection: 'deferred',
    source: requirement('aerobic').source,
    limitation:
      'The fictional cycle and HR monitor do not supply gas analysis or an approved indirect method, body-mass context or a compatible pre-mission capacity result. No VO2max estimate is made.',
    next: 'Ask qualified mission reviewers to establish equipment, method and oversight. Keep the requirement unresolved; no exercise test is started here.',
  },
  {
    id: 'mobility',
    label: 'Post-landing balance and mobility',
    domain: 'Sensorimotor function',
    measurement: 'post-landing-functional-observation',
    rationale:
      'Gravity transitions can affect balance and locomotion. The later lander-to-habitat transfer needs functional evidence that cycling records cannot supply.',
    option: 'Future task-specific assessment after landing, subject to mission approval.',
    phases: ['surface'],
    gravity: 'mars-0.38g',
    equipment: ['mission-approved-task-specific-equipment-not-established'],
    assistance: ['qualified-functional-assessment-team'],
    supervision: ['qualified-medical-supervisor'],
    protocol: 'approved-mars-functional-protocol',
    maturity: 'research-only',
    collection: 'deferred',
    source: requirement('mobility').source,
    additionalSource: {
      url: 'https://humanresearchroadmap.nasa.gov/gaps/gap.aspx?i=695',
      label: 'NASA HRR SM-204: post-planetary-landing self-testing research gap',
    },
    limitation:
      'Clément et al. studied Earth return at 1 g. Their sit-to-stand, walking and fall-recovery tasks are not validated Mars protocols and cannot provide the required observation in microgravity.',
    next: 'Retain the unresolved capability for qualified planning after landing. Do not perform walking, balance or fall-recovery tests during transit.',
  },
  {
    id: 'force',
    label: 'Historical muscular force',
    domain: 'Musculoskeletal function',
    measurement: 'leg-press-force',
    rationale:
      'The 1,000 N preflight leg-press reference has no compatible follow-up. A reference alone establishes neither change nor current strength.',
    option:
      'Review the existing reference; any future comparison needs the same defined endpoint and compatible acquisition.',
    phases: ['preflight'],
    gravity: 'earth-1g',
    equipment: ['compatible-force-rig'],
    assistance: ['trained-force-assessment-team'],
    supervision: ['qualified-medical-supervisor'],
    protocol: 'approved-compatible-force-protocol',
    maturity: 'defined-method-required',
    collection: 'deferred',
    source: {
      ...requirement('aerobic').source,
      locator: 'NASA Human Performance, musculoskeletal health',
      acquisitionContext:
        'Programme context only; the leg-press record and protocol are fictional.',
    },
    limitation:
      'Grip strength, exercise loads and unrelated force endpoints cannot substitute. This Earth reference does not establish Martian functional capacity.',
    next: 'Preserve the reference and ask whether a compatible authorised follow-up exists. Do not perform a maximal-force self-test.',
  },
  {
    id: 'pulse-oximetry',
    label: 'Pulse-oximetry observation',
    domain: 'Respiratory context',
    measurement: 'oxygen-saturation',
    rationale:
      'An approved oxygen-saturation observation could add respiratory context to a future review. It cannot answer the mobility question.',
    option:
      'Potential equipment-assisted self-measurement under an approved device procedure; unavailable in this mission.',
    phases: flightPhases,
    gravity: 'protocol-specific',
    equipment: ['approved-pulse-oximeter'],
    assistance: [],
    supervision: ['qualified-medical-supervisor'],
    protocol: 'approved-oximetry-procedure',
    maturity: 'defined-method-required',
    collection: 'deferred',
    source: {
      origin: 'published-evidence',
      sourceUrl:
        'https://www.fda.gov/medical-devices/products-and-medical-procedures/pulse-oximeters',
      locator: 'FDA: Pulse Oximeters, accuracy limitations',
      population: 'Medical-device use',
      acquisitionContext:
        'Device evidence; fictional mission availability and approval are not established.',
    },
    limitation:
      'Contact, circulation and skin pigmentation can affect accuracy. No safety threshold, diagnosis or functional-capacity inference is supplied.',
    next: 'Confirm a suitable device, approved procedure and review arrangements before considering collection. No sensor is connected.',
  },
  {
    id: 'sleep',
    label: 'Sleep and fatigue report',
    domain: 'Sleep and fatigue',
    measurement: 'reported-sleep-duration',
    rationale:
      'A sleep report can add context for a qualified fatigue review, while remaining separate from measured alertness and mobility.',
    option:
      'Potential crew self-report in an approved mission log. This mission has no approved reporting procedure or obtained report.',
    phases: flightPhases,
    gravity: 'protocol-specific',
    equipment: [],
    assistance: [],
    supervision: ['qualified-medical-supervisor'],
    protocol: 'approved-sleep-report',
    maturity: 'defined-method-required',
    collection: 'deferred',
    source: fatigueSource,
    limitation:
      'Self-report is different from actigraphy. No validated scale, fatigue diagnosis or clearance is created here.',
    next: 'Ask the mission reviewer whether an approved reporting plan and existing log are available. This prototype does not collect visitor health information.',
  },
  {
    id: 'alertness',
    label: 'Computer-based alertness',
    domain: 'Vigilant attention',
    measurement: 'instrument-specific-pvt',
    rationale:
      'Instrument-specific reaction-time research can inform fatigue questions. It cannot establish general cognition or readiness.',
    option:
      'A validated instrument and approved research protocol would be needed; no browser assessment is offered.',
    phases: flightPhases,
    gravity: 'protocol-specific',
    equipment: ['validated-pvt-instrument'],
    assistance: ['trained-research-operator'],
    supervision: ['research-supervisor'],
    protocol: 'approved-pvt-study',
    maturity: 'research-only',
    collection: 'deferred',
    source: fatigueSource,
    limitation:
      'NASA PVT+ uses a specified platform and study procedure. A browser clone would introduce unvalidated timing and hardware effects.',
    next: 'Keep this as a research-only option pending instrument, protocol and mission review.',
  },
];

export interface AssessmentEvidence {
  measurement: string;
  origin: string;
  supported: boolean;
  existingRecord: boolean;
  excluded: boolean;
}
export interface AssessmentPolicy {
  approvedProtocols: readonly string[];
  supervisors: readonly string[];
}
// Resource availability does not imply protocol approval or specialist qualification.
export const missionAssessmentPolicy: AssessmentPolicy = { approvedProtocols: [], supervisors: [] };
export type ApplicabilityReason =
  | 'information-available'
  | 'existing-record-retrievable'
  | 'reviewer-excluded'
  | 'additional-assessment-needed'
  | 'equipment-unavailable'
  | 'qualified-assistance-required'
  | 'supervision-required'
  | 'environment-incompatible'
  | 'phase-incompatible'
  | 'protocol-not-established'
  | 'future-phase-requirement'
  | 'research-only'
  | 'unresolved';
export const applicabilityLabels: Record<ApplicabilityReason, string> = {
  'information-available': 'Information available',
  'existing-record-retrievable': 'Existing record retrievable',
  'reviewer-excluded': 'Record intentionally excluded',
  'additional-assessment-needed': 'Additional assessment needed',
  'equipment-unavailable': 'Appropriate equipment unavailable',
  'qualified-assistance-required': 'Qualified assistance required',
  'supervision-required': 'Qualified supervision required',
  'environment-incompatible': 'Environment incompatible',
  'phase-incompatible': 'Mission phase incompatible',
  'protocol-not-established': 'Protocol not established',
  'future-phase-requirement': 'Future-phase requirement',
  'research-only': 'Research-only option',
  unresolved: 'Unresolved',
};

/** A missing observation yields reasons for review, never permission for a physical test. */
export function evaluateAssessmentApplicability(
  option: AssessmentOption,
  context: MissionContext,
  evidence: AssessmentEvidence,
  policy: AssessmentPolicy = missionAssessmentPolicy,
) {
  const reasons: ApplicabilityReason[] = [];
  const definitionValid =
    evidence.measurement === option.measurement &&
    (option.id !== 'exercise' || Object.hasOwn(measurementDefinitions, option.measurement));
  const originValid = evidence.origin === 'fictional-individual';
  const environment = option.gravity === 'protocol-specific' || context.gravity === option.gravity;
  const phase = option.phases.includes(context.phase);
  const missingEquipment = option.equipment.filter((id) => !context.equipment.includes(id));
  const missingAssistance = option.assistance.filter((id) => !context.assistance.includes(id));
  const missingSupervision = option.supervision.filter((id) => !policy.supervisors.includes(id));
  if (!definitionValid || !originValid) reasons.push('unresolved');
  if (!environment) reasons.push('environment-incompatible');
  if (!phase)
    reasons.push(
      option.id === 'mobility' && context.phase !== 'surface'
        ? 'future-phase-requirement'
        : 'phase-incompatible',
    );
  if (option.maturity === 'research-only') reasons.push('research-only');
  const available =
    definitionValid &&
    originValid &&
    environment &&
    phase &&
    evidence.supported &&
    !evidence.excluded;
  if (available) reasons.push('information-available');
  else {
    if (evidence.excluded) reasons.push('reviewer-excluded');
    if (missingEquipment.length) reasons.push('equipment-unavailable');
    if (missingAssistance.length) reasons.push('qualified-assistance-required');
    if (missingSupervision.length) reasons.push('supervision-required');
    if (option.protocol && !policy.approvedProtocols.includes(option.protocol))
      reasons.push('protocol-not-established');
    reasons.push(
      option.collection === 'archive-only' ? 'unresolved' : 'additional-assessment-needed',
    );
  }
  const canRetrieve =
    !available &&
    !evidence.excluded &&
    definitionValid &&
    originValid &&
    environment &&
    phase &&
    !missingEquipment.length &&
    !missingAssistance.length &&
    !missingSupervision.length &&
    (!option.protocol || policy.approvedProtocols.includes(option.protocol)) &&
    option.maturity !== 'research-only' &&
    evidence.existingRecord &&
    option.collection === 'archive-only';
  if (canRetrieve) {
    const unresolved = reasons.indexOf('unresolved');
    if (unresolved >= 0) reasons.splice(unresolved, 1);
    reasons.unshift('existing-record-retrievable');
  }
  return {
    reasons: [...new Set(reasons)],
    canRetrieve,
    canPerformPhysicalTest: false as const,
    missingEquipment,
    missingAssistance,
    missingSupervision,
  };
}

export function assessmentPlanner(state: MissionState, model: ReturnType<typeof missionOverview>) {
  return assessmentCatalogue.map((original) => {
    const available =
      model.rich &&
      model.requirements.some((r) => r.id === original.id && r.state === 'available-records');
    const option: AssessmentOption =
      available && ['aerobic', 'sleep'].includes(original.id)
        ? {
            ...original,
            label:
              original.id === 'aerobic'
                ? 'Measured aerobic observation'
                : 'Reported sleep duration',
            rationale:
              original.id === 'aerobic'
                ? 'Two previously collected gas-analysis assessments record absolute peak oxygen uptake.'
                : 'Two dated crew diary entries describe total sleep over equivalent preceding 24-hour periods.',
            option:
              'Available original fictional records are included in this review. Inspect their acquisition and descriptive interpretation.',
            limitation:
              original.id === 'aerobic'
                ? 'No true VO₂max plateau, mass-relative value or NASA requirement satisfaction is established.'
                : 'Self-report is separate from actigraphy, measured alertness and fatigue diagnosis.',
            next: 'Inspect the recorded finding, its source and its acquisition conditions.',
          }
        : original;
    return {
      option,
      ...evaluateAssessmentApplicability(option, state.context, {
        measurement: option.measurement,
        origin: 'fictional-individual',
        supported:
          option.id === 'exercise'
            ? !!model.exerciseComparison
            : model.rich &&
              model.requirements.some((r) => r.id === option.id && r.state === 'available-records'),
        existingRecord:
          option.id === 'exercise' && model.archivedRecords.some((r) => r.id === followupRecordId),
        excluded:
          option.id === 'exercise' &&
          state.excludedRecordIds.some((id) =>
            model.records.some((r) => r.id === id && r.measurement === 'exercise-hr'),
          ),
      }),
    };
  });
}
