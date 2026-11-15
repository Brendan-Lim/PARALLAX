import type { CasePacket, Measure } from './model';

export const missionPhases = {
  preflight: {
    label: 'Preflight',
    explanation:
      'Compatible reference observations support later comparisons. Existing ground assessments remain specific to their recorded protocols.',
  },
  inflight: {
    label: 'In-flight microgravity',
    explanation:
      'Review available physiological records. Earth-based posture, walking and balance protocols are not automatically obtainable or transferable in microgravity.',
  },
  transition: {
    label: 'Gravity transition',
    explanation:
      'Cardiovascular, muscular and sensorimotor adaptation can affect different capabilities. Missing functional records remain important unanswered questions.',
  },
  surface: {
    label: 'Post-landing / surface',
    explanation:
      'Review existing authorised functional assessments when available. Earth-based results do not establish performance in lunar or Martian gravity.',
  },
  analog: {
    label: 'Bed-rest research analog',
    explanation:
      'Bed rest models selected effects of unloading on Earth. These records are analog demonstrations, never measurements obtained from an astronaut in space.',
  },
} as const;
export type MissionPhase = keyof typeof missionPhases;
export const isMissionPhase = (x: unknown): x is MissionPhase =>
  typeof x === 'string' && Object.hasOwn(missionPhases, x);

export function missionContext(packet: CasePacket, selected: MissionPhase) {
  const analog = packet.context?.kind === 'bed-rest-analog';
  const effective = analog ? 'analog' : selected;
  return {
    phase: effective,
    label: missionPhases[effective].label,
    explanation: missionPhases[effective].explanation,
    acquisition:
      packet.context?.acquisition ??
      'Acquisition setting unspecified in the imported demonstration; do not infer spaceflight.',
    identity: analog
      ? 'Synthetic bed-rest analog'
      : packet.context?.kind === 'mission-demo'
        ? 'Synthetic mission example · ground assessment records'
        : packet.context?.kind === 'inflight-demo'
          ? 'Synthetic in-flight example · fictional microgravity records'
          : 'Synthetic example · setting unspecified',
    boundary:
      analog && selected !== 'analog'
        ? 'The selected review phase does not reclassify this bed-rest analog as spaceflight.'
        : 'Review context changes explanations, never record origin, protocol or evidence support.',
  };
}
export function feasibility(packet: CasePacket, phase: MissionPhase, measure: Measure): string {
  const effective = missionContext(packet, phase).phase;
  if (effective === 'inflight' && ['cardio', 'tandem', 'task'].includes(measure))
    return 'Existing ground result only: this Earth-based posture or locomotor protocol is not an in-flight microgravity assessment. Do not perform it from this app.';
  if (measure === 'force')
    return 'Requires compatible instrumented resistance equipment and an authorised protocol. Review existing results; this app gives no testing instructions.';
  if (measure === 'hr' || measure === 'map')
    return 'Requires a suitable validated device and documented acquisition conditions. A reading does not establish aerobic capacity or a diagnosis.';
  if (effective === 'analog')
    return 'Earth-based analog protocol with study equipment and qualified supervision. No inference to spaceflight or another gravity field.';
  return 'Review only an already obtained authorised assessment with its gravity, equipment and supervision documented. Do not start standing, balance or mobility testing from this app.';
}

/** Action applicability does not change evidence support or record origin. */
export function actionApplicability(packet: CasePacket, phase: MissionPhase, measure: Measure) {
  const flight = packet.context?.kind === 'inflight-demo';
  const inFlightReview = missionContext(packet, phase).phase === 'inflight';
  if ((flight || inFlightReview) && ['cardio', 'tandem', 'task'].includes(measure))
    return {
      state:
        flight && measure === 'task'
          ? 'Relevant future assessment not yet available'
          : 'Measurement outside the selected operational context',
      explanation:
        'This Earth-based posture or locomotor assessment is not a routine microgravity measurement. Its outcome remains unknown. Preserve the question for a future authorised gravity-transition assessment; do not perform a ground test aboard a spacecraft from this app.',
      actionable: false,
    };
  if (flight && measure === 'force' && !packet.observations.some((r) => r.measurement === measure))
    return {
      state: 'Outside current validated scope',
      explanation:
        'This cycling example contains no compatible instrumented force protocol. No force assessment is requested.',
      actionable: false,
    };
  return { state: 'Within recorded monitoring scope', explanation: '', actionable: true };
}
