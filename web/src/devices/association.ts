import {
  canonical,
  evidenceIdentity,
  identityMatches,
  type EvidenceIdentity,
} from '../mission/identity';
import { planCurrency, type MonitoringPlan } from '../mission/review';
import type { MissionState } from '../mission/state';
import type { TelemetryBatch, TelemetryObservation } from './astroskin';
import { adapterVersion, documentationVersion } from './astroskin';

export interface BatchAssociation {
  planId: string | null;
  planRevision: number;
  basis: EvidenceIdentity;
  fictionalAt: string;
  adapterVersion: string;
  documentationVersion: string;
}
export interface MissionTelemetry {
  batch: TelemetryBatch;
  association: BatchAssociation;
}
export function bindBatch(batch: TelemetryBatch, state: MissionState): MissionTelemetry {
  const plan = state.monitoringPlans.at(-1);
  return {
    batch,
    association: {
      planId: plan && planCurrency(plan, state) === 'current' ? plan.id : null,
      planRevision: state.planRevision,
      basis: evidenceIdentity(state),
      fictionalAt: state.context.fictionalNow,
      adapterVersion,
      documentationVersion,
    },
  };
}
export function associationStatus(
  telemetry: MissionTelemetry,
  state: MissionState,
  sample: TelemetryObservation = telemetry.batch.observations.at(-1)!,
): { associated: boolean; reason: string; plan?: MonitoringPlan } {
  const binding = telemetry.association;
  if (!binding.planId)
    return {
      associated: false,
      reason:
        'No current designation when this batch was processed. Process again after designation.',
    };
  const plan = state.monitoringPlans.find((p) => p.id === binding.planId);
  if (
    !plan ||
    planCurrency(plan, state) !== 'current' ||
    !identityMatches(binding.basis, state) ||
    state.planRevision !== binding.planRevision ||
    state.monitoringPlans.at(-1)?.id !== plan.id
  )
    return {
      associated: false,
      reason:
        'Association stale: evidence, context, session or plan changed. Earlier batch retained without reactivation.',
    };
  if (
    binding.adapterVersion !== adapterVersion ||
    binding.documentationVersion !== documentationVersion ||
    sample.adapterVersion !== binding.adapterVersion ||
    sample.documentationVersion !== binding.documentationVersion
  )
    return { associated: false, reason: 'Source or adapter version changed; process a new batch.' };
  if (
    sample.origin !== 'documented-format-synthetic' ||
    sample.integrationMaturity !== 1 ||
    plan.watchId !== 'cardiovascular' ||
    plan.observation !== sample.measurement ||
    plan.channel.id !== 'astro-hr' ||
    plan.channel.datatype !== sample.sourceDatatype ||
    plan.channel.qualityDatatype !== sample.qualityDatatype ||
    plan.channel.unit !== sample.unit ||
    sample.sourceId !== 'commercial-astroskin-json' ||
    sample.acquisitionId !== telemetry.batch.acquisition.acquisitionId ||
    sample.sourceRecordId !== telemetry.batch.acquisition.sourceRecordId ||
    sample.sourceDeviceId !== telemetry.batch.acquisition.sourceDeviceId ||
    sample.acquisitionSetting !== 'synthetic-format-laboratory' ||
    !telemetry.batch.observations.some((s) => canonical(s) === canonical(sample))
  )
    return { associated: false, reason: 'Quantity, source or acquisition context incompatible.' };
  return {
    associated: true,
    reason:
      'Associated with the exact current fictional cardiovascular HR designation. Activity/workload and absolute acquisition time remain unknown; no exercise-assessment comparison.',
    plan,
  };
}
