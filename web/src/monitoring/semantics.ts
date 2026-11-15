import type { MonitoringEvent } from './model';
export function eventMeaning(event: MonitoringEvent) {
  if (event.type === 'simulated-external-alert')
    return 'External monitoring alert — review requested. Fictional PARALLAX-defined upstream simulation; no hardware or official Astroskin alarm protocol.';
  if (event.type === 'monitoring-recovery')
    return 'Usable synthetic observations resumed. Earlier notifications and human-review requirements remain recorded.';
  return event.reason === 'execution-delay'
    ? 'PARALLAX reports a monitoring interruption: local replay execution was delayed or the local clock changed. No measurements were invented for the gap.'
    : 'PARALLAX reports a monitoring interruption: the latest synthetic sample has missing or invalid aligned quality. Current usable observation unavailable.';
}
export const eventOrigin = (event: MonitoringEvent) =>
  event.type === 'simulated-external-alert'
    ? 'PARALLAX simulated upstream source'
    : 'PARALLAX monitoring availability';
export const needsReview = (event: MonitoringEvent) => event.type !== 'monitoring-recovery';
