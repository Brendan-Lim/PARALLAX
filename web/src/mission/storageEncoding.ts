import { exact, object, requireValid } from './validation';
/** Lossless browser-storage encoding only. Canonical review/export objects stay expanded. */
export function packMission(value: unknown): string {
  const values: unknown[] = [];
  const seen = new Map<string, number>();
  function pack(v: unknown): unknown {
    if (v === null || (typeof v !== 'object' && typeof v !== 'string')) return v;
    const key = JSON.stringify(v);
    if (key.length < 80) return v;
    const old = seen.get(key);
    if (old !== undefined) return { $ref: old };
    const encoded =
      typeof v === 'string'
        ? v
        : Array.isArray(v)
          ? v.map(pack)
          : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, pack(x)]));
    const index = values.length;
    values.push(encoded);
    seen.set(key, index);
    return { $ref: index };
  }
  const state = pack(value);
  return JSON.stringify({ storageSchemaVersion: 3, encoding: 'shared-values-v1', values, state });
}
export function unpackMission(input: unknown): unknown {
  if (!object(input) || !Object.hasOwn(input, 'storageSchemaVersion')) return input;
  requireValid(
    exact(input, ['storageSchemaVersion', 'encoding', 'values', 'state']) &&
      input.storageSchemaVersion === 3 &&
      input.encoding === 'shared-values-v1' &&
      Array.isArray(input.values) &&
      input.values.length <= 10000,
    'Invalid packed mission envelope.',
  );
  const decoded: { value: unknown; weight: number; depth: number }[] = [];
  let nodes = 0;
  function expand(
    v: unknown,
    limit: number,
    depth = 0,
  ): { value: unknown; weight: number; depth: number } {
    requireValid(++nodes <= 50000 && depth <= 40, 'Packed mission exceeds structural bounds.');
    if (object(v) && Object.hasOwn(v, '$ref')) {
      requireValid(
        exact(v, ['$ref']) &&
          Number.isInteger(v.$ref) &&
          Number(v.$ref) >= 0 &&
          Number(v.$ref) < limit,
        'Invalid or cyclic mission reference.',
      );
      return decoded[Number(v.$ref)];
    }
    if (v === null || typeof v !== 'object')
      return { value: v, weight: JSON.stringify(v).length, depth: 0 };
    const parts = Array.isArray(v)
      ? v.map((x) => expand(x, limit, depth + 1))
      : Object.values(v).map((x) => expand(x, limit, depth + 1));
    const weight =
      parts.reduce((n, x) => n + x.weight + 1, 2) +
      (Array.isArray(v) ? 0 : Object.keys(v).reduce((n, k) => n + k.length + 3, 0));
    const height = 1 + Math.max(0, ...parts.map((p) => p.depth));
    requireValid(weight <= 2000000 && height <= 40, 'Expanded mission exceeds bounds.');
    return {
      value: Array.isArray(v)
        ? parts.map((p) => p.value)
        : Object.fromEntries(Object.keys(v).map((k, i) => [k, parts[i].value])),
      weight,
      depth: height,
    };
  }
  for (const entry of input.values) decoded.push(expand(entry, decoded.length));
  return expand(input.state, decoded.length).value;
}
