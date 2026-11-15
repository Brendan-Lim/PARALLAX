import { measures, type Measure, type Phase, type CasePacket, type Acquisition } from './model';
import { InputError, validatePacket } from './validate';
export interface EntryDraft {
  acquisition?: Acquisition;
  measurement: Measure;
  phase: Phase;
  value: string;
  unit: string;
  session: string;
  protocol: string;
  window: string;
  sourceId: string;
  sourceRecord: string;
  timestamp: string;
}
export function entryDraft(packet: CasePacket, measurement: Measure, phase: Phase): EntryDraft {
  const match = packet.observations.filter(
    (r) => r.measurement === measurement && r.phase === phase && r.form === 'direct',
  );
  const previous = match.length === 1 ? match[0] : undefined;
  const reference = packet.observations.find(
    (r) => r.measurement === measurement && r.form === 'direct',
  );
  return {
    acquisition: previous?.acquisition ? structuredClone(previous.acquisition) : undefined,
    measurement,
    phase,
    value: previous ? String(previous.value) : '',
    unit: measures[measurement].unit,
    session: previous?.session ?? '',
    protocol: previous?.protocol ?? reference?.protocol ?? '',
    window: previous?.window ?? reference?.window ?? '',
    sourceId: previous?.sourceId ?? reference?.sourceId ?? '',
    sourceRecord: previous?.sourceRecord ?? '',
    timestamp: previous?.timestamp ?? '',
  };
}
/** Explicit update of a unique direct candidate; never repairs or chooses among duplicates. */
export function applyEntry(packet: CasePacket, draft: EntryDraft): CasePacket {
  if (!draft.value.trim())
    throw new InputError(['Enter a numerical demonstration value; missing is not zero.']);
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(draft.value.trim()))
    throw new InputError(['Enter a finite decimal demonstration value.']);
  const candidates = packet.observations.filter(
    (r) => r.measurement === draft.measurement && r.phase === draft.phase && r.form === 'direct',
  );
  if (candidates.length > 1)
    throw new InputError([
      'Multiple direct candidates: inspect the source JSON; no implicit replacement is allowed.',
    ]);
  const previous = candidates[0];
  let id = previous?.id ?? `${packet.case.id}-${draft.measurement}-${draft.phase}-entry`;
  while (!previous && packet.observations.some((r) => r.id === id)) id += '-new';
  const record = {
    id,
    caseId: packet.case.id,
    measurement: draft.measurement,
    phase: draft.phase,
    value: Number(draft.value),
    unit: draft.unit,
    session: draft.session,
    protocol: draft.protocol,
    window: draft.window,
    sourceId: draft.sourceId,
    sourceRecord: draft.sourceRecord,
    timestamp: draft.timestamp.trim() || null,
    origin: 'synthetic' as const,
    form: 'direct' as const,
    derivedFrom: [],
    issues: previous?.issues ?? [],
    ...(draft.acquisition ? { acquisition: draft.acquisition } : {}),
  };
  return validatePacket({
    ...packet,
    observations: previous
      ? packet.observations.map((r) => (r.id === previous.id ? record : r))
      : [...packet.observations, record],
  });
}
