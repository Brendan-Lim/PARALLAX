/** Small runtime guards for the mission boundary. No coercion or silent repair. */
export const object = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);
export const exact = (x: Record<string, unknown>, fields: readonly string[]) =>
  Object.keys(x).length === fields.length && fields.every((key) => Object.hasOwn(x, key));
export const text = (x: unknown, max = 160): x is string =>
  typeof x === 'string' && x.trim().length > 0 && x.length <= max;
export const strings = (x: unknown, max = 16): x is string[] =>
  Array.isArray(x) && x.length <= max && x.every((s) => text(s));
export const utc = (x: unknown): x is string => {
  if (typeof x !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(x)) return false;
  const d = new Date(x);
  return Number.isFinite(d.valueOf()) && d.toISOString().replace('.000Z', 'Z') === x;
};
export function requireValid(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
