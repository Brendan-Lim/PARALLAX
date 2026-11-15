import { evaluate } from '../core/engine';
import type { CasePacket, Observation } from '../core/model';
import { validatePacket } from '../core/validate';
import { validateContext, type MissionContext } from './context';
import {
  measurementDefinitions,
  validateObservations,
  type FictionalObservation,
} from './observations';
import { requireValid } from './validation';

export interface ComparisonSelection {
  recordIds: string[];
  policy: 'explicit-assessment-selection-v1';
}

/** Explicit assessment selection only. No telemetry reduction, averaging or newest-value rule. */
export function comparisonBridge(
  context: MissionContext,
  input: unknown,
  selection: ComparisonSelection,
) {
  const c = validateContext(context);
  const validated = validateObservations(input, c);
  requireValid(
    validated.every((r) => r.measurement === 'exercise-hr' || r.measurement === 'leg-press-force'),
    'The legacy bridge accepts only its established quantities.',
  );
  const records = validated as import('./observations').LegacyObservation[];
  requireValid(
    selection.policy === 'explicit-assessment-selection-v1' &&
      Array.isArray(selection.recordIds) &&
      selection.recordIds.length <= 200 &&
      new Set(selection.recordIds).size === selection.recordIds.length,
    'An explicit unique record selection is required.',
  );
  const selected = selection.recordIds.map((id) => {
    const record = records.find((r) => r.id === id);
    requireValid(record, 'A selected assessment record is unavailable.');
    return record;
  });
  const observations: Observation[] = selected.map((r) => ({
    id: r.id,
    caseId: c.missionId,
    measurement: measurementDefinitions[r.measurement].legacyMeasure,
    value: r.value,
    unit: r.unit,
    phase: r.comparisonRole,
    session: r.session,
    protocol: r.protocol,
    window: r.window,
    timestamp: r.timestamp,
    origin: 'synthetic',
    form: r.form,
    sourceId: r.provenance.sourceId,
    sourceRecord: r.provenance.sourceRecord,
    derivedFrom: r.derivedFrom,
    issues: [
      ...r.quality.flags,
      ...(r.quality.state === 'declared-good' ? [] : [`Source quality: ${r.quality.state}`]),
    ],
    ...(r.measurement === 'exercise-hr' ? { acquisition: r.acquisition } : {}),
  }));
  const packet: CasePacket = validatePacket({
    schemaVersion: 1,
    origin: 'synthetic',
    case: {
      id: c.missionId,
      title: 'Fictional Mars mission observations',
      description:
        'Explicitly selected fictional assessment records; historical acquisition context is retained outside this legacy packet.',
    },
    context: {
      kind: 'inflight-demo',
      acquisition:
        'Two historical microgravity cycling sessions and a separate Earth preflight force reference. No current Mars measurements or device connection.',
    },
    observations,
  });
  return {
    packet,
    findings: evaluate(packet),
    selectedRecordIds: selected.map((r) => r.id),
    engineContract: 'legacy-evaluate-v1' as const,
  };
}

export function comparisonApplicable(record: FictionalObservation, context: MissionContext) {
  return record.measurement === 'exercise-hr'
    ? context.gravity === 'microgravity' && ['transit', 'approach'].includes(context.phase)
    : context.gravity === 'earth-1g' && context.phase === 'preflight';
}
