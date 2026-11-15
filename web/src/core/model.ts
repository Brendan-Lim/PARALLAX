export const measures = {
  force: {
    label: 'Muscular force',
    short: 'Muscular',
    detail: 'Leg-press isometric force',
    unit: 'N',
    domain: 'Muscular',
    relative: true,
    source: 'fitness',
  },
  cardio: {
    label: 'Cardiovascular response',
    short: 'Cardiovascular',
    detail: 'Posture-related heart-rate response',
    unit: 'bpm',
    domain: 'Cardiovascular',
    relative: false,
    source: 'cardiovascular',
  },
  tandem: {
    label: 'Sensorimotor observation',
    short: 'Sensorimotor',
    detail: 'Tandem correct steps',
    unit: '%',
    domain: 'Sensorimotor',
    relative: false,
    source: 'sensorimotor',
  },
  task: {
    label: 'Functional task',
    short: 'Functional',
    detail: 'Demonstration task completion',
    unit: 's',
    domain: 'Functional',
    relative: true,
    source: 'egress',
  },
  hr: {
    label: 'Heart rate',
    short: 'Heart rate',
    detail: 'Recorded heart rate',
    unit: 'bpm',
    domain: 'Cardiovascular',
    relative: false,
    source: 'cardiovascular',
  },
  map: {
    label: 'Mean arterial pressure',
    short: 'MAP',
    detail: 'Recorded mean arterial pressure',
    unit: 'mmHg',
    domain: 'Cardiovascular',
    relative: false,
    source: 'cardiovascular',
  },
} as const;

export type Measure = keyof typeof measures;
export type Phase = 'baseline' | 'followup';
export interface Acquisition {
  setting: 'inflight-microgravity';
  activity: 'cycling-exercise';
  workloadWatts: number;
  timing: string;
  device: string;
}
export interface Observation {
  acquisition?: Acquisition;
  id: string;
  caseId: string;
  measurement: Measure;
  value: number;
  unit: string;
  phase: Phase;
  session: string;
  protocol: string;
  window: string;
  timestamp: string | null;
  origin: 'synthetic';
  form: 'direct' | 'derived';
  sourceId: string;
  sourceRecord: string;
  derivedFrom: string[];
  issues: string[];
}
export interface CasePacket {
  schemaVersion: 1;
  origin: 'synthetic';
  case: { id: string; title: string; description: string };
  context?: { kind: 'mission-demo' | 'bed-rest-analog' | 'inflight-demo'; acquisition: string };
  observations: Observation[];
}
export type EvidenceStatus = 'supported' | 'insufficient' | 'unresolved' | 'outside';
export interface Comparison {
  baseline: Observation;
  followup: Observation;
  absolute: number;
  relative: number | null;
  changeUnit: string;
  direction: 'increased' | 'decreased' | 'unchanged';
}
export interface Finding {
  id: Measure | 'overall' | 'clearance';
  title: string;
  status: EvidenceStatus;
  explanation: string;
  evidence: Observation[];
  excluded: Observation[];
  unavailable: Observation[];
  requirements: string[];
  issues: string[];
  limitations: string[];
  contextIds: string[];
  comparison?: Comparison;
}
export const statusLabels: Record<EvidenceStatus, string> = {
  supported: 'Direct observations support this',
  insufficient: 'Insufficient evidence',
  unresolved: 'Unresolved observations',
  outside: 'Outside validated scope',
};

export const primaryMeasures: Measure[] = ['force', 'cardio', 'tandem', 'task'];
export const trackedMeasures = (packet: CasePacket): Measure[] => [
  ...primaryMeasures,
  ...(['hr', 'map'] as Measure[]).filter((key) =>
    packet.observations.some((r) => r.measurement === key),
  ),
];
