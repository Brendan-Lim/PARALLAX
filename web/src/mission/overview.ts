import {
  allMissionObservations,
  descriptiveComparisons,
  isRich,
  richSources,
} from './richEvidence';
import { reviewStatus } from './identity';
import { comparisonBridge, comparisonApplicable } from './bridge';
import { archiveRecords } from './archive';
import { requirementDefinitions } from './requirements';
import type { MissionState } from './state';

/** Every count, chart and summary consumes this same engine-backed projection. */
export function missionOverview(state: MissionState) {
  const records = allMissionObservations().filter((r) => state.includedRecordIds.includes(r.id));
  const legacy = records.filter(
    (r) => r.measurement === 'exercise-hr' || r.measurement === 'leg-press-force',
  );
  const bridge = comparisonBridge(state.context, legacy, {
    policy: 'explicit-assessment-selection-v1',
    recordIds: legacy.filter((r) => !state.excludedRecordIds.includes(r.id)).map((r) => r.id),
  });
  const exercise = bridge.findings.find((f) => f.id === 'hr')!;
  const strength = bridge.findings.find((f) => f.id === 'force')!;
  const mobility = bridge.findings.find((f) => f.id === 'task')!;
  const exerciseApplicable = records
    .filter((r) => r.measurement === 'exercise-hr')
    .every((r) => comparisonApplicable(r, state.context));
  const descriptive = descriptiveComparisons(records, state.context, state.excludedRecordIds);
  const rich = isRich(state.includedRecordIds);
  const definitions = rich
    ? [
        ...requirementDefinitions,
        {
          ...requirementDefinitions[1],
          id: 'sleep',
          label: 'Reported sleep duration',
          applicablePhases: ['transit', 'approach'] as import('./context').MissionPhase[],
        },
      ]
    : requirementDefinitions;
  const requirements = definitions.map((r) => ({
    ...r,
    ...(rich && ['aerobic', 'sleep'].includes(r.id)
      ? {
          label:
            r.id === 'aerobic' ? 'Recorded absolute peak oxygen uptake' : 'Reported sleep duration',
          requiredEquipment:
            r.id === 'aerobic'
              ? ['fictional-gas-analyser-02', 'fictional-gas-calibration-kit-02']
              : ['fictional-crew-diary-v2'],
          requiredSupervision:
            r.id === 'aerobic'
              ? 'Previously collected fictional gas-analysis assessment; qualified operator and supervision declared.'
              : 'Previously recorded fictional crew self-report; no visitor entry.',
          source: {
            origin: 'published-evidence' as const,
            sourceUrl: richSources[r.id === 'aerobic' ? 0 : 1].url,
            locator: richSources[r.id === 'aerobic' ? 0 : 1].label,
            population: 'Scientific context, not validation of fictional measurements.',
            acquisitionContext: richSources[r.id === 'aerobic' ? 0 : 1].boundary,
          },
          unresolvedReason:
            r.id === 'aerobic'
              ? 'Separate absolute VO₂peak observations; no VO₂max plateau or requirement satisfaction established.'
              : 'Equivalent diary reporting periods; no diagnosis or fatigue impairment established.',
        }
      : {}),
    state:
      rich && (r.id === 'aerobic' || r.id === 'sleep')
        ? descriptive.find(
            (c) => c.measurement === (r.id === 'aerobic' ? 'vo2peak' : 'reported-sleep-duration'),
          )?.supported
          ? ('available-records' as const)
          : ('unresolved-requirement' as const)
        : r.id === 'exercise'
          ? !exerciseApplicable
            ? ('incompatible-environment' as const)
            : exercise.status === 'supported'
              ? ('available-records' as const)
              : state.excludedRecordIds.some((id) =>
                    records.some((r) => r.id === id && r.measurement === 'exercise-hr'),
                  )
                ? ('excluded-records' as const)
                : exercise.status === 'unresolved'
                  ? ('unresolved-requirement' as const)
                  : ('missing-existing-record' as const)
          : r.id === 'mobility' && state.context.phase === 'surface'
            ? ('unresolved-requirement' as const)
            : r.state,
  }));
  const applicable = requirements.filter((r) => r.applicablePhases.includes(state.context.phase));
  return {
    records,
    excludedRecordIds: state.excludedRecordIds,
    descriptive,
    rich,
    archivedRecords: archiveRecords().filter((r) => !state.includedRecordIds.includes(r.id)),
    bridge,
    exercise,
    strength,
    mobility,
    exerciseApplicable,
    // Current-context UI must never expose a historical comparison as a surface assessment.
    exerciseComparison:
      exerciseApplicable && exercise.status === 'supported' ? exercise.comparison : undefined,
    requirements,
    coverage: {
      available: applicable.filter((r) => r.state === 'available-records').length,
      total: applicable.length,
      ids: applicable.map((r) => r.id),
    },
    future: requirements.filter((r) => !r.applicablePhases.includes(state.context.phase)),
    reviewDisposition: reviewStatus(state),
  };
}
