import { demoSuffix } from './demoProfile';
import { packMission, unpackMission } from './storageEncoding';
import { allMissionObservations, isRich } from './richEvidence';
import type { MonitoringSnapshot } from '../monitoring/snapshot';
import { canonical, evidenceIdentity } from './identity';
import { initialContext, validateContext, type MissionContext } from './context';
import { fixtureRevision, validateObservations } from './observations';
import { followupRecordId, initialReviewRecordIds, validateArchiveRecord } from './archive';
import {
  createMonitoringPlan,
  createReview,
  freezeSnapshot,
  historyLimit,
  planCurrency,
  validatePlan,
  validateReview,
  uuid,
  type MonitoringPlan,
  type ReviewSnapshot,
  type ReviewSelection,
} from './review';
import { exact, object, requireValid, strings } from './validation';

// Keep the namespace so schema 1 is detected and visibly reset rather than silently ignored.
export const missionStorageKey = demoSuffix
  ? 'parallax.mission.rich.v2' + demoSuffix
  : typeof location !== 'undefined' && !new URLSearchParams(location.search).has('legacy')
    ? 'parallax.mission.rich.v2'
    : 'parallax.mission.v1';
// Five immutable monitored reviews plus five designations measured above the old 300k guard.
export const missionStorageCharacterLimit = 500000;
export interface MissionState {
  schemaVersion: 2;
  fixtureRevision: typeof fixtureRevision;
  sessionId: string;
  context: MissionContext;
  entered: boolean;
  includedRecordIds: string[];
  excludedRecordIds: string[];
  evidenceRevision: number;
  reviewSchemaVersion: 1;
  evidenceLineage: string;
  planRevision: number;
  monitoringPlans: MonitoringPlan[];
  reviews: ReviewSnapshot[];
  droppedHistory: { plans: number; reviews: number };
}
export const initialMissionState = (): MissionState => ({
  schemaVersion: 2,
  fixtureRevision,
  sessionId: crypto.randomUUID(),
  context: structuredClone(initialContext),
  entered: false,
  includedRecordIds: initialReviewRecordIds(),
  excludedRecordIds: [],
  evidenceRevision: 1,
  reviewSchemaVersion: 1,
  evidenceLineage: '',
  planRevision: 0,
  monitoringPlans: [],
  reviews: [],
  droppedHistory: { plans: 0, reviews: 0 },
});
export function initialRichMissionState(): MissionState {
  const state = initialMissionState();
  return {
    ...state,
    includedRecordIds: [
      ...state.includedRecordIds,
      ...allMissionObservations()
        .filter(
          (r) => r.id.startsWith('fictional-health-register-v2') && r.missionPhase === 'transit',
        )
        .map((r) => r.id),
    ],
    context: {
      ...state.context,
      equipment: [
        ...state.context.equipment,
        'fictional-gas-analyser-02',
        'fictional-gas-calibration-kit-02',
        'fictional-crew-diary-v2',
      ],
      assistance: [...state.context.assistance, 'fictional-qualified-exercise-operator'],
    },
  };
}
export type MissionCommand =
  | { type: 'designate-monitoring' }
  | {
      type: 'save-review';
      selection: ReviewSelection;
      monitoring?: MonitoringSnapshot;
      expectedIdentity?: string;
    }
  | { type: 'begin' }
  | { type: 'retrieve-record'; record: unknown }
  | { type: 'remove-retrieved-record' }
  | { type: 'record-availability'; recordId: string; available: boolean }
  | { type: 'context-change'; context: MissionContext }
  | { type: 'restart' };

export function missionReducer(state: MissionState, command: MissionCommand): MissionState {
  switch (command.type) {
    case 'begin':
      return state.entered ? state : { ...state, entered: true };
    case 'restart':
      return {
        ...(isRich(state.includedRecordIds) ? initialRichMissionState() : initialMissionState()),
        monitoringPlans: state.monitoringPlans,
        reviews: state.reviews,
        droppedHistory: state.droppedHistory,
      };
    case 'designate-monitoring': {
      if (state.monitoringPlans.some((p) => planCurrency(p, state) === 'current')) return state;
      return {
        ...state,
        monitoringPlans: [...state.monitoringPlans, createMonitoringPlan(state)].slice(
          -historyLimit,
        ),
        planRevision: state.planRevision + 1,
        droppedHistory: {
          ...state.droppedHistory,
          plans:
            state.droppedHistory.plans + (state.monitoringPlans.length >= historyLimit ? 1 : 0),
        },
      };
    }
    case 'save-review':
      requireValid(
        !command.expectedIdentity ||
          command.expectedIdentity ===
            canonical({
              basis: evidenceIdentity(state),
              plans: state.monitoringPlans,
              revision: state.planRevision,
            }),
        'Mission changed while monitoring evidence was read. Review again before saving.',
      );
      return {
        ...state,
        reviews: [
          ...state.reviews,
          createReview(state, command.selection, new Date().toISOString(), command.monitoring),
        ].slice(-historyLimit),
        droppedHistory: {
          ...state.droppedHistory,
          reviews: state.droppedHistory.reviews + (state.reviews.length >= historyLimit ? 1 : 0),
        },
      };
    case 'retrieve-record': {
      requireValid(
        state.context.equipment.includes('onboard-record-archive'),
        'The fictional archive is unavailable.',
      );
      const record = validateArchiveRecord(command.record, state.context);
      if (state.includedRecordIds.includes(record.id)) return state;
      return {
        ...state,
        includedRecordIds: [...state.includedRecordIds, record.id],
        evidenceRevision: state.evidenceRevision + 1,
        evidenceLineage: crypto.randomUUID(),
      };
    }
    case 'remove-retrieved-record':
      if (!state.includedRecordIds.includes(followupRecordId)) return state;
      return {
        ...state,
        includedRecordIds: state.includedRecordIds.filter((id) => id !== followupRecordId),
        excludedRecordIds: state.excludedRecordIds.filter((id) => id !== followupRecordId),
        evidenceRevision: state.evidenceRevision + 1,
        evidenceLineage: crypto.randomUUID(),
      };
    case 'record-availability': {
      requireValid(
        state.includedRecordIds.includes(command.recordId),
        'Only a record already included in this review can be excluded or restored.',
      );
      if (state.excludedRecordIds.includes(command.recordId) === !command.available) return state;
      return {
        ...state,
        evidenceRevision: state.evidenceRevision + 1,
        evidenceLineage: crypto.randomUUID(),
        excludedRecordIds: command.available
          ? state.excludedRecordIds.filter((id) => id !== command.recordId)
          : [...state.excludedRecordIds, command.recordId],
      };
    }
    case 'context-change': {
      const context = validateContext(command.context);
      requireValid(
        context.missionId === state.context.missionId &&
          context.astronaut.id === state.context.astronaut.id,
        'A different mission requires a new fixture.',
      );
      validateObservations(allMissionObservations(), context);
      return {
        ...state,
        context: { ...context, contextRevision: state.context.contextRevision + 1 },
        evidenceLineage: crypto.randomUUID(),
      };
    }
  }
}

export function decodeMission(raw: string | null): { state: MissionState; notice: string } {
  const fallback = (notice = '') => ({ state: initialMissionState(), notice });
  if (raw === null) return fallback();
  try {
    requireValid(
      raw.length <= missionStorageCharacterLimit,
      'Stored mission exceeds its size limit.',
    );
    const x: unknown = unpackMission(JSON.parse(raw));
    let migrated = false;
    if (object(x) && x.schemaVersion === 1)
      return fallback(
        'The saved Phase 1 mission uses an older record model. A new mission review has started with the 28 June record in the archive only. Other reviews are unchanged.',
      );
    if (object(x) && x.schemaVersion === 2 && !Object.hasOwn(x, 'reviewSchemaVersion')) {
      requireValid(
        exact(x, [
          'schemaVersion',
          'fixtureRevision',
          'sessionId',
          'context',
          'entered',
          'includedRecordIds',
          'excludedRecordIds',
          'evidenceRevision',
        ]),
        'Unknown older mission fields.',
      );
      Object.assign(x, {
        reviewSchemaVersion: 1,
        evidenceLineage: '',
        planRevision: 0,
        monitoringPlans: [],
        reviews: [],
        droppedHistory: { plans: 0, reviews: 0 },
      });
      migrated = true;
    }
    requireValid(
      object(x) &&
        exact(x, [
          'schemaVersion',
          'fixtureRevision',
          'sessionId',
          'context',
          'entered',
          'includedRecordIds',
          'excludedRecordIds',
          'evidenceRevision',
          'reviewSchemaVersion',
          'evidenceLineage',
          'planRevision',
          'monitoringPlans',
          'reviews',
          'droppedHistory',
        ]),
      'Invalid mission state fields.',
    );
    requireValid(
      x.schemaVersion === 2 &&
        typeof x.fixtureRevision === 'string' &&
        x.fixtureRevision.length <= 80,
      'Unsupported mission schema or fixture revision.',
    );
    requireValid(
      typeof x.sessionId === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x.sessionId),
      'Invalid mission session identity.',
    );
    const context = validateContext(x.context);
    requireValid(
      context.missionId === initialContext.missionId &&
        context.astronaut.id === initialContext.astronaut.id,
      'Unknown stored mission.',
    );
    const records = validateObservations(allMissionObservations(), context);
    requireValid(
      typeof x.entered === 'boolean' &&
        strings(x.includedRecordIds) &&
        new Set(x.includedRecordIds).size === x.includedRecordIds.length &&
        x.includedRecordIds.every((id) => records.some((r) => r.id === id)) &&
        initialReviewRecordIds().every((id) => (x.includedRecordIds as string[]).includes(id)) &&
        strings(x.excludedRecordIds) &&
        new Set(x.excludedRecordIds).size === x.excludedRecordIds.length &&
        x.excludedRecordIds.every((id) => (x.includedRecordIds as string[]).includes(id)) &&
        Number.isSafeInteger(x.evidenceRevision) &&
        Number(x.evidenceRevision) >= 1,
      'Invalid stored evidence selection.',
    );
    requireValid(
      x.reviewSchemaVersion === 1 &&
        (x.evidenceLineage === '' || uuid(x.evidenceLineage)) &&
        Number.isSafeInteger(x.planRevision) &&
        Number(x.planRevision) >= 0 &&
        Array.isArray(x.monitoringPlans) &&
        x.monitoringPlans.length <= historyLimit &&
        Array.isArray(x.reviews) &&
        x.reviews.length <= historyLimit,
      'Invalid review history.',
    );
    x.monitoringPlans.forEach(validatePlan);
    x.reviews.forEach(validateReview);
    requireValid(
      new Set(x.monitoringPlans.map((p) => (p as MonitoringPlan).id)).size ===
        x.monitoringPlans.length &&
        new Set(x.reviews.map((r) => (r as ReviewSnapshot).id)).size === x.reviews.length,
      'Duplicate saved history.',
    );
    const dropped = x.droppedHistory;
    requireValid(
      object(dropped) &&
        exact(dropped, ['plans', 'reviews']) &&
        Number.isSafeInteger(dropped.plans) &&
        Number(dropped.plans) >= 0 &&
        Number.isSafeInteger(dropped.reviews) &&
        Number(dropped.reviews) >= 0,
      'Invalid history retention.',
    );
    if (x.fixtureRevision !== fixtureRevision) {
      const fresh = fallback(
        'The saved mission could not be resumed with this fixture. A new mission generation has started; valid bounded historical reviews and designations are retained as stale.',
      );
      return {
        ...fresh,
        state: {
          ...fresh.state,
          monitoringPlans: freezeSnapshot(x.monitoringPlans as MonitoringPlan[]),
          reviews: freezeSnapshot(x.reviews as ReviewSnapshot[]),
          droppedHistory: { plans: Number(dropped.plans), reviews: Number(dropped.reviews) },
        },
      };
    }
    return {
      state: {
        schemaVersion: 2,
        fixtureRevision,
        sessionId: x.sessionId,
        context,
        entered: x.entered,
        includedRecordIds: x.includedRecordIds,
        excludedRecordIds: x.excludedRecordIds,
        evidenceRevision: Number(x.evidenceRevision),
        reviewSchemaVersion: 1,
        evidenceLineage: x.evidenceLineage as string,
        planRevision: Number(x.planRevision),
        monitoringPlans: freezeSnapshot(x.monitoringPlans as MonitoringPlan[]),
        reviews: freezeSnapshot(x.reviews as ReviewSnapshot[]),
        droppedHistory: { plans: Number(dropped.plans), reviews: Number(dropped.reviews) },
      },
      notice: migrated
        ? 'Your Phase 2 mission was resumed. No fictional human review or monitoring designation has been recorded.'
        : (x.monitoringPlans as MonitoringPlan[]).length > 0 &&
            (x.monitoringPlans as MonitoringPlan[]).at(-1)?.basis.versions.monitoringPolicy ===
              'monitoring-policy-1'
          ? 'Source and monitoring policy updated. Earlier designations and reviews retain their original contents and are stale; a new designation is required.'
          : '',
    };
  } catch {
    return fallback(
      'The saved mission could not be resumed. A new fictional review has started with the follow-up in the archive only; other reviews are unchanged.',
    );
  }
}
export const encodeMission = (state: MissionState) => {
  const expanded = JSON.stringify(state);
  const raw =
    expanded.length > 450000 && isRich(state.includedRecordIds) ? packMission(state) : expanded;
  requireValid(
    raw.length <= missionStorageCharacterLimit,
    'Mission review history exceeds its bounded save limit.',
  );
  return raw;
};
