import { measures, type CasePacket, type Observation } from './model';

export class InputError extends Error {
  constructor(public readonly problems: string[]) {
    super(problems.join('\n'));
    this.name = 'InputError';
  }
}
const object = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);
const text = (x: unknown, max = 240): x is string =>
  typeof x === 'string' && x.trim().length > 0 && x.length <= max;
const stringList = (x: unknown): x is string[] =>
  Array.isArray(x) && x.length <= 12 && x.every((v) => text(v));
const only = (x: Record<string, unknown>, fields: string[]) =>
  Object.keys(x).every((k) => fields.includes(k));
const recordFields = [
  'id',
  'caseId',
  'measurement',
  'value',
  'unit',
  'phase',
  'session',
  'protocol',
  'window',
  'timestamp',
  'origin',
  'form',
  'sourceId',
  'sourceRecord',
  'derivedFrom',
  'issues',
  'acquisition',
];
function validTime(x: unknown): boolean {
  if (x === null) return true;
  if (typeof x !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(x))
    return false;
  const time = new Date(x);
  return (
    Number.isFinite(time.valueOf()) &&
    time.toISOString().replace('.000Z', 'Z') === x.replace('.000Z', 'Z')
  );
}

/** Atomic and bounded. Never coerces strings, fills gaps, or repairs source data. */
export function validatePacket(input: unknown): CasePacket {
  const errors: string[] = [];
  if (!object(input)) throw new InputError(['Expected a demonstration JSON object.']);
  if (!only(input, ['schemaVersion', 'origin', 'case', 'observations', 'context']))
    errors.push('Unknown top-level fields. Use the provided synthetic template.');
  if (input.schemaVersion !== 1) errors.push('schemaVersion must be 1.');
  if (input.origin !== 'synthetic')
    errors.push(
      'Only explicitly synthetic demonstration data is accepted. Do not enter real health records.',
    );
  if (
    !object(input.case) ||
    !only(input.case, ['id', 'title', 'description']) ||
    !text(input.case.id, 80) ||
    !text(input.case.title, 100) ||
    !text(input.case.description, 600)
  )
    errors.push('case requires id, title and description within the documented limits.');
  if (!Array.isArray(input.observations) || input.observations.length > 200)
    errors.push('observations must be an array of at most 200 records.');
  if (
    input.context !== undefined &&
    (!object(input.context) ||
      !only(input.context, ['kind', 'acquisition']) ||
      !['mission-demo', 'bed-rest-analog', 'inflight-demo'].includes(String(input.context.kind)) ||
      !text(input.context.acquisition, 400))
  )
    errors.push(
      'context requires a synthetic example kind and an explicit acquisition description.',
    );
  const ids = new Set<string>();
  if (Array.isArray(input.observations) && input.observations.length <= 200)
    input.observations.forEach((r: unknown, i: number) => {
      const prefix = `Record ${i + 1}: `;
      if (!object(r)) {
        errors.push(prefix + 'expected an observation object.');
        return;
      }
      if (r.acquisition !== undefined) {
        const a = r.acquisition;
        if (
          !object(a) ||
          !only(a, ['setting', 'activity', 'workloadWatts', 'timing', 'device']) ||
          a.setting !== 'inflight-microgravity' ||
          a.activity !== 'cycling-exercise' ||
          typeof a.workloadWatts !== 'number' ||
          !Number.isFinite(a.workloadWatts) ||
          a.workloadWatts < 0 ||
          !text(a.timing, 100) ||
          !text(a.device, 100) ||
          r.measurement !== 'hr'
        )
          errors.push(prefix + 'invalid cycling acquisition metadata.');
      }
      if (
        object(input.context) &&
        input.context.kind === 'inflight-demo' &&
        r.measurement === 'hr' &&
        r.acquisition === undefined
      )
        errors.push(prefix + 'in-flight heart rate requires explicit acquisition metadata.');
      if (!only(r, recordFields)) errors.push(prefix + 'unknown observation fields.');
      for (const k of ['id', 'caseId', 'session', 'protocol', 'window', 'sourceId', 'sourceRecord'])
        if (!text(r[k], 100))
          errors.push(prefix + `${k} must be a nonempty string of at most 100 characters.`);
      if (typeof r.id === 'string') {
        if (ids.has(r.id)) errors.push(prefix + 'duplicate observation id.');
        ids.add(r.id);
      }
      if (object(input.case) && r.caseId !== input.case.id)
        errors.push(prefix + 'caseId must match the demonstration case.');
      const known = typeof r.measurement === 'string' && Object.hasOwn(measures, r.measurement);
      if (!known) errors.push(prefix + 'unknown measurement type.');
      if (known && r.unit !== measures[r.measurement as keyof typeof measures].unit)
        errors.push(
          prefix +
            'unit does not match the canonical measurement unit; automatic conversion is not performed.',
        );
      if (typeof r.value !== 'number' || !Number.isFinite(r.value))
        errors.push(prefix + 'value must be a finite number.');
      else {
        if (r.measurement !== 'cardio' && r.value < 0)
          errors.push(
            prefix +
              `${known ? measures[r.measurement as keyof typeof measures].detail : 'Measurement'} cannot be negative.`,
          );
        if (r.measurement === 'tandem' && r.value > 100)
          errors.push(prefix + 'Tandem correct steps must be between 0 and 100%.');
      }
      if (r.phase !== 'baseline' && r.phase !== 'followup')
        errors.push(prefix + 'phase must be baseline or followup.');
      if (!validTime(r.timestamp))
        errors.push(prefix + 'timestamp must be null (unknown) or a real ISO UTC timestamp.');
      if (r.origin !== 'synthetic') errors.push(prefix + 'origin must be synthetic.');
      if (r.form !== 'direct' && r.form !== 'derived')
        errors.push(prefix + 'form must be direct or derived.');
      if (!stringList(r.derivedFrom) || !stringList(r.issues))
        errors.push(prefix + 'derivedFrom and issues must be bounded string arrays.');
      if (r.form === 'derived' && Array.isArray(r.derivedFrom) && r.derivedFrom.length === 0)
        errors.push(prefix + 'derived observations need derivation dependencies.');
      if (r.form === 'direct' && Array.isArray(r.derivedFrom) && r.derivedFrom.length > 0)
        errors.push(prefix + 'direct observations cannot have derivation dependencies.');
    });
  if (errors.length) throw new InputError(errors);
  const packet = input as unknown as CasePacket;
  const all = new Map(packet.observations.map((r) => [r.id, r]));
  for (const r of packet.observations)
    for (const dependency of r.derivedFrom) {
      if (dependency === r.id || !all.has(dependency))
        errors.push(
          `Record ${r.id}: derivation dependency must refer to another included observation.`,
        );
    }
  // Acyclic dependencies protect future expansion without treating derivatives as independent evidence.
  const visiting = new Set<string>();
  const visited = new Set<string>();
  function visit(r: Observation) {
    if (visiting.has(r.id)) {
      errors.push(`Record ${r.id}: circular derivation dependencies.`);
      return;
    }
    if (visited.has(r.id)) return;
    visiting.add(r.id);
    for (const id of r.derivedFrom) {
      const d = all.get(id);
      if (d) visit(d);
    }
    visiting.delete(r.id);
    visited.add(r.id);
  }
  packet.observations.forEach(visit);
  if (errors.length) throw new InputError(errors);
  return structuredClone(packet);
}

export function parseImport(raw: string): CasePacket {
  if (raw.length > 250_000 || new TextEncoder().encode(raw).byteLength > 250_000)
    throw new InputError(['File exceeds the 250 KB demonstration import limit.']);
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new InputError([
      'This file is not valid JSON. Download the demonstration template and try again.',
    ]);
  }
  return validatePacket(data);
}
