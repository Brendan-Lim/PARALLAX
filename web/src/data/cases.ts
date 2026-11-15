import { measures, type CasePacket, type Measure, type Observation } from '../core/model';

function pair(caseId: string, measurement: Measure, before: number, after: number): Observation[] {
  return (['baseline', 'followup'] as const).map((phase, i) => ({
    id: `${caseId}-${measurement}-${phase}`,
    caseId,
    measurement,
    value: i ? after : before,
    unit: measures[measurement].unit,
    phase,
    session: i ? 'POST-DEMO' : 'PRE-DEMO',
    protocol: `fictional-${measurement}-v1`,
    window: 'demo-exposure-01',
    timestamp: null,
    origin: 'synthetic',
    form: 'direct',
    sourceId: 'parallax-fictional-v1',
    sourceRecord: `${caseId}/${measurement}/${phase}`,
    derivedFrom: [],
    issues: [],
  }));
}
const divergent: CasePacket = {
  schemaVersion: 1,
  origin: 'synthetic',
  context: {
    kind: 'mission-demo',
    acquisition:
      'Fictional Earth-based reference and follow-up assessments at 1 g. Not actual astronaut observations.',
  },
  case: {
    id: 'DEMO-01',
    title: 'Different measures. Different changes.',
    description:
      'Recorded force rises while a separate task takes longer. Inspect each finding, then change which observations are available. These fictional values are not reconstructed NASA participants.',
  },
  observations: [
    ...pair('DEMO-01', 'force', 1000, 1050),
    ...pair('DEMO-01', 'cardio', 20, 35),
    ...pair('DEMO-01', 'tandem', 95, 80),
    ...pair('DEMO-01', 'task', 20, 26),
  ],
};
const incomplete: CasePacket = {
  schemaVersion: 1,
  origin: 'synthetic',
  context: {
    kind: 'mission-demo',
    acquisition:
      'Fictional Earth-based reference and follow-up assessments at 1 g. Not actual astronaut observations.',
  },
  case: {
    id: 'DEMO-02',
    title: 'A task outcome is missing.',
    description:
      'A force comparison is available, but the follow-up task was never recorded. Published research provides context, not a replacement value.',
  },
  observations: [
    ...pair('DEMO-02', 'force', 900, 927),
    ...pair('DEMO-02', 'cardio', 18, 24),
    ...pair('DEMO-02', 'tandem', 92, 88),
    ...pair('DEMO-02', 'task', 24, 0).slice(0, 1),
  ],
};
const incompatible: CasePacket = {
  schemaVersion: 1,
  origin: 'synthetic',
  context: {
    kind: 'bed-rest-analog',
    acquisition:
      'Fictional pre/post bed-rest research assessments on Earth at 1 g; no actual study participant is represented.',
  },
  case: {
    id: 'DEMO-03',
    title: 'Numbers without a compatible comparison.',
    description:
      'The task protocol changed between sessions. Both values remain visible, but a numerical change is withheld because the tests are not established as comparable.',
  },
  observations: [
    ...pair('DEMO-03', 'force', 1100, 1078),
    ...pair('DEMO-03', 'cardio', 15, 23),
    ...pair('DEMO-03', 'tandem', 90, 84),
    ...pair('DEMO-03', 'task', 21, 25).map((r) =>
      r.phase === 'followup' ? { ...r, protocol: 'fictional-task-v2' } : r,
    ),
  ],
};
const dependent = structuredClone(divergent);
dependent.case = {
  id: 'DEMO-04',
  title: 'A copy is not independent evidence.',
  description:
    'A derived display copy of the force follow-up depends on its direct source. Excluding the direct follow-up leaves the copy but cannot establish an independent comparison.',
};
dependent.observations = dependent.observations.map((r) => ({
  ...r,
  id: r.id.replace('DEMO-01', 'DEMO-04'),
  caseId: 'DEMO-04',
  sourceRecord: r.sourceRecord.replace('DEMO-01', 'DEMO-04'),
}));
const forceSource = dependent.observations.find((r) => r.id === 'DEMO-04-force-followup')!;
dependent.observations.push({
  ...forceSource,
  id: 'DEMO-04-force-display-copy',
  form: 'derived',
  sourceRecord: 'DEMO-04/force/display-copy',
  derivedFrom: [forceSource.id],
});
const inflight: CasePacket = {
  schemaVersion: 1,
  origin: 'synthetic',
  context: {
    kind: 'inflight-demo',
    acquisition:
      'Invented observations during two previously authorised cycling sessions in simulated in-flight microgravity. No NASA records, device connection or validated monitoring protocol.',
  },
  case: {
    id: 'DEMO-05',
    title: 'In-flight exercise observation review.',
    description:
      'Two fictional cycling heart-rate readings: 125 and 140 bpm. These invented values and workload context are neither recommended targets nor clinical thresholds. Review existing records and their acquisition conditions.',
  },
  observations: pair('DEMO-05', 'hr', 125, 140).map((r, i) => ({
    ...r,
    session: i ? 'FLIGHT-SESSION-02' : 'FLIGHT-SESSION-01',
    protocol: 'fictional-cycling-hr-v1',
    window: 'fictional-plan-review-01',
    sourceId: 'fictional-onboard-log-v1',
    timestamp: i ? '2026-11-14T01:23:00.995Z' : '2026-11-14T01:23:00.989Z',
    acquisition: {
      setting: 'inflight-microgravity',
      activity: 'cycling-exercise',
      workloadWatts: 100,
      timing: 'final-minute-of-recorded-session',
      device: 'fictional-HR-monitor-01',
    },
  })),
};
// Separate presentation fixture. The original compatible DEMO-05 is preserved.
const flightMismatch = structuredClone(inflight);
flightMismatch.case = {
  id: 'DEMO-05-MISMATCH',
  title: 'Incompatible cycling acquisition conditions.',
  description:
    'Fictional source records contain 125 and 140 bpm at recorded workloads of 100 and 120 W. Inspect the mismatch before comparing. A verified correction changes the source record, never the exercise prescription.',
};
flightMismatch.observations = flightMismatch.observations.map((r) => ({
  ...r,
  caseId: flightMismatch.case.id,
  id: r.id.replace('DEMO-05', flightMismatch.case.id),
  sourceRecord: r.sourceRecord.replace('DEMO-05', flightMismatch.case.id),
  acquisition: { ...r.acquisition!, workloadWatts: r.phase === 'followup' ? 120 : 100 },
}));
export const cases: CasePacket[] = [
  divergent,
  incomplete,
  incompatible,
  dependent,
  inflight,
  flightMismatch,
];
export const freshCase = (id = 'DEMO-01') =>
  structuredClone(cases.find((c) => c.case.id === id) ?? divergent);
