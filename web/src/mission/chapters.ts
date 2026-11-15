import { requireValid } from './validation';
import { initialContext, gravityFor, validateContext, type MissionPhase } from './context';
import { allMissionObservations, descriptiveComparisons } from './richEvidence';
import { validateObservations } from './observations';
export const chapterRevision = 'mission-chapters-v1';
export const chapterTimes = {
  preflight: '2039-12-20T12:00:00Z',
  transit: '2040-06-28T18:00:00Z',
  approach: '2040-06-29T12:00:00Z',
  surface: '2040-06-30T18:00:00Z',
} as const;
/** Read-only longitudinal chapters; never a reducer context-change or active record selection. */
export function missionChapter(phase: MissionPhase) {
  const context = validateContext({
    ...structuredClone(initialContext),
    phase,
    gravity: gravityFor(phase),
    fictionalNow: chapterTimes[phase],
    ...(phase === 'surface'
      ? {
          nextActivity: {
            label: 'Illustrative surface planning review',
            at: '2040-07-01T12:00:00Z',
            kind: 'surface-transfer',
          },
        }
      : {}),
  });
  const records = validateObservations(
    allMissionObservations().filter((r) => r.timestamp <= context.fictionalNow),
    context,
  );
  return {
    version: chapterRevision,
    context,
    records,
    descriptive: descriptiveComparisons(records, context),
  };
}
export const surfaceDiary = {
  version: 1,
  origin: 'fictional-crew-report',
  missionId: 'DEMO-MARS-01',
  subjectId: 'FICTIONAL-01',
  timestamp: '2040-06-30T17:00:00Z',
  gravity: 'mars-0.38g',
  sourceId: 'fictional-surface-diary-v1',
  text: 'The crew reports settling into the habitat after landing. No timed walking, balance or fall-recovery result was collected.',
  validatedPerformance: false,
} as const;

export function validateSurfaceDiary(input: unknown, now: string) {
  requireValid(
    JSON.stringify(input) === JSON.stringify(surfaceDiary) && surfaceDiary.timestamp <= now,
    'Invalid or future fictional crew report.',
  );
  return structuredClone(surfaceDiary);
}
