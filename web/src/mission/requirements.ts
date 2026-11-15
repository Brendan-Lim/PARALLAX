import type { PublishedEvidence } from './observations';
import type { MissionPhase, Gravity } from './context';

export type RequirementState =
  | 'excluded-records'
  | 'available-records'
  | 'missing-existing-record'
  | 'uncollected-observation'
  | 'available-assessment-option'
  | 'incompatible-environment'
  | 'future-phase-assessment'
  | 'unresolved-requirement';
export interface AssessmentRequirement {
  id: string;
  label: string;
  state: RequirementState;
  applicablePhases: MissionPhase[];
  requiredGravity: Gravity | 'protocol-specific';
  requiredEquipment: string[];
  requiredSupervision: string;
  source: PublishedEvidence;
  unresolvedReason: string;
}

/** Three scoped review questions, not a general assessment catalogue or acquisition protocol. */
export const requirementDefinitions: readonly AssessmentRequirement[] = [
  {
    id: 'exercise',
    label: 'Recorded exercise response',
    state: 'available-records',
    applicablePhases: ['transit', 'approach'],
    requiredGravity: 'microgravity',
    requiredEquipment: ['fictional-cycle-01', 'fictional-hr-monitor-01', 'onboard-record-archive'],
    requiredSupervision:
      'Previously authorised fictional exercise sessions; no new exercise is requested.',
    source: {
      origin: 'published-evidence',
      sourceUrl: 'https://www.nasa.gov/missions/station/iss-research/astronaut-exercise/',
      locator: 'CEVIS cycling and heart-rate monitoring description',
      population: 'ISS exercise operations',
      acquisitionContext:
        'Equipment context only; the comparison protocol and values are fictional.',
    },
    unresolvedReason:
      'A compatible direct pair is required. Exercise HR cannot establish aerobic capacity or mobility.',
  },
  {
    id: 'aerobic',
    label: 'Aerobic-capacity evidence',
    state: 'uncollected-observation',
    applicablePhases: ['transit', 'approach', 'surface'],
    requiredGravity: 'protocol-specific',
    requiredEquipment: ['authorised-aerobic-capacity-assessment-system'],
    requiredSupervision: 'Qualified exercise and medical team using an authorised protocol.',
    source: {
      origin: 'published-evidence',
      sourceUrl: 'https://www.nasa.gov/reference/4-0-human-performance/',
      locator: 'NASA-STD-3001 Vol 1, V1 4002 and 4003',
      population: 'Crew programmes, including extraterrestrial surface-EVA missions',
      acquisitionContext:
        'Published programme requirements, not observations of this fictional astronaut.',
    },
    unresolvedReason:
      'No appropriate aerobic-capacity result is supplied. Heart rate at one workload cannot establish VO2max.',
  },
  {
    id: 'mobility',
    label: 'Post-landing balance and mobility',
    state: 'future-phase-assessment',
    applicablePhases: ['surface'],
    requiredGravity: 'mars-0.38g',
    requiredEquipment: ['mission-approved-task-specific-equipment-not-established'],
    requiredSupervision:
      'Qualified mission medical and operational review; no Mars assessment protocol is established here.',
    source: {
      origin: 'published-evidence',
      sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9733831/',
      locator: 'Clément et al. (2022), Methods and Discussion',
      population: '19 astronauts after ISS flight, assessed on Earth',
      acquisitionContext:
        'Earth-return research at 1 g. It does not validate a Mars test at 0.38 g.',
    },
    unresolvedReason:
      'Not assessable during microgravity approach. Post-landing protocol, equipment and supervision remain unestablished.',
  },
];

/** Actual Phase 3 contracts live with their implementing modules. */
export type { EvidenceIdentity } from './identity';
export type { HealthInterpretation } from './interpretation';
export type { MonitoringPlan, ReviewSnapshot } from './review';

/** Future event seam only; delivery and acknowledgments remain unimplemented. */
export interface DeviceEventReference {
  id: string;
  sourceId: string;
  occurredAt: string | null;
  receivedAt: string;
  delivery: 'pending' | 'confirmed';
  acknowledgedAt: string | null;
  humanReviewId: string | null;
}
