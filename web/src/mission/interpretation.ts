import { richSources } from './richEvidence';
import { signed } from '../core/engine';
import { missionOverview } from './overview';
import type { MissionState } from './state';

import { currentVersions } from './identity';
export const interpretationVersion = currentVersions.interpretation;
export const sourceVersion = currentVersions.source;
export interface InterpretationSource {
  id: string;
  reference: string;
  url: string;
  locator: string;
  population: string;
  finding: string;
  boundary: string;
  consequence: string;
}
export const interpretationSources: readonly InterpretationSource[] = [
  {
    id: 'astronaut-exercise',
    reference: 'NASA, Astronaut Exercise, CEVIS equipment description',
    url: 'https://www.nasa.gov/missions/station/iss-research/astronaut-exercise/',
    locator: 'CEVIS equipment and recorded parameters',
    population: 'ISS exercise operations; equipment context.',
    finding: 'CEVIS records heart rate alongside workload and session information.',
    boundary:
      'The individual values, 100 W and final-minute comparison protocol here are fictional. Matching declarations do not validate device accuracy or physiological equivalence.',
    consequence:
      'Preserve workload, device, protocol and timing with the HR pair; do not infer its cause.',
  },
  {
    id: 'human-performance',
    reference: 'NASA-STD-3001 Volume 1, Human Performance, V1 4002/4003 and rationale',
    url: 'https://www.nasa.gov/reference/4-0-human-performance/',
    locator: '4.1.2–4.1.3; V1 4002 and V1 4003',
    population:
      'Crew programmes, including missions with extraterrestrial surface EVAs; rationale uses historical, analog and terrestrial evidence.',
    finding:
      'Aerobic capacity is relevant to sustained physical work. NASA specifies method-dependent in-mission aerobic-capacity requirements for surface-EVA missions.',
    boundary:
      'Published programme requirements cannot be evaluated from HR at one workload or establish this individual’s Mars performance.',
    consequence:
      'Retain the missing aerobic-capacity assessment; make no VO2max estimate or clearance inference.',
  },
  {
    id: 'mulavara2018',
    reference:
      'Mulavara et al. (2018), Physiological and Functional Alterations after Spaceflight and Bed Rest. Med Sci Sports Exerc 50(9):1961–1980. DOI 10.1249/MSS.0000000000001615',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6133205/',
    locator: 'Methods; Results Tables 2–3; Discussion',
    population:
      '13 ISS astronauts, 10 bed-rest controls and 9 bed-rest exercisers; Earth assessments. These are cohort counts, not exact association-pair counts.',
    finding:
      'Lower-body force and functional tasks are distinct endpoints. Functional and balance deficits remained in bed-rest exercisers despite no significant reduction in selected neuromuscular measures.',
    boundary:
      'Nonsignificance does not establish equivalence. Pooled associations are neither causal weights nor individual predictions; bed rest and Earth return do not establish Mars outcomes.',
    consequence:
      'A force reference cannot resolve mobility or a current force change; retain separate assessment questions.',
  },
  {
    id: 'clement2022',
    reference:
      'Clément et al. (2022), Mission-critical tasks for assessing risks from vestibular and sensorimotor adaptation during space exploration. Front Physiol 13:1029161. DOI 10.3389/fphys.2022.1029161',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9733831/',
    locator: 'Methods/Subjects; Results; Discussion',
    population:
      '19 astronauts returning to Earth after 6–8 months on ISS; walk-and-turn subgroup n=7; testing at 1 g.',
    finding:
      'Researchers observed slower stabilisation after standing and poorer balance/locomotor performance after landing; recovery differed by endpoint.',
    boundary:
      'Small Earth-return groups cannot predict this astronaut’s Mars outcome or validate a 0.38 g protocol. No individual post-landing measurement is supplied here.',
    consequence:
      'Keep post-landing function prominent and unresolved; offer no unsupervised physical test.',
  },
  ...richSources.map((s) => ({
    id: s.id,
    reference: s.label,
    url: s.url,
    locator: s.label,
    population: 'Published research context only; individual demo records are fictional.',
    finding: s.boundary,
    boundary: s.boundary,
    consequence: 'Preserve separate endpoints, acquisition declarations and descriptive limits.',
  })),
];
export type WatchId = 'sleep' | 'cardiovascular' | 'musculoskeletal' | 'functional' | 'aerobic';
export type EvidenceStatus =
  'supported' | 'missing' | 'excluded' | 'incompatible' | 'unresolved' | 'historical-reference';
export type ReviewOrder =
  'activity-requirement-unresolved' | 'interpretation-available' | 'information-candidate';
export const reviewOrderLabels: Record<ReviewOrder, string> = {
  'activity-requirement-unresolved': 'Upcoming activity requirement unresolved',
  'interpretation-available': 'Observation interpretation available',
  'information-candidate': 'Additional information or monitoring candidate',
};
export interface HealthInterpretation {
  id: WatchId;
  domain: string;
  requirement: string;
  recordedObservation: string;
  evidenceStatus: EvidenceStatus;
  meaning: string;
  scientificRelevance: string;
  sourceIds: string[];
  missionRelevance: string;
  limitation: string;
  reviewAction: string;
  unresolvedInformation: string;
  monitoringRelationship: string;
  potentialSource: string;
  monitoringLimitation: string;
  priority: ReviewOrder;
  priorityReason: string;
  concernBasis: 'unresolved-capability' | 'recorded-difference' | 'information-gap';
}

/** Fixed source-linked templates, applied only to the actual evaluator projection. */
export function healthInterpretations(
  state: MissionState,
  model = missionOverview(state),
): HealthInterpretation[] {
  const c = model.exerciseComparison;
  const exercise = model.requirements.find((r) => r.id === 'exercise')!;
  const status: EvidenceStatus = c
    ? 'supported'
    : !model.exerciseApplicable
      ? 'incompatible'
      : exercise.state === 'excluded-records'
        ? 'excluded'
        : model.exercise.status === 'unresolved'
          ? 'unresolved'
          : 'missing';
  const activity = state.context.nextActivity.label;
  const findings: HealthInterpretation[] = [
    {
      id: 'functional',
      domain: 'Post-landing functional capability',
      requirement: 'Post-landing balance and mobility',
      recordedObservation:
        'No post-landing standing, balance or mobility measurement is available.',
      evidenceStatus: state.context.gravity === 'microgravity' ? 'incompatible' : 'unresolved',
      meaning: 'How you will stand, balance and move after landing remains unknown.',
      scientificRelevance: interpretationSources[3].finding,
      sourceIds: ['clement2022', 'mulavara2018'],
      missionRelevance: `${activity} brings a gravitational transition or surface activity into review. Standing, balance and movement matter for the later lander-to-habitat transfer.`,
      limitation:
        'The crew’s microgravity observations cannot establish the required post-landing functional outcome. General gravity-transition hazards and group findings do not demonstrate impairment in this fictional astronaut or predict Mars performance.',
      reviewAction:
        'Retain the functional question for qualified task-specific review; establish an applicable protocol, equipment, environment and supervision before any assessment.',
      unresolvedInformation:
        'Individual functional outcome and an applicable Mars assessment protocol remain unresolved. This stays visible outside the approach coverage count.',
      monitoringRelationship:
        'Future task-specific assessment could inform this question. Activity counts, heart rate and force alone cannot establish functional mobility.',
      potentialSource:
        'A mission-approved, supervised functional assessment; no applicable Mars protocol is established here.',
      monitoringLimitation:
        'No physical test is enabled. Wearable activity is context, not a validated functional outcome.',
      priority: 'activity-requirement-unresolved',
      priorityReason:
        'First because the upcoming gravity transition leaves post-landing function unanswered; this is an operational information gap, not an observed individual impairment.',
      concernBasis: 'unresolved-capability',
    },
    {
      id: 'aerobic',
      domain: 'Aerobic capacity',
      requirement: 'Aerobic-capacity evidence',
      recordedObservation:
        'No suitable aerobic-capacity assessment result or validated VO2max estimate is available.',
      evidenceStatus: 'missing',
      meaning: 'The supplied observations cannot establish aerobic capacity.',
      scientificRelevance: interpretationSources[1].finding,
      sourceIds: ['human-performance'],
      missionRelevance: `For planning after ${activity}, demanding surface work requires separate aerobic-capacity information. Published surface-EVA requirements are context for later activity review.`,
      limitation:
        'No capacity threshold can be applied to heart rate at one workload. No fitness, personal performance or clearance conclusion follows.',
      reviewAction:
        'Request an appropriate authorised aerobic-capacity result and confirm programme, method and activity applicability with qualified reviewers.',
      unresolvedInformation:
        'Suitable method, assessment result and applicable mission policy are missing.',
      monitoringRelationship:
        'An authorised capacity assessment could supply the missing endpoint; a heart-rate channel can supply review context only.',
      potentialSource:
        'Qualified assessment team and an authorised aerobic-capacity system; not available in this scenario.',
      monitoringLimitation: 'No HR-to-VO2max conversion or threshold substitution.',
      priority: 'activity-requirement-unresolved',
      priorityReason:
        'An explicit approach information requirement lacks a suitable result. It follows the unresolved post-landing functional question.',
      concernBasis: 'information-gap',
    },
    {
      id: 'cardiovascular',
      domain: 'Cardiovascular response',
      requirement: 'Recorded exercise response',
      recordedObservation: c
        ? `15 June 2040: ${c.baseline.value} bpm; 28 June 2040: ${c.followup.value} bpm; ${signed(c.absolute)} ${c.changeUnit} at 100 W.`
        : 'No supported exercise change is available in the current selection and mission context.',
      evidenceStatus: status,
      meaning: c
        ? 'Heart rate was higher in the later recorded exercise session. Both fictional sessions declare the same workload, monitor, protocol and final-minute acquisition conditions.'
        : status === 'excluded'
          ? 'The follow-up is excluded; its numerical comparison is withheld.'
          : status === 'incompatible'
            ? 'Historical transit sessions cannot provide a current assessment in this environment.'
            : 'A compatible included follow-up is needed to describe an exercise change.',
      scientificRelevance:
        'Cardiovascular adaptation and exercise response are relevant to physical performance. NASA describes heart rate alongside workload in exercise records; aerobic capacity remains a separate endpoint.',
      sourceIds: ['astronaut-exercise', 'human-performance'],
      missionRelevance: `Preserve exercise-response context for qualified review when planning physical activities after ${activity}.`,
      limitation:
        'The cause of any difference is unknown. These records establish neither deteriorated fitness, disease, danger, a VO2max change nor suitability for landing or surface work. No intervention or exercise adjustment follows.',
      reviewAction: c
        ? 'Preserve this pair with its acquisition conditions and other relevant measurements for qualified review.'
        : 'Resolve record availability, exclusion or compatibility before interpreting an exercise difference.',
      unresolvedInformation:
        'Current cardiovascular status, physiological cause and clinical significance are not established.',
      monitoringRelationship:
        'Future heart-rate observations with activity, timestamps and quality could add review context if a fictional reviewer designates them.',
      potentialSource:
        'Existing fictional exercise archive; separate Level 1 synthetic commercial Astroskin HR/quality adapter.',
      monitoringLimitation:
        'Future device readings are separate from this paired exercise assessment. The recorded difference is not an alarm threshold.',
      priority: c ? 'interpretation-available' : 'information-candidate',
      priorityReason: c
        ? 'A narrow recorded comparison can now be interpreted, after the unresolved activity requirements.'
        : 'Resolve the evidence question or consider future monitoring; no numerical concern is inferred.',
      concernBasis: c ? 'recorded-difference' : 'information-gap',
    },
    {
      id: 'musculoskeletal',
      domain: 'Musculoskeletal performance',
      requirement: 'Compatible lower-body force follow-up',
      recordedObservation: state.excludedRecordIds.includes('mars-force-preflight')
        ? 'The historical force reference is excluded. No compatible follow-up is available.'
        : '15 December 2039: 1,000 N leg-press isometric force on Earth at 1 g; no compatible follow-up.',
      evidenceStatus: state.excludedRecordIds.includes('mars-force-preflight')
        ? 'excluded'
        : 'historical-reference',
      meaning:
        'The original force value describes one preflight lower-body measurement. Current muscular force and its change remain unknown.',
      scientificRelevance: interpretationSources[2].finding,
      sourceIds: ['mulavara2018'],
      missionRelevance: `Lower-body force contributes to physical activity after ${activity}; the later transfer also requires balance and coordination.`,
      limitation:
        'A historical force reference is not a current strength assessment. Force alone cannot establish functional mobility, and group associations cannot predict this individual’s outcome.',
      reviewAction:
        'Preserve the original reference and request a compatible, appropriately supervised follow-up if relevant to the qualified review.',
      unresolvedInformation:
        'A compatible lower-body force result is missing; no current change can be calculated.',
      monitoringRelationship:
        'A compatible assessment could establish a force comparison. Grip, activity counts and cardiovascular readings cannot substitute.',
      potentialSource:
        'Compatible instrumented force assessment with the source protocol and qualified supervision; no current result supplied.',
      monitoringLimitation: 'No force self-test or wearable-derived strength estimate is offered.',
      priority: 'information-candidate',
      priorityReason:
        'Additional compatible information is needed; the 1,000 N reference is not ranked as a present medical concern.',
      concernBasis: 'information-gap',
    },
  ];
  if (!model.rich) return findings;
  for (const c of model.descriptive) {
    const id = c.measurement === 'vo2peak' ? 'aerobic' : 'sleep';
    const template = { ...findings.find((f) => f.id === 'aerobic')! };
    const source = richSources[id === 'aerobic' ? 0 : 1];
    const updated: HealthInterpretation = {
      ...template,
      id,
      domain: id === 'aerobic' ? 'Measured aerobic observation' : 'Reported sleep',
      requirement: id === 'aerobic' ? 'Absolute peak oxygen uptake' : 'Reported sleep duration',
      recordedObservation: c.supported
        ? `${c.early!.value} → ${c.late!.value} ${c.early!.unit}; difference ${c.difference} ${c.early!.unit}.`
        : 'No compatible included descriptive pair.',
      evidenceStatus: c.supported ? 'supported' : 'unresolved',
      meaning: !c.supported
        ? 'No compatible included pair supports a descriptive difference.'
        : id === 'aerobic'
          ? 'The later fictional gas-analysis record has lower recorded absolute peak oxygen uptake.'
          : 'The later fictional diary reports one hour less sleep over an equivalent 24-hour reporting period.',
      scientificRelevance: source.boundary,
      sourceIds: [source.id],
      limitation:
        source.boundary +
        ' No clinical significance, diagnosis, VO₂max plateau, relative oxygen uptake or readiness conclusion follows.',
      reviewAction:
        'Inspect the original records and acquisition declarations with qualified reviewers.',
      unresolvedInformation:
        'Cause, clinical significance and surface applicability remain unestablished.',
      potentialSource: 'Previously collected fictional records in this review.',
      monitoringRelationship:
        'Previously recorded assessments supply this endpoint. Synthetic HR replay remains a separate source.',
      monitoringLimitation: 'No conversion from wearable HR to oxygen uptake, sleep or fatigue.',
      missionRelevance:
        'Preserve this recorded context for qualified review; it does not establish surface capability.',
      priority: c.supported ? 'interpretation-available' : 'information-candidate',
      priorityReason: 'Available observations precede unresolved questions.',
      concernBasis: c.supported ? 'recorded-difference' : 'information-gap',
    };
    const index = findings.findIndex((f) => f.id === id);
    if (index >= 0) findings[index] = updated;
    else findings.push(updated);
  }
  return findings.sort(
    (a, b) => Number(b.evidenceStatus === 'supported') - Number(a.evidenceStatus === 'supported'),
  );
}
