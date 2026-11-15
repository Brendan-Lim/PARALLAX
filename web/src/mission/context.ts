import { exact, object, requireValid, strings, text, utc } from './validation';

export const missionPhases = ['preflight', 'transit', 'approach', 'surface'] as const;
export type MissionPhase = (typeof missionPhases)[number];
export type Gravity = 'earth-1g' | 'microgravity' | 'mars-0.38g';
export interface MissionContext {
  missionId: string;
  missionName: string;
  astronaut: { id: string; name: string; fictional: true };
  phase: MissionPhase;
  gravity: Gravity;
  fictionalNow: string;
  nextActivity: { label: string; at: string; kind: 'landing' | 'surface-transfer' };
  timeline: { phase: MissionPhase; startsAt: string; endsAt: string }[];
  earthCommunications: {
    status: 'available' | 'outage';
    oneWayDelaySeconds: number;
    illustrative: true;
  };
  equipment: string[];
  assistance: string[];
  reviewAuthority: { role: 'hypothetical-cmo'; label: string; authenticatesAuthority: false };
  contextRevision: number;
}

export const initialContext: MissionContext = {
  missionId: 'DEMO-MARS-01',
  missionName: 'Aster / Mars approach',
  astronaut: { id: 'FICTIONAL-01', name: 'Alex Morgan', fictional: true },
  phase: 'approach',
  gravity: 'microgravity',
  fictionalNow: '2040-06-29T12:00:00Z',
  nextActivity: { label: 'Mars landing', at: '2040-06-30T12:00:00Z', kind: 'landing' },
  timeline: [
    { phase: 'preflight', startsAt: '2039-12-01T00:00:00Z', endsAt: '2040-01-01T12:00:00Z' },
    { phase: 'transit', startsAt: '2040-01-01T12:00:00Z', endsAt: '2040-06-29T00:00:00Z' },
    { phase: 'approach', startsAt: '2040-06-29T00:00:00Z', endsAt: '2040-06-30T12:00:00Z' },
    { phase: 'surface', startsAt: '2040-06-30T12:00:00Z', endsAt: '2040-07-30T12:00:00Z' },
  ],
  earthCommunications: { status: 'available', oneWayDelaySeconds: 900, illustrative: true },
  equipment: ['fictional-cycle-01', 'fictional-hr-monitor-01', 'onboard-record-archive'],
  assistance: ['fictional-crew-medical-officer'],
  reviewAuthority: {
    role: 'hypothetical-cmo',
    label: 'Fictional crew medical officer',
    authenticatesAuthority: false,
  },
  contextRevision: 1,
};

export function gravityFor(phase: MissionPhase): Gravity {
  return phase === 'preflight' ? 'earth-1g' : phase === 'surface' ? 'mars-0.38g' : 'microgravity';
}

export function validateContext(input: unknown): MissionContext {
  requireValid(
    object(input) &&
      exact(input, [
        'missionId',
        'missionName',
        'astronaut',
        'phase',
        'gravity',
        'fictionalNow',
        'nextActivity',
        'timeline',
        'earthCommunications',
        'equipment',
        'assistance',
        'reviewAuthority',
        'contextRevision',
      ]),
    'Invalid mission context fields.',
  );
  requireValid(text(input.missionId, 80) && text(input.missionName), 'Invalid mission identity.');
  const a = input.astronaut;
  requireValid(
    object(a) &&
      exact(a, ['id', 'name', 'fictional']) &&
      text(a.id, 80) &&
      text(a.name) &&
      a.fictional === true,
    'Only fictional crew identities are supported.',
  );
  requireValid(
    missionPhases.includes(input.phase as MissionPhase) &&
      input.gravity === gravityFor(input.phase as MissionPhase) &&
      utc(input.fictionalNow),
    'Mission phase, gravity or fictional time is invalid.',
  );
  const next = input.nextActivity;
  requireValid(
    object(next) &&
      exact(next, ['label', 'at', 'kind']) &&
      text(next.label) &&
      utc(next.at) &&
      ['landing', 'surface-transfer'].includes(String(next.kind)) &&
      next.at > input.fictionalNow,
    'Upcoming activity must follow the fictional observation time.',
  );
  requireValid(
    Array.isArray(input.timeline) && input.timeline.length === 4,
    'The four mission phases are required.',
  );
  let previousEnd: string | undefined;
  input.timeline.forEach((t: unknown, i: number) => {
    requireValid(
      object(t) &&
        exact(t, ['phase', 'startsAt', 'endsAt']) &&
        t.phase === missionPhases[i] &&
        utc(t.startsAt) &&
        utc(t.endsAt) &&
        t.startsAt < t.endsAt,
      'Invalid mission timeline.',
    );
    requireValid(
      previousEnd === undefined || previousEnd === t.startsAt,
      'Mission phases must be contiguous and ordered.',
    );
    previousEnd = t.endsAt;
  });
  const timeline = input.timeline as MissionContext['timeline'];
  const current = timeline.find((t) => t.phase === input.phase)!;
  requireValid(
    input.fictionalNow >= current.startsAt && input.fictionalNow < current.endsAt,
    'Fictional time must lie in the declared phase.',
  );
  requireValid(
    next.kind !== 'landing' || (input.phase !== 'surface' && next.at === timeline[3].startsAt),
    'Landing must begin the surface phase.',
  );
  requireValid(
    next.kind !== 'surface-transfer' || next.at >= timeline[3].startsAt,
    'Surface transfer must follow landing.',
  );
  const comm = input.earthCommunications;
  requireValid(
    object(comm) &&
      exact(comm, ['status', 'oneWayDelaySeconds', 'illustrative']) &&
      ['available', 'outage'].includes(String(comm.status)) &&
      typeof comm.oneWayDelaySeconds === 'number' &&
      Number.isFinite(comm.oneWayDelaySeconds) &&
      comm.oneWayDelaySeconds >= 0 &&
      comm.oneWayDelaySeconds <= 86400 &&
      comm.illustrative === true,
    'Invalid illustrative communications.',
  );
  requireValid(
    strings(input.equipment) && strings(input.assistance),
    'Invalid available resources.',
  );
  const authority = input.reviewAuthority;
  requireValid(
    object(authority) &&
      exact(authority, ['role', 'label', 'authenticatesAuthority']) &&
      authority.role === 'hypothetical-cmo' &&
      text(authority.label) &&
      authority.authenticatesAuthority === false,
    'Review authority must remain hypothetical.',
  );
  requireValid(
    Number.isSafeInteger(input.contextRevision) && Number(input.contextRevision) >= 1,
    'Invalid context revision.',
  );
  return structuredClone(input) as unknown as MissionContext;
}
