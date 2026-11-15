import type { DescriptiveObservation, FictionalObservation } from './observations';
import { missionObservations, fixtureRevision, validateObservations } from './observations';
import type { MissionContext } from './context';
import { exact, object, requireValid, text, utc } from './validation';

export const richRevision = 'fictional-health-register-v2';
export const richSources = [
  {
    id: 'vo2peak-research',
    url: 'https://ntrs.nasa.gov/citations/20140003747',
    label: 'Downs et al. (2014), NTRS 20140003747',
    boundary:
      'Spaceflight research used separate metabolic gas analysis. It does not validate these fictional records, protocol or Mars applicability.',
  },
  {
    id: 'sleep-research',
    url: 'https://www.nasa.gov/reference/standard-measures/',
    label: 'NASA Standard Measures',
    boundary:
      'Sleep is a separate research domain. This diary is self-report, with no actigraphy, fatigue diagnosis or performance prediction.',
  },
] as const;
export function validateDescriptiveRecord(r: Record<string, unknown>, context: MissionContext) {
  const a = r.acquisition;
  requireValid(
    object(a) && r.form === 'direct' && r.protocol === `${r.measurement}-fictional-v2`,
    'Undefined descriptive record protocol.',
  );
  if (r.measurement === 'vo2peak') {
    requireValid(
      r.unit === 'L/min' &&
        Number(r.value) > 0 &&
        Number(r.value) <= 10 &&
        exact(a, [
          'setting',
          'activity',
          'device',
          'calibration',
          'method',
          'qualification',
          'supervision',
        ]) &&
        a.setting === r.gravity &&
        a.activity === 'peak-cycle-gas-analysis' &&
        a.device === 'fictional-gas-analyser-02' &&
        a.method === 'recorded-peak-oxygen-uptake' &&
        text(a.calibration, 100) &&
        a.qualification === 'fictional-qualified-exercise-operator' &&
        a.supervision === 'fictional-medical-supervision-declared',
      'Invalid absolute peak oxygen uptake acquisition.',
    );
  } else if (r.measurement === 'reported-sleep-duration') {
    requireValid(
      r.unit === 'h' &&
        Number(r.value) <= 24 &&
        exact(a, [
          'setting',
          'activity',
          'device',
          'periodStart',
          'periodEnd',
          'reporting',
          'method',
        ]) &&
        a.setting === r.gravity &&
        a.activity === 'crew-diary' &&
        a.device === 'none-self-report' &&
        a.reporting === 'preceding-24h-total-sleep' &&
        a.method === 'fictional-diary-v2' &&
        utc(a.periodStart) &&
        utc(a.periodEnd) &&
        Date.parse(a.periodEnd) - Date.parse(a.periodStart) === 86400000 &&
        a.periodEnd <= String(r.timestamp) &&
        a.periodEnd <= context.fictionalNow,
      'Invalid equivalent sleep reporting period.',
    );
  } else {
    requireValid(
      r.measurement === 'preflight-exercise-hr' &&
        r.unit === 'bpm' &&
        r.gravity === 'earth-1g' &&
        exact(a, ['setting', 'activity', 'device', 'workloadWatts', 'timing']) &&
        a.setting === 'earth-1g' &&
        a.activity === 'cycling-exercise' &&
        a.workloadWatts === 100 &&
        a.device === 'fictional-ground-hr-monitor-01' &&
        a.timing === 'final-minute-of-recorded-session',
      'Unsupported descriptive measurement.',
    );
  }
}
export function descriptiveRecords(): DescriptiveObservation[] {
  const rows: DescriptiveObservation[] = [];
  for (const phase of ['preflight', 'transit'] as const)
    for (const [i, day] of (phase === 'preflight'
      ? ['2039-12-16']
      : ['2040-06-14', '2040-06-27']
    ).entries()) {
      const gravity: import('./context').Gravity =
        phase === 'preflight' ? 'earth-1g' : 'microgravity';
      for (const measurement of ['vo2peak', 'reported-sleep-duration'] as const) {
        const stamp = day + 'T10:00:00Z';
        const common: import('./observations').RecordEnvelope = {
          id: `${richRevision}-${measurement}-${day}`,
          missionId: 'DEMO-MARS-01',
          subjectId: 'FICTIONAL-01',
          origin: 'fictional-individual' as const,
          clock: 'fictional-mission-utc' as const,
          timestamp: stamp,
          missionPhase: phase,
          gravity,
          comparisonRole: i ? ('followup' as const) : ('baseline' as const),
          session: `${measurement}-${day}`,
          protocol: `${measurement}-fictional-v2`,
          window: `${phase}-${measurement}-v2`,
          form: 'direct' as const,
          derivedFrom: [],
          quality: { state: 'declared-good' as const, flags: [] },
          provenance: {
            sourceId: `${richRevision}-${measurement}`,
            sourceRecord: `v2/${day}/original`,
            fixtureRevision,
          },
        };
        if (measurement === 'vo2peak')
          rows.push({
            ...common,
            measurement,
            value: phase === 'preflight' ? 3.0 : i ? 2.7 : 2.8,
            unit: 'L/min',
            acquisition: {
              setting: gravity,
              activity: 'peak-cycle-gas-analysis',
              device: 'fictional-gas-analyser-02',
              calibration: 'fictional-two-point-gas-and-volume-check-declared',
              method: 'recorded-peak-oxygen-uptake',
              qualification: 'fictional-qualified-exercise-operator',
              supervision: 'fictional-medical-supervision-declared',
            },
          });
        else
          rows.push({
            ...common,
            measurement,
            value: i ? 6.5 : 7.5,
            unit: 'h',
            acquisition: {
              setting: gravity,
              activity: 'crew-diary',
              device: 'none-self-report',
              periodStart: new Date(Date.parse(stamp) - 86400000).toISOString().replace('.000', ''),
              periodEnd: stamp,
              reporting: 'preceding-24h-total-sleep',
              method: 'fictional-diary-v2',
            },
          });
      }
    }
  const base = rows[0];
  rows.push({
    ...base,
    id: `${richRevision}-preflight-hr`,
    measurement: 'preflight-exercise-hr',
    value: 120,
    unit: 'bpm',
    protocol: 'preflight-exercise-hr-fictional-v2',
    session: 'preflight-cycle-20391216',
    window: 'preflight-cycle-v2',
    provenance: {
      ...base.provenance,
      sourceId: 'fictional-preflight-cycle-v2',
      sourceRecord: 'v2/20391216/final-minute',
    },
    acquisition: {
      setting: 'earth-1g',
      activity: 'cycling-exercise',
      device: 'fictional-ground-hr-monitor-01',
      workloadWatts: 100,
      timing: 'final-minute-of-recorded-session',
    },
  });
  return rows;
}
export const allMissionObservations = (): FictionalObservation[] => [
  ...missionObservations(),
  ...descriptiveRecords(),
];
export const isRich = (ids: string[]) => ids.some((id) => id.startsWith(richRevision));
/** Deliberately separate from the protected legacy engine. Exact acquisition matching only. */
export function descriptiveComparisons(
  records: FictionalObservation[],
  context: MissionContext,
  excluded: string[] = [],
) {
  const valid = validateObservations(records, context).filter((r) => !excluded.includes(r.id));
  return (['vo2peak', 'reported-sleep-duration'] as const).map((measurement) => {
    const pair = valid.filter(
      (r) =>
        r.measurement === measurement &&
        r.gravity === context.gravity &&
        r.missionPhase === 'transit',
    ) as DescriptiveObservation[];
    const early = pair.find((r) => r.comparisonRole === 'baseline');
    const late = pair.find((r) => r.comparisonRole === 'followup');
    const conditions = (r: DescriptiveObservation) => {
      const a = { ...r.acquisition } as Record<string, unknown>;
      delete a.periodStart;
      delete a.periodEnd;
      return JSON.stringify(a);
    };
    const supported =
      pair.length === 2 &&
      !!early &&
      !!late &&
      early.session !== late.session &&
      early.timestamp < late.timestamp &&
      early.protocol === late.protocol &&
      early.window === late.window &&
      early.unit === late.unit &&
      early.quality.state === 'declared-good' &&
      late.quality.state === 'declared-good' &&
      !early.quality.flags.length &&
      !late.quality.flags.length &&
      conditions(early) === conditions(late);
    return {
      measurement,
      early,
      late,
      supported,
      difference: supported ? Math.round((late.value - early.value) * 1000) / 1000 : null,
    };
  });
}
