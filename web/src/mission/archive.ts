import type { MissionContext } from './context';
import { missionObservations, validateObservations } from './observations';
import { requireValid } from './validation';

export const followupRecordId = 'mars-hr-jun28';
/** Bundled fictional archive; presence here never implies membership in a review. */
export const archiveRecords = () => missionObservations().filter((r) => r.id === followupRecordId);
export const initialReviewRecordIds = () =>
  missionObservations()
    .filter((r) => r.id !== followupRecordId)
    .map((r) => r.id);

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}

/** Verify every value, identity and acquisition field before assigning archive provenance. */
export function validateArchiveRecord(input: unknown, context: MissionContext) {
  const [record] = validateObservations([input], context);
  const source = archiveRecords().find((r) => r.id === record.id);
  requireValid(
    source && canonical(source) === canonical(record),
    'The supplied record does not match the fictional archive source.',
  );
  return record;
}
