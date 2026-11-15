import { revealTarget } from '../mission/navigation';
import { useEffect, useRef, useState } from 'react';
import { missionStorageKey, type MissionState } from '../mission/state';
import { uuid } from '../mission/review';
import { bindingMatches, emptyLedger, needsReview, type Ledger } from './model';
import { deliveryAction, ledgerTransaction, persistedMission } from './store';
import { connectSignals } from './transport';
import EventHistory from './EventHistory';
import './monitoring.css';
export default function Companion({
  sessionId: routeSession,
  runId: routeRun,
}: {
  sessionId?: string;
  runId?: string;
}) {
  const [sessionId] = useState(
    () =>
      routeSession ??
      (() => {
        try {
          return persistedMission().sessionId;
        } catch {
          return '';
        }
      })(),
  );
  const [pinnedRun, setPinnedRun] = useState<string | null>(routeRun ?? null);
  const [data, setData] = useState<Ledger>(emptyLedger);
  const [error, setError] = useState('');
  const [lastOwner, setLastOwner] = useState(0);
  const [ownerRun, setOwnerRun] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [broadcastAvailable, setBroadcastAvailable] = useState(true);
  const [visible, setVisible] = useState(document.visibilityState === 'visible');
  const [pending, setPending] = useState(false);
  const [companionId] = useState(() => crypto.randomUUID());
  const bus = useRef<ReturnType<typeof connectSignals>>(null);
  const [missionRaw, setMissionRaw] = useState(() => {
    try {
      return localStorage.getItem(missionStorageKey);
    } catch {
      return null;
    }
  });
  let mission: MissionState | undefined;
  try {
    mission = persistedMission();
  } catch {
    /* Explicit unbound state below. */
  }
  const latest = data.runs.filter((r) => r.basis.sessionId === sessionId).at(-1);
  const run = data.runs.find((r) => r.id === pinnedRun);
  const current =
    !!mission &&
    mission.sessionId === sessionId &&
    !!run &&
    bindingMatches(run, mission) &&
    run.status !== 'stale' &&
    latest?.id === run.id;
  useEffect(() => {
    let disposed = false;
    let refreshing = false;
    async function refresh() {
      if (refreshing) return;
      refreshing = true;
      try {
        const next = await ledgerTransaction();
        if (!disposed) {
          setData(next);
          setError('');
        }
      } catch (e) {
        if (!disposed) setError(e instanceof Error ? e.message : 'Ledger unavailable.');
      } finally {
        refreshing = false;
      }
    }
    bus.current = connectSignals((message) => {
      if (message.sessionId !== sessionId) return;
      if (message.kind === 'pong') {
        setLastOwner(Date.now());
        setOwnerRun(message.runId);
      }
      if (message.kind === 'wake') void refresh();
    });
    setBroadcastAvailable(!!bus.current);
    const ping = () =>
      bus.current?.send({ v: 1, kind: 'ping', sessionId, runId: pinnedRun, from: companionId });
    void refresh();
    ping();
    const timer = setInterval(() => {
      setNow(Date.now());
      void refresh();
      ping();
    }, 1000);
    const visibility = () => {
      setVisible(document.visibilityState === 'visible');
      if (document.visibilityState === 'visible') {
        void refresh();
        ping();
      }
    };
    const storage = () => {
      try {
        setMissionRaw(localStorage.getItem(missionStorageKey));
      } catch {
        setMissionRaw(null);
      }
      void refresh();
    };
    window.addEventListener('storage', storage);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      disposed = true;
      clearInterval(timer);
      window.removeEventListener('storage', storage);
      document.removeEventListener('visibilitychange', visibility);
      bus.current?.close();
      bus.current = null;
    };
  }, [sessionId, pinnedRun, companionId]);
  useEffect(() => {
    if (!pinnedRun && latest && mission?.sessionId === sessionId) {
      queueMicrotask(() => {
        setPinnedRun(latest.id);
        history.replaceState(null, '', `#mission/companion/${sessionId}/${latest.id}`);
      });
    }
  }, [pinnedRun, latest, mission?.sessionId, sessionId]);
  const event = data.events.find(
    (e) =>
      e.runId === run?.id &&
      !data.transitions.some((t) => t.eventId === e.id && t.kind === 'displayed-receipt'),
  );
  useEffect(() => {
    // A foreground receiving render committed. This does not attest that this event card
    // entered the viewport or that a person read it. Hidden documents issue no receipt.
    if (!current || !event || !visible || !run || error) return;
    let cancelled = false;
    const frame = requestAnimationFrame(() => {
      if (
        document.visibilityState !== 'visible' ||
        !document.getElementById('companion-notifications')
      )
        return;
      void deliveryAction(run.id, sessionId, event.id, 'displayed-receipt', companionId)
        .then((next) => {
          if (!cancelled) {
            setData(next);
            bus.current?.send({ v: 1, kind: 'wake', sessionId, runId: run.id, from: companionId });
          }
        })
        .catch((e: Error) => {
          if (!cancelled) setError(e.message);
        });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [event, current, run, sessionId, companionId, visible, error, missionRaw]);
  async function ack(eventId: string) {
    if (!run || !current || pending) return;
    setPending(true);
    try {
      const next = await deliveryAction(run.id, sessionId, eventId, 'ack', companionId);
      setData(next);
      bus.current?.send({ v: 1, kind: 'wake', sessionId, runId: run.id, from: companionId });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Acknowledgment not saved.');
    } finally {
      setPending(false);
    }
  }
  const runEvents = data.events.filter((e) => e.runId === run?.id);
  const awaiting = runEvents.filter(
    (e) => needsReview(e) && !data.acknowledgments.some((a) => a.eventId === e.id),
  );
  const requestedEvent = new URLSearchParams(location.search).get('event');
  const target = data.events.some((e) => e.id === requestedEvent && e.runId === run?.id)
    ? 'event-' + requestedEvent
    : 'companion-title';
  useEffect(() => revealTarget(target), [target]);
  const ownerSeen =
    broadcastAvailable && now - lastOwner < 4500 && ownerRun === (latest?.id ?? null);
  return (
    <div className="m-companion" data-testid="companion">
      <header className="cp-head">
        <p className="m-eyebrow">Crew companion · separate local display</p>
        <h1 id="companion-title" tabIndex={-1}>
          Mission companion
        </h1>
        <p className="cp-mission">
          {mission?.context.astronaut.name ?? 'No saved fictional crew'} · mission{' '}
          {mission?.context.missionId ?? 'unbound'}
        </p>
      </header>
      <div className="cp-status">
        <p
          data-testid="companion-binding"
          className={`cp-chip ${current ? 'is-on' : run ? 'is-stale' : ''}`}
        >
          {!uuid(sessionId) ? (
            'No valid mission binding. Open this surface from the monitoring console.'
          ) : mission?.sessionId !== sessionId ? (
            'Historical mission generation. Old events cannot become active here.'
          ) : !run ? (
            'Waiting for the first monitoring run in this mission.'
          ) : current ? (
            <>Current replay · synthetic source; physical hardware disconnected.</>
          ) : (
            'Historical or stale replay. Receipts and acknowledgment are withheld.'
          )}
        </p>
      </div>
      {latest && pinnedRun !== latest.id && mission?.sessionId === sessionId && (
        <button
          className="s-button"
          onClick={() => {
            setPinnedRun(latest.id);
            setLastOwner(0);
            history.replaceState(null, '', `#mission/companion/${sessionId}/${latest.id}`);
          }}
        >
          Connect to current replay
        </button>
      )}
      {error && (
        <p role="alert" className="mc-error">
          Persistence operation failed: {error} No failed receipt or acknowledgment is confirmed.
        </p>
      )}
      {!run && uuid(sessionId) && mission?.sessionId === sessionId && (
        <div className="cp-waiting">
          <strong>Waiting for the first replay</strong>
          <span>
            Start the synthetic replay in the monitoring console. Events appear here when this tab
            is visible; a hidden tab records no display receipt.
          </span>
        </div>
      )}
      {run && (
        <>
          <p className="cp-summary">
            <strong>
              {runEvents.length === 0
                ? 'No notifications yet'
                : awaiting.length
                  ? `${awaiting.length} of ${runEvents.length} awaiting acknowledgment`
                  : `${runEvents.length} notification${runEvents.length > 1 ? 's' : ''} · all acknowledged or informational`}
            </strong>
          </p>
          <div id="companion-notifications" aria-live="polite" aria-relevant="additions text">
            <EventHistory
              data={data}
              runId={run.id}
              state={mission}
              acknowledge={current && !error ? (id) => void ack(id) : undefined}
              pending={pending}
              variant="companion"
            />
          </div>
          <details className="cp-details">
            <summary>Replay provenance and owner connection</summary>
            <div className="cp-status">
              <p data-testid="owner-connection" className={`cp-chip ${ownerSeen ? 'is-on' : ''}`}>
                {!broadcastAvailable
                  ? 'BroadcastChannel unavailable. Reconciliation uses ledger polling; owner connection unconfirmed.'
                  : ownerSeen
                    ? 'Monitoring owner communication observed.'
                    : 'No current connection to monitoring owner. Events may still be read and acknowledged from the saved ledger.'}
              </p>
            </div>
            <p>
              Replay {run.id}; plan {run.plan.id}; revision {run.planRevision}.
            </p>
            <p>
              {' '}
              <span>
                Replay {run.status}. Fictional context {run.fictionalAt}. Source {run.source} ·{' '}
                {run.fixture}. Absolute acquisition time unknown.
              </span>
            </p>
          </details>
        </>
      )}
      <p className="cp-foot">
        This surface reads the monitoring ledger and writes only event receipts and acknowledgments.
        Physical hardware disconnected. Same origin and browser profile only. Acknowledging records
        a fictional recipient’s notification awareness; it resolves no medical question.
      </p>
      <p className="cp-foot">
        Return to your original PARALLAX tab to continue the guide. This companion does not own
        mission editing. <a href="#mission/health">Open mission review</a>
      </p>
    </div>
  );
}
