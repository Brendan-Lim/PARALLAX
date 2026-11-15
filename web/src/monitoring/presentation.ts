/** Display wording for adapter and ledger facts. Pure formatting: no policy or state lives here. */
import type { Ledger, MonitoringEvent, Sample } from './model';

const conditionText: Record<string, string> = {
  'vendor-reported-good-signal': 'Source reports good signal',
  'garment-disconnected': 'Garment disconnected',
  'missing-exact-timestamp-quality': 'No quality value for this sample',
};
export const describeCondition = (c: string) =>
  conditionText[c] ?? c.charAt(0).toUpperCase() + c.slice(1).replaceAll('-', ' ');
export const describeConditions = (cs: readonly string[]) => cs.map(describeCondition).join(', ');

export const usabilityLabel = {
  usable: 'Usable at processing',
  withheld: 'Withheld',
  uncertain: 'Uncertain quality',
} as const;

export function eventTitle(event: MonitoringEvent) {
  if (event.type === 'simulated-external-alert') return 'External review requested';
  if (event.type === 'monitoring-recovery') return 'Usable HR signal resumed';
  return event.reason === 'execution-delay'
    ? 'Replay interrupted by a local delay'
    : 'HR signal interrupted';
}
/** One plain sentence about the source condition behind an event, read from its sample. */
export function eventCondition(event: MonitoringEvent, sample?: Sample) {
  if (event.type === 'simulated-external-alert')
    return 'A PARALLAX-defined simulated upstream source asks for review. It is not a device alarm.';
  if (!sample) return '';
  const o = sample.observation;
  if (event.type === 'monitoring-recovery')
    return `The synthetic source reported usable quality again at ${o.relativeSeconds} s. This is signal recovery, not medical recovery.`;
  if (o.qualityConditions.includes('garment-disconnected'))
    return 'The synthetic source reports a disconnected garment.';
  if (o.originalQualityCode === null)
    return 'The synthetic source sent no quality value for this sample.';
  return `The synthetic source reports: ${describeConditions(o.qualityConditions).toLowerCase()}.`;
}
export function deliveryFacts(data: Ledger, eventId: string) {
  return {
    attempt: data.transitions.find((t) => t.eventId === eventId && t.kind === 'attempt'),
    receipt: data.transitions.find((t) => t.eventId === eventId && t.kind === 'displayed-receipt'),
    ack: data.acknowledgments.find((a) => a.eventId === eventId),
  };
}
export const clock = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(iso)) + ' UTC';
