export interface ScientificSource {
  id: string;
  title: string;
  publisher: string;
  url: string;
  locator: string;
  kind: 'NASA scientific context' | 'Published aggregate research';
  statement: string;
  boundary: string;
}
export const sources: ScientificSource[] = [
  {
    id: 'exercise',
    title: 'Exercise Physiology and Countermeasures',
    publisher: 'NASA Human Health and Performance',
    url: 'https://www.nasa.gov/directorates/esdmd/hhp/exercise-physiology-and-countermeasures/',
    locator: 'Staying Fit in Microgravity; Key Areas of Research',
    kind: 'NASA scientific context',
    statement:
      'NASA develops exercise hardware and protocols to address muscle, bone and cardiovascular deconditioning and support mission task performance.',
    boundary: 'Education about countermeasures is not an individual exercise prescription.',
  },
  {
    id: 'exercise-overview',
    title: 'Exercise Overview · OCHMO-TB-031',
    publisher: 'NASA Office of the Chief Health and Medical Officer',
    url: 'https://www.nasa.gov/ochmo-tb-031-exercise-overview-2/',
    locator: 'Background; Health Technical Requirements',
    kind: 'NASA scientific context',
    statement:
      'NASA connects exercise countermeasures to health maintenance and postflight recovery of aerobic capacity and strength.',
    boundary:
      'Existing mission prescriptions require qualified oversight. This prototype assigns no intensity, duration or treatment.',
  },
  {
    id: 'performance',
    title: '4.0 Human Performance',
    publisher: 'NASA Human-Systems Standards',
    url: 'https://www.nasa.gov/reference/4-0-human-performance/',
    locator: '4.1 Aerobic Capacity; 4.2 Sensorimotor; 4.6 Muscle Strength',
    kind: 'NASA scientific context',
    statement:
      'NASA distinguishes aerobic capacity, sensorimotor capabilities and muscular strength within mission health requirements.',
    boundary:
      'The prototype does not apply these operational standards as individual thresholds or certify fitness for duty.',
  },
  {
    id: 'sensorimotor-detail',
    title: 'Sensorimotor Risk',
    publisher: 'NASA Human Health and Performance',
    url: 'https://www.nasa.gov/directorates/esdmd/hhp/sensorimotor-risk/',
    locator: 'Risk description',
    kind: 'NASA scientific context',
    statement:
      'Altered gravity can affect postural control, locomotion and fine motor function, particularly around gravity transitions.',
    boundary:
      'Review an authorised assessment; do not initiate unsupervised standing or balance tests from this app.',
  },
  {
    id: 'aerobic',
    title: 'Aerobic Risk',
    publisher: 'NASA Human Health and Performance',
    url: 'https://www.nasa.gov/directorates/esdmd/hhp/aerobic-risk/',
    locator: 'Risk description',
    kind: 'NASA scientific context',
    statement:
      'NASA relates reduced aerobic capacity to task performance and considers the capabilities of exercise countermeasure systems for exploration.',
    boundary:
      'Neither a heart-rate observation nor recorded plan completion establishes aerobic capacity.',
  },
  {
    id: 'bed-rest',
    title: 'Overview of the NASA 70-day Bed Rest Study',
    publisher: 'Cromwell et al., 2018',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6591716/',
    locator: 'Abstract; Table 2; protocol descriptions',
    kind: 'Published aggregate research',
    statement:
      'The methods overview describes an Earth-based bed-rest campaign and separate pre-, during- and post-bed-rest measurement schedules, including functional and balance assessments.',
    boundary:
      'This overview does not report study outcomes. Its laboratory schedule is not an astronaut monitoring prescription.',
  },
  {
    id: 'ongoing',
    title: 'Ongoing HRP Research',
    publisher: 'NASA Human Research Program',
    url: 'https://www.nasa.gov/hrp/ongoing-hrp-research/',
    locator: 'Research summaries',
    kind: 'NASA scientific context',
    statement:
      'NASA reports ongoing investigations into how spaceflight affects human health and performance.',
    boundary:
      'An evolving research programme motivates measurement questions, not individual medical conclusions.',
  },
  {
    id: 'hazards',
    title: 'Five Hazards of Human Spaceflight',
    publisher: 'NASA Human Research Program',
    url: 'https://www.nasa.gov/hrp/hazards/',
    locator: 'Gravity Fields; Distance from Earth',
    kind: 'NASA scientific context',
    statement:
      'Changing gravity requires adaptation across body systems. Distance from Earth can make immediate medical support harder to obtain.',
    boundary:
      'A hazard description identifies a relevant question; it does not establish an individual outcome.',
  },
  {
    id: 'cardiovascular',
    title: 'Risks of Human Spaceflight',
    publisher: 'NASA Human Research Program',
    url: 'https://www.nasa.gov/hrp/risks/',
    locator: 'Risk of Cardiovascular Adaptations',
    kind: 'NASA scientific context',
    statement:
      'NASA identifies changes in circulation and cardiovascular function in weightlessness as a research concern.',
    boundary:
      'A posture-related HR response is one recorded quantity, not a complete cardiovascular assessment.',
  },
  {
    id: 'fitness',
    title: 'Risks of Human Spaceflight',
    publisher: 'NASA Human Research Program',
    url: 'https://www.nasa.gov/hrp/risks/',
    locator: 'Risk of Reduced Cardiorespiratory and Musculoskeletal Fitness',
    kind: 'NASA scientific context',
    statement:
      'NASA studies how exercise can protect muscular and cardiorespiratory function and support task performance.',
    boundary:
      'A recorded force change cannot certify overall muscle function, task performance or medical readiness.',
  },
  {
    id: 'sensorimotor',
    title: 'Risks of Human Spaceflight',
    publisher: 'NASA Human Research Program',
    url: 'https://www.nasa.gov/hrp/risks/',
    locator: 'Risk of Altered Sensorimotor and Vestibular Function',
    kind: 'NASA scientific context',
    statement:
      'NASA identifies gait and coordination difficulties during gravity transitions as relevant to walking and operating vehicles.',
    boundary:
      'A tandem-step observation does not isolate the cause of a change or establish vestibular dysfunction.',
  },
  {
    id: 'egress',
    title: 'Risk to Vehicle Crew Egress Capability and Task Performance',
    publisher: 'NASA Human Health and Performance',
    url: 'https://www.nasa.gov/directorates/esdmd/hhp/risk-to-vehicle-crew-egress-capability-and-task-performance-as-applied-to-earth-and-extraterrestrial-landings/',
    locator: 'Crew egress risk resource',
    kind: 'NASA scientific context',
    statement:
      'NASA treats post-landing egress capability and task performance as a distinct human spaceflight risk.',
    boundary: 'The fictional task in this demonstration is not a spacecraft egress assessment.',
  },
  {
    id: 'study',
    title: 'Physiological and Functional Alterations after Spaceflight and Bed Rest',
    publisher: 'Mulavara et al., 2018 · NASA-associated research',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6133205/',
    locator: 'Methods; Table 3; relationship-mapping section',
    kind: 'Published aggregate research',
    statement:
      'The study included 13 ISS astronauts, 10 bed-rest controls and 9 bed-rest exercisers. It reported associations between physiological and functional changes across session pairs.',
    boundary:
      'Published associations are contextual, not personal prediction accuracy or a substitute for missing observations. Bed rest is an analog. No individual research records are included.',
  },
  {
    id: 'cevis',
    title: 'Astronaut Exercise',
    publisher: 'NASA ISS Research',
    url: 'https://www.nasa.gov/missions/station/iss-research/astronaut-exercise/',
    locator: 'CEVIS equipment paragraph; VO2max investigation; limitations of transfer',
    kind: 'NASA scientific context',
    statement:
      'CEVIS controls cycling workload and displays cycling speed, heart rate, elapsed time and prescription details. ARED and T2 support other exercise activities.',
    boundary:
      'Equipment feasibility does not validate PARALLAX acquisition labels or comparison protocol. No device or NASA medical-system connection is implemented.',
  },
  {
    id: 'distance',
    title: 'Hazard: Distance From Earth',
    publisher: 'NASA HRP',
    url: 'https://www.nasa.gov/hrp/hazard-distance-from-earth/',
    locator: 'Communication delays and greater crew self-reliance',
    kind: 'NASA scientific context',
    statement:
      'Distance can limit timely Earth support. Local records can help prepare a question for qualified review when connectivity is constrained.',
    boundary:
      'The local cached demonstration and export are not mission communications, clinical autonomy or successful delivery.',
  },
  {
    id: 'medical-care',
    title: 'In-Flight Medical Reference Page',
    publisher: 'NASA OCHMO',
    url: 'https://www.nasa.gov/ochmo/health-and-medical-systems/in-flight-medical-care/',
    locator: 'In-flight medical reference materials',
    kind: 'NASA scientific context',
    statement:
      'Established mission procedures and responsible qualified personnel govern assessment and treatment.',
    boundary: 'PARALLAX has no validated diagnosis, triage, treatment or emergency-care pathway.',
  },
  {
    id: 'exercise-systems',
    title: 'Exercise Countermeasures',
    publisher: 'NASA Johnson Space Center',
    url: 'https://www.nasa.gov/reference/jsc-exercise-countermeasures/',
    locator: 'On-orbit systems management; OnePortal',
    kind: 'NASA scientific context',
    statement:
      'Documents exercise equipment, physiological monitoring and NASA exercise-data systems. It grounds acquisition context for the fictional cycling example.',
    boundary: 'PARALLAX has no connection to these devices or to OnePortal.',
  },
  {
    id: 'medical-operations',
    title: '6.0 Medical Operations',
    publisher: 'NASA Human-Systems Standards',
    url: 'https://www.nasa.gov/reference/6-0-medical-operations/',
    locator: 'Medical operations requirements',
    kind: 'NASA scientific context',
    statement:
      'Establishes the role of mission medical operations and qualified oversight in reviewing crew health.',
    boundary: 'PARALLAX does not apply operational medical standards or provide medical authority.',
  },
  {
    id: 'health-care',
    title: '3.0 Health and Medical Care',
    publisher: 'NASA Human-Systems Standards',
    url: 'https://www.nasa.gov/reference/3-0-health-and-medical-care/',
    locator: 'Health and medical care requirements',
    kind: 'NASA scientific context',
    statement:
      'Places health monitoring within a broader system of crew medical care and responsible personnel.',
    boundary: 'The prototype supports evidence review, without diagnosis or treatment.',
  },
  {
    id: 'eimo',
    title: 'A Clinical Decision Support System for Earth-independent Medical Operations',
    publisher: 'NASA Ames, 2024',
    url: 'https://www.nasa.gov/centers-and-facilities/ames/ames-science/ames-space-biosciences/a-clinical-decision-support-system-for-earth-independent-medical-operations/',
    locator: 'Communication delays; ExMC research concept',
    kind: 'NASA scientific context',
    statement:
      'Explains why deep-space communication delays motivate greater onboard medical capability. PARALLAX explores local evidence review and handoff preparation within this context.',
    boundary:
      'NASA’s proposed clinical decision support system is a separate research effort. PARALLAX does not implement it.',
  },
  {
    id: 'cds-conops',
    title: 'Clinical Decision Support Concept of Operations',
    publisher: 'NASA NTRS · HRP-48033 (2021)',
    url: 'https://ntrs.nasa.gov/citations/20220017856',
    locator: 'Public report catalogue and abstract',
    kind: 'NASA scientific context',
    statement:
      'Provides research context for clinical decision support during exploration. PARALLAX retains questions for later qualified review.',
    boundary:
      'Catalogue-level context only; no clinical decision support capability or validated system integration is claimed.',
  },
];

/** Transcribed from the published text immediately following Table 3, not recomputed from participant records. */
export const publishedAssociations = [
  { label: 'Lower-body isometric force', measure: 'force', d: -0.305 },
  { label: 'Posture-related HR change', measure: 'cardio', d: 0.398 },
  { label: 'Tandem correct steps', measure: 'tandem', d: -0.428 },
] as const;
export const associationContext =
  'Somers’ D relates changes in these physiological measures to the published Seat Egress and Walk completion time across within-person session pairs. Signs indicate association direction. These are not probabilities, engine weights or coefficients for the fictional task.';
export const sourceById = (id: string) => sources.find((s) => s.id === id)!;

export const education: Record<
  string,
  { meaning: string; context: string; boundary: string; sources: string[] }
> = {
  force: {
    meaning: 'Force is the load recorded during this specific isometric leg-press protocol.',
    context:
      'Muscle loading changes in microgravity. NASA develops resistance hardware and exercise protocols to support muscular fitness and mission tasks.',
    boundary:
      'Force is not power, balance, mobility or overall physical function. Reviewing a prescribed plan does not change this boundary.',
    sources: ['exercise', 'exercise-overview'],
  },
  cardio: {
    meaning:
      'This response is a difference between posture-related heart-rate measurements, not resting heart rate.',
    context:
      'Altered gravity changes circulation and the demands of returning to upright activity. This response is one narrow cardiovascular observation.',
    boundary:
      'It does not measure aerobic capacity, diagnose orthostatic intolerance or transfer an Earth standing protocol to microgravity.',
    sources: ['cardiovascular', 'hazards', 'aerobic'],
  },
  tandem: {
    meaning: 'The percentage records correct steps during one specified tandem assessment.',
    context:
      'NASA identifies balance and coordination changes around gravity transitions as relevant to mission tasks.',
    boundary:
      'It cannot identify a cause, diagnose vestibular dysfunction or establish mobility on another surface.',
    sources: ['sensorimotor-detail', 'performance'],
  },
  task: {
    meaning: 'Elapsed seconds describe this fictional task under its recorded protocol.',
    context:
      'NASA studies functional performance because mission tasks depend on multiple physiological systems.',
    boundary:
      'The fictional task is not spacecraft egress. A faster or slower result is not medical clearance.',
    sources: ['egress', 'study'],
  },
  hr: {
    meaning:
      'Heart rate records beats per minute under the documented acquisition conditions. In DEMO-05 it is exercise HR during already authorised cycling sessions, not resting HR.',
    context:
      'NASA documents CEVIS displaying heart rate, cycling speed and elapsed time while controlling workload. A suitable heart-rate monitor can obtain this type of observation. Verify recorded workload, exercise phase, device, source and sessions before comparing.',
    boundary:
      'A single heart rate is not posture-related HR difference, aerobic capacity or a diagnosis.',
    sources: ['cevis', 'exercise', 'aerobic', 'medical-care'],
  },
  map: {
    meaning:
      'Mean arterial pressure is a pressure quantity recorded in mmHg, distinct from systolic and diastolic pressure.',
    context: 'Cardiovascular observations matter when circulation adapts to altered gravity.',
    boundary:
      'No conversion from a cuff reading or clinical blood-pressure classification is performed.',
    sources: ['cardiovascular', 'hazards'],
  },
};
