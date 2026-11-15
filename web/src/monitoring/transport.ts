import { uuid } from '../mission/review';
export const communicationChannel = 'parallax.monitoring.wakeup.v1';
export interface Signal {
  v: 1;
  kind: 'wake' | 'ping' | 'pong';
  sessionId: string;
  runId: string | null;
  from: string;
}
export function validSignal(x: unknown): x is Signal {
  if (!x || typeof x !== 'object') return false;
  const s = x as Signal;
  return (
    Object.keys(x).sort().join(',') === 'from,kind,runId,sessionId,v' &&
    s.v === 1 &&
    ['wake', 'ping', 'pong'].includes(s.kind) &&
    uuid(s.sessionId) &&
    (s.runId === null || uuid(s.runId)) &&
    uuid(s.from)
  );
}
export function connectSignals(receive: (signal: Signal) => void) {
  try {
    const channel = new BroadcastChannel(communicationChannel);
    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (validSignal(event.data)) receive(event.data);
    };
    return { send: (signal: Signal) => channel.postMessage(signal), close: () => channel.close() };
  } catch {
    return null;
  }
}
