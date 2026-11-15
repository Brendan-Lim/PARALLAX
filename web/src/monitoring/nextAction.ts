export interface MonitoringActionState {
  plan: boolean;
  error: string;
  run: boolean;
  associated: boolean;
  status: string;
  usability?: string;
  unacknowledged: boolean;
}
export function monitoringNextAction(s: MonitoringActionState) {
  if (!s.plan)
    return {
      id: 'designation',
      title: 'Choose heart-rate monitoring',
      why: 'An explicit fictional designation binds replay to this health review.',
    };
  if (s.error)
    return {
      id: 'history',
      title: s.error.toLowerCase().includes('retention')
        ? 'Review retained events and storage capacity'
        : 'Reconcile saved monitoring information',
      why: 'The last operation failed. Existing records and unresolved events are retained; reload before retrying.',
    };
  if (!s.run)
    return {
      id: 'start',
      title: 'Start synthetic wearable replay',
      why: 'Process the actual HR and quality fixture through the commercial-format parser.',
    };
  if (!s.associated)
    return {
      id: 'designation',
      title: 'Review current evidence and monitoring designation',
      why: 'This historical run cannot supply current observations. Use the current designation and start a new associated replay.',
    };
  if (s.unacknowledged)
    return {
      id: 'companion',
      title: 'Review the monitoring interruption',
      why: 'Inspect reported signal conditions and the companion notification. Acknowledgment records receipt, never medical resolution.',
    };
  if (s.usability === 'withheld')
    return {
      id: 'conditions',
      title: 'Inspect reported signal-quality conditions',
      why: 'The retained raw number is withheld. Review acquisition requirements under the applicable authorised procedure; no physical repair is confirmed.',
    };
  if (s.usability === 'uncertain')
    return {
      id: 'conditions',
      title: 'Review missing quality information',
      why: 'Without aligned quality this raw observation cannot supply a usable current value.',
    };
  if (s.status === 'paused')
    return {
      id: 'resume',
      title: 'Resume or inspect historical observations',
      why: 'Paused readings are historical. Continue explicitly in the foreground or inspect the recorded samples.',
    };
  if (['completed', 'stopped'].includes(s.status))
    return {
      id: 'review',
      title: 'Review the recorded monitoring history',
      why: 'The replay is over. Retain interruption and acknowledgment facts in a fictional human review.',
    };
  return {
    id: 'conditions',
    title: 'Inspect context and continue monitoring review',
    why: 'Usable reported quality permits this synthetic reading. It establishes neither good health nor compatibility with the 100 W cycling assessment.',
  };
}
