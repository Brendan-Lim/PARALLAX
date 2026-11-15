import {
  trackedMeasures,
  measures,
  type CasePacket,
  type Comparison,
  type Finding,
  type Measure,
} from './model';

export const formatNumber = (n: number) => {
  const absolute = Math.abs(n);
  if (absolute > 0 && (absolute < 0.001 || absolute >= 1e9)) return n.toExponential(3);
  return new Intl.NumberFormat('en', { maximumFractionDigits: absolute < 1 ? 4 : 2 }).format(
    Object.is(n, -0) ? 0 : n,
  );
};
export const signed = (n: number) =>
  `${n > 0 ? '+' : n < 0 ? '−' : ''}${formatNumber(Math.abs(n))}`;

export function evaluateMeasure(
  packet: CasePacket,
  measurement: Measure,
  unavailable: readonly string[] = [],
): Finding {
  const spec = measures[measurement];
  const all = packet.observations.filter((r) => r.measurement === measurement);
  const hidden = new Set(unavailable);
  const active = all.filter((r) => !hidden.has(r.id));
  const direct = active.filter((r) => r.form === 'direct');
  const base = direct.filter((r) => r.phase === 'baseline');
  const post = direct.filter((r) => r.phase === 'followup');
  const result: Finding = {
    id: measurement,
    title: `Recorded ${measurement === 'task' ? 'task completion time' : measurement === 'force' ? 'muscular force' : measurement === 'tandem' ? 'tandem correct steps' : measurement === 'cardio' ? 'posture HR response' : measurement === 'hr' ? 'heart rate' : spec.detail.toLowerCase()} change`,
    status: 'insufficient',
    explanation: '',
    evidence: direct,
    excluded: active.filter((r) => r.form === 'derived'),
    unavailable: all.filter((r) => hidden.has(r.id)),
    requirements: [],
    issues: [],
    limitations: [
      'A numerical difference alone does not establish clinical significance, overall function or medical clearance.',
      'Synthetic demonstration observations; not NASA participant measurements.',
    ],
    contextIds: [spec.source, 'study'],
  };
  const issues = direct.flatMap((r) => r.issues.map((issue) => `${r.id}: ${issue}`));
  if (
    direct.some(
      (r) =>
        r.caseId !== packet.case.id ||
        r.origin !== 'synthetic' ||
        r.unit !== spec.unit ||
        !Number.isFinite(r.value) ||
        (measurement !== 'cardio' && r.value < 0) ||
        (measurement === 'tandem' && r.value > 100),
    )
  )
    issues.push(
      'Invalid observation or incompatible case/unit. Re-import a validated demonstration packet.',
    );
  if (base.length > 1 || post.length > 1)
    issues.push(
      'Multiple direct candidates for a phase. No implicit selection or averaging is performed.',
    );
  const provenance = direct.map((r) => `${r.sourceId}\u0000${r.sourceRecord}`);
  if (new Set(provenance).size !== provenance.length)
    issues.push('Repeated source record references do not provide independent evidence.');
  if (!base.length) result.requirements.push('A direct baseline observation');
  if (!post.length) result.requirements.push('A direct follow-up observation');
  if (issues.length) {
    result.status = 'unresolved';
    result.issues = issues;
    result.explanation =
      'Source or compatibility issues prevent a supported comparison. Inspect the records before interpreting a change.';
    return result;
  }
  if (!base.length || !post.length) {
    result.explanation = `${result.requirements.join(' and ')} ${result.requirements.length > 1 ? 'are' : 'is'} unavailable. ${measurement === 'task' ? 'Physiological measurements and published associations cannot establish this missing task outcome.' : 'Other domains cannot replace the missing measurement.'}`;
    if (result.excluded.length)
      result.issues.push(
        'Derived records are present but are not independent direct observations.',
      );
    return result;
  }
  const b = base[0];
  const p = post[0];
  for (const [key, label] of [
    ['protocol', 'measurement protocol'],
    ['window', 'comparison window'],
    ['sourceId', 'source identity'],
  ] as const) {
    if (b[key] !== p[key])
      result.issues.push(`The baseline and follow-up have incompatible ${label}.`);
  }
  if (
    b.acquisition ||
    p.acquisition ||
    (packet.context?.kind === 'inflight-demo' && measurement === 'hr')
  ) {
    if (!b.acquisition || !p.acquisition)
      result.issues.push('Acquisition conditions are missing for one or both exercise readings.');
    else
      for (const key of ['setting', 'activity', 'workloadWatts', 'timing', 'device'] as const)
        if (b.acquisition[key] !== p.acquisition[key])
          result.issues.push(
            key === 'workloadWatts'
              ? `The recorded workloads differ: ${formatNumber(b.acquisition.workloadWatts)} W and ${formatNumber(p.acquisition.workloadWatts)} W. Verify the source before comparing heart rates.`
              : `The recorded ${key === 'setting' ? 'acquisition settings' : key === 'activity' ? 'activities' : key === 'timing' ? 'measurement timings' : 'devices'} differ: ${b.acquisition[key]} and ${p.acquisition[key]}. Verify the source conditions before comparing heart rates.`,
          );
    result.limitations.push(
      'Declared matching metadata supports only this fictional comparison. Labels and workload alone do not validate device accuracy, physiological equivalence or a scientific monitoring protocol. Exercise HR is distinct from resting HR, posture-related HR difference and directly assessed aerobic capacity.',
    );
  }
  if (b.session === p.session)
    result.issues.push('Baseline and follow-up cannot be the same observation session.');
  if ([b, p].some((r) => r.timestamp !== null && !Number.isFinite(Date.parse(r.timestamp))))
    result.issues.push('A source timestamp is invalid.');
  if (b.timestamp && p.timestamp && Date.parse(p.timestamp) <= Date.parse(b.timestamp))
    result.issues.push(
      'The follow-up timestamp is not later than baseline; source timing is unresolved.',
    );
  if (result.issues.length) {
    result.status = 'unresolved';
    result.explanation =
      'The observations cannot establish a compatible baseline-to-follow-up change. No values or timestamps have been repaired.';
    return result;
  }
  const absolute = p.value - b.value;
  const relative = spec.relative && b.value > 0 ? (absolute / b.value) * 100 : null;
  if (!Number.isFinite(absolute) || (relative !== null && !Number.isFinite(relative))) {
    result.status = 'unresolved';
    result.issues.push('Arithmetic exceeds the supported numeric range.');
    result.explanation = 'A finite comparison cannot be calculated from these values.';
    return result;
  }
  const comparison: Comparison = {
    baseline: b,
    followup: p,
    absolute,
    relative,
    changeUnit: spec.unit === '%' ? 'percentage points' : spec.unit,
    direction: absolute > 0 ? 'increased' : absolute < 0 ? 'decreased' : 'unchanged',
  };
  result.status = 'supported';
  result.comparison = comparison;
  result.explanation =
    absolute === 0
      ? 'The two recorded values are equal. This is not evidence of clinical equivalence.'
      : `The recorded ${measurement === 'task' ? 'completion time' : measurement === 'hr' ? 'heart rate' : spec.detail.toLowerCase()} ${comparison.direction} by ${formatNumber(Math.abs(absolute))} ${comparison.changeUnit}${measurement === 'task' ? (absolute > 0 ? '; this demonstration task took longer.' : '; this demonstration task took less time.') : '.'}`;
  if (!b.timestamp || !p.timestamp)
    result.limitations.push(
      'Exact acquisition time is unknown. This is a nominal comparison using explicit session roles, not verified calendar timing.',
    );
  if (spec.relative && b.value === 0)
    result.limitations.push('Relative change is undefined because the recorded baseline is zero.');
  if (result.excluded.length)
    result.limitations.push(
      'Derived observations are retained for provenance and do not increase independent evidence.',
    );
  return result;
}

export function evaluate(packet: CasePacket, unavailable: readonly string[] = []): Finding[] {
  const findings = trackedMeasures(packet).map((key) => evaluateMeasure(packet, key, unavailable));
  findings.push(
    {
      id: 'overall',
      title: 'Overall functional capability is preserved',
      status: 'outside',
      explanation:
        'Selected physiological and task observations cannot establish preservation of every functional capability. This prototype has no validated rule for that conclusion.',
      evidence: [],
      excluded: [],
      unavailable: [],
      requirements: ['A validated, capability-specific assessment beyond this prototype'],
      issues: [],
      contextIds: ['egress', 'sensorimotor'],
      limitations: [
        'More observed domains do not turn a narrow recorded change into a general functional assessment.',
      ],
    },
    {
      id: 'clearance',
      title: 'Medically cleared for EVA',
      status: 'outside',
      explanation:
        'Medical clearance requires qualified clinical and operational assessment. No set of demonstration observations can unlock this conclusion.',
      evidence: [],
      excluded: [],
      unavailable: [],
      requirements: ['Qualified medical and operational assessment'],
      issues: [],
      contextIds: ['fitness'],
      limitations: ['PARALLAX is not a clinical decision authority or readiness classifier.'],
    },
  );
  return findings;
}

export function comparisonSummary(finding: Finding): string {
  const c = finding.comparison;
  if (!c) return finding.status === 'unresolved' ? 'Comparison withheld' : 'unknown';
  if (c.relative !== null) return signed(c.relative) + '%';
  return `${signed(c.absolute)} ${c.changeUnit}${measures[finding.id as Measure].relative && c.baseline.value === 0 ? ' (relative % undefined: zero baseline)' : ''}`;
}
