/** Published aggregate facts only. No participant values or digitised figures. */
export const researchPublication = {
  title: 'Physiological and Functional Alterations after Spaceflight and Bed Rest',
  authors: 'Mulavara et al.',
  year: 2018,
  doi: '10.1249/MSS.0000000000001615',
  url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6133205/',
  statistic: 'Published percentage change in estimated median, pre to first post exposure',
  method:
    'Mixed-effects models used two pre sessions and the first post session; transformations and back-transformation where needed. Displayed percentages are transcribed from Discussion, not recalculated.',
  limitations:
    'Small, different cohorts; bed rest is an imperfect spaceflight analog. Group estimates do not describe each individual. These are descriptive cohort comparisons, not causal estimates of exercise benefit. Exact confidence limits for these rounded percentages are not transcribed; absence of error bars does not mean no uncertainty.',
  reuse:
    'Attributed numerical facts in original code-drawn charts. No article figures, participant records or supplements reproduced. Government-contribution notice is not a blanket licence for all coauthor content or participant redistribution.',
};
export const researchGroups = [
  {
    id: 'iss',
    label: 'ISS astronauts',
    n: 13,
    exposure: 'Long-duration ISS missions',
    timepoint: 'First postflight test, approximately one day after landing',
    context: 'Astronauts performed individual in-flight exercise; not a no-exercise control.',
  },
  {
    id: 'control',
    label: 'Bed rest · control',
    n: 10,
    exposure: '70 days, 6° head-down bed rest',
    timepoint: 'First post-bed-rest session, immediately after rising',
    context: 'Earth-based analog; no exercise countermeasure in this group.',
  },
  {
    id: 'exercise',
    label: 'Bed rest · exercise',
    n: 9,
    exposure: '70 days, 6° head-down bed rest',
    timepoint: 'First post-bed-rest session, immediately after rising',
    context:
      'Earth-based analog with SPRINT exercise; not interchangeable with the astronaut group.',
  },
] as const;
export type ResearchGroup = (typeof researchGroups)[number]['id'];
export const researchOutcomes = [
  {
    id: 'walk',
    label: 'Seat Egress and Walk',
    metric: 'Completion time',
    originalUnit: 's',
    unit: '% change in estimated median',
    domain: 'task',
    values: { iss: 31, control: 38, exercise: 23 },
    locator:
      'Discussion → Effects of Spaceflight and Bed Rest → Functional tasks, first paragraph; Figure 2A and Results/Table 2 for context',
    definition:
      'Release a chair harness, stand, then walk an obstacle course. This is a laboratory functional task, not actual spacecraft egress.',
    meaning:
      'A longer recorded group task time remained evident in the exercising bed-rest cohort. A finding about one physiological quantity cannot establish every functional outcome.',
  },
  {
    id: 'sway',
    label: 'Recovery from Fall/Stand',
    metric: 'Mean postural sway speed',
    originalUnit: 'cm/s',
    unit: '% change in estimated median',
    domain: 'tandem',
    values: { iss: 66, control: 54, exercise: 42 },
    locator:
      'Discussion → Functional tasks, paragraph beginning Recovery from Fall/Stand; Figure 2B and Results/Table 2 for context',
    definition:
      'Mean centre-of-pressure sway speed during quiet standing after rising from prone. This is not task completion time.',
    meaning:
      'Postural control is a separate measured outcome. A force observation does not replace a direct balance or functional observation.',
  },
] as const;
export type ResearchOutcome = (typeof researchOutcomes)[number]['id'];
export const associationNotes = {
  force:
    'Negative association: lower force changes accompanied longer task-time changes in this published analysis. This is not an individual prediction.',
  cardio:
    'Positive association: larger posture-related HR changes accompanied longer task-time changes. HR response is distinct from resting HR and blood pressure.',
  tandem:
    'Negative association: fewer correct tandem steps accompanied longer task-time changes. This does not diagnose a vestibular cause.',
};

/** Primary text following Table 3, verified against the rendered table. Dimensionless. */
export const researchAssociations = [
  {
    measure: 'plasma',
    label: 'Plasma volume',
    domain: 'Cardiovascular',
    d: -0.349,
    originalUnit: 'L',
    note: 'Plasma-volume changes and task-time changes varied in opposite directions.',
  },
  {
    measure: 'force',
    label: 'Lower-body maximum isometric force',
    domain: 'Muscular',
    d: -0.305,
    originalUnit: 'N',
    note: 'Lower-body force changes and task-time changes varied in opposite directions.',
  },
  {
    measure: 'power',
    label: 'Lower-body maximum power',
    domain: 'Muscular',
    d: -0.319,
    originalUnit: 'W',
    note: 'Power records the rate of mechanical work, distinct from maximum isometric force.',
  },
  {
    measure: 'work',
    label: 'Lower-body total work',
    domain: 'Muscular',
    d: -0.293,
    originalUnit: 'J',
    note: 'Total work over 21 repetitions is distinct from maximum force and power.',
  },
  {
    measure: 'posturography',
    label: 'Dynamic posturography',
    domain: 'Sensorimotor',
    d: -0.456,
    originalUnit: 'continuous equilibrium score',
    note: 'This modified sensory-organisation assessment examines balance control, not muscle strength.',
  },
  {
    measure: 'tandem',
    label: 'Tandem walk',
    domain: 'Sensorimotor',
    d: -0.428,
    originalUnit: '% correct steps',
    note: 'Tandem walking examines dynamic gait control. The relationship does not diagnose a vestibular cause.',
  },
  {
    measure: 'cardio',
    label: 'Posture-related heart-rate change',
    domain: 'Cardiovascular',
    d: 0.398,
    originalUnit: 'bpm (standing minus prone)',
    note: 'Larger posture-related HR changes accompanied longer task-time changes. This is distinct from exercise or resting HR.',
  },
] as const;
export type ResearchAssociation = (typeof researchAssociations)[number]['measure'];
export const researchAssociationMethod =
  'Somers’ D, dimensionless, for physiological and Seat Egress and Walk completion-time changes across all within-person session pairs, pooling 13 ISS astronauts, 10 bed-rest controls and 9 bed-rest exercisers. Exact analysed pair count is not established here. These seven associations meet the paper’s P < 0.003 threshold. Table 3 prints their P values as 0.000 (rounded, never exactly zero). The authors used FDR 1% thresholds of P < 0.003 for 105 association tests and P < 0.008 for 66 mixed-model pre/post tests. Values near the association threshold (0.003–0.004) have a separate marginal category. This is association, not causation, individual prediction accuracy or evidence-engine weighting.';
