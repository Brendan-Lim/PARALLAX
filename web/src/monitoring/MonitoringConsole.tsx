import { revealTarget } from '../mission/navigation';
import { demoMode } from '../mission/demoProfile';
import { EditingNotice } from '../mission/EditingNotice';
import { SourceOverview } from './SourceOverview';
import { ActionRegion } from '../mission/PlanningRequest';
import { monitoringNextAction } from './nextAction';
import { useEffect, useRef, useState } from 'react';
import type { MissionState } from '../mission/state';
import { planCurrency } from '../mission/review';
import {
  bindingMatches,
  currentReplay,
  emptyLedger,
  eventOrigin,
  eventPolicy,
  needsReview,
  retention,
  type Ledger,
} from './model';
import { QualityChart } from './QualityChart';
import { deliveryFacts, describeConditions, eventTitle, usabilityLabel } from './presentation';
import {
  replayAcquisition,
  replayFixtureVersion,
  replayFrames,
  replayRecencyMs,
  replayScheduleMs,
} from './fixture';
import { ReplayController } from './controller';
import { deliveryAction, ledgerTransaction } from './store';
import { connectSignals } from './transport';
import EventHistory from './EventHistory';
import './monitoring.css';
export default function MonitoringConsole({
  state,
  editable,
  isOwner,
}: {
  state: MissionState;
  editable: boolean;
  isOwner: () => boolean;
}) {
  const [data, setData] = useState<Ledger>(emptyLedger);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [lastCompanion, setLastCompanion] = useState(0);
  const [broadcastAvailable, setBroadcastAvailable] = useState(true);
  const controller = useRef<ReplayController | null>(null);
  const operationFailed = useRef(false);
  const bus = useRef<ReturnType<typeof connectSignals>>(null);
  const [ownerId] = useState(() => crypto.randomUUID());
  const legacy = new URLSearchParams(location.search).has('legacy');
  const sessionId = state.sessionId;
  useEffect(() => {
    const changed = (next: Ledger) => {
      setData(next);
      setNow(Date.now());
      setReady(true);
      setError('');
      bus.current?.send({
        v: 1,
        kind: 'wake',
        sessionId,
        runId: controller.current?.runId ?? null,
        from: ownerId,
      });
    };
    const c = new ReplayController(
      state,
      editable,
      changed,
      (failure) => {
        operationFailed.current = true;
        setReady(true);
        setError(
          failure instanceof Error
            ? failure.message
            : 'Monitoring persistence failed. No save confirmed.',
        );
      },
      isOwner,
    );
    controller.current = c;
    void c.recover();
    bus.current = connectSignals((message) => {
      if (message.sessionId !== sessionId) return;
      if (message.kind === 'ping' && c.editable && isOwner()) {
        setLastCompanion(Date.now());
        bus.current?.send({ v: 1, kind: 'pong', sessionId, runId: c.runId, from: ownerId });
      }
      if (message.kind === 'wake')
        void ledgerTransaction()
          .then((next) => {
            if (!closed) {
              c.data = next;
              setData(next);
              setNow(Date.now());
            }
          })
          .catch((e: Error) => setError(e.message));
    });
    setBroadcastAvailable(!!bus.current);
    let closed = false;
    const poll = setInterval(() => {
      setNow(Date.now());
      if (!c.busy)
        void ledgerTransaction()
          .then((next) => {
            if (!closed && !c.busy) {
              c.data = next;
              setData(next);
              setNow(Date.now());
            }
          })
          .catch((e: Error) => {
            if (!closed) setError(e.message);
          });
    }, 1000);
    const timer = setInterval(() => {
      void c.tick();
    }, replayScheduleMs);
    const hide = () => {
      if (
        document.visibilityState !== 'visible' &&
        c.data?.runs.some((r) => r.id === c.runId && r.status === 'active')
      )
        void c.control('pause', 'Page hidden. Resume explicitly in the foreground.');
    };
    document.addEventListener('visibilitychange', hide);
    return () => {
      closed = true;
      c.dispose();
      clearInterval(poll);
      clearInterval(timer);
      document.removeEventListener('visibilitychange', hide);
      bus.current?.close();
      bus.current = null;
    };
    // Recreate on mission generation change only. Current state is updated separately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, ownerId, isOwner]);
  useEffect(() => {
    controller.current?.update(state, editable);
  }, [state, editable]);
  const latestRun = data.runs.filter((r) => r.basis.sessionId === sessionId).at(-1);
  const run = data.runs.find((r) => r.id === selectedRunId) ?? latestRun;
  const viewingLatest = !run || run.id === latestRun?.id;
  const associated = run
    ? viewingLatest && bindingMatches(run, state) && run.status !== 'stale'
    : false;
  const summary = currentReplay(data, associated ? run : undefined, now);
  const samples = data.samples.filter((s) => s.runId === run?.id).sort((a, b) => a.frame - b.frame);
  const plan = state.monitoringPlans.at(-1);
  const currentPlan = plan && planCurrency(plan, state) === 'current';
  async function act(action: (c: ReplayController) => Promise<void>) {
    if (!controller.current || busy) return;
    setBusy(true);
    operationFailed.current = false;
    setError('');
    try {
      await action(controller.current);
      revealTarget(operationFailed.current ? 'mc-error' : 'mc-observation');
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!run || !associated || !editable || error) return;
    const event = data.events.find(
      (e) =>
        e.runId === run.id &&
        !data.transitions.some((t) => t.eventId === e.id && t.kind === 'attempt'),
    );
    if (!event) return;
    let cancelled = false;
    void deliveryAction(run.id, sessionId, event.id, 'attempt', null)
      .then((next) => {
        if (!cancelled) {
          setData(next);
          bus.current?.send({ v: 1, kind: 'wake', sessionId, runId: run.id, from: ownerId });
        }
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [data, run, associated, editable, error, sessionId, ownerId]);
  const runEvents = data.events.filter((e) => e.runId === run?.id);
  const latestObs = summary.latest?.observation;
  const lastUsable = samples.filter((s) => s.observation.usability === 'usable').at(-1);
  const companionSeen = broadcastAvailable && now - lastCompanion < 4500;
  const historical = !summary.current;
  const historicalUsable =
    associated && run?.status === 'paused' && latestObs?.usability === 'usable' && !error;
  const nextAction = monitoringNextAction({
    plan: !!currentPlan,
    error,
    run: !!run,
    associated,
    status: run?.status ?? '',
    usability: latestObs?.usability,
    unacknowledged: runEvents.some(
      (e) => needsReview(e) && !data.acknowledgments.some((a) => a.eventId === e.id),
    ),
  });
  const companionHref = `${location.search}#mission/companion/${run?.basis.sessionId ?? sessionId}${run ? '/' + run.id : ''}`;
  const sameRawWithheld =
    latestObs?.usability === 'withheld' &&
    latestObs.originalQualityCode === 2 &&
    lastUsable?.observation.originalValue === latestObs.originalValue;
  return (
    <section
      className="m-monitor-console"
      aria-labelledby="monitor-console-title"
      data-testid="monitoring-console"
    >
      <header className="mc-head">
        <div>
          <p className="m-eyebrow">Monitoring · synthetic Astroskin-format source</p>
          <h1 id="monitor-console-title" tabIndex={-1}>
            Synthetic HR monitoring console
          </h1>
          <p className="mc-sub">
            Level 1 documented-format compatibility. Physical hardware disconnected. Bounded local
            demonstration; no continuous background medical monitoring.
          </p>
        </div>
        <a className="m-text-action" href="#mission/health">
          Return to health review
        </a>
      </header>
      <p
        data-testid="monitor-designation"
        className={`mc-designation ${currentPlan ? '' : 'is-missing'}`}
      >
        {currentPlan
          ? `Current fictional HR designation ${plan.id}; revision ${state.planRevision}.`
          : 'No current monitoring requirement. Inspect the source or designate a new fictional HR requirement in the watchlist.'}
      </p>
      {!legacy && (
        <details className="mc-source-disclosure" open={!run}>
          <summary>Two simulated sources · wearable HR/quality and stored cycle exercise</summary>
          <SourceOverview
            state={state}
            designated={!!currentPlan}
            status={run ? (associated ? run.status : 'historical or stale') : undefined}
          />
        </details>
      )}
      <EditingNotice editable={editable} />
      {!currentPlan && (
        <section className="m-next-action">
          <div>
            <h2>Choose what to monitor</h2>
            <p>
              Replay requires an explicit fictional heart-rate monitoring designation tied to this
              review. No monitoring plan is created automatically.
            </p>
          </div>
          <a className="s-button" href="#mission/health/designation">
            Designate a heart-rate monitoring requirement
          </a>
        </section>
      )}
      {error && (
        <p
          role="alert"
          id="mc-error"
          tabIndex={-1}
          data-testid="monitor-error"
          className="mc-error"
        >
          Monitoring operation failed: {error} Current value withheld; no failed operation is
          claimed saved. Reload to reconcile before continuing.
        </p>
      )}

      {!legacy && currentPlan && (
        <ActionRegion title={nextAction.title} why={nextAction.why}>
          {nextAction.id === 'designation' ? (
            <a className="s-button" href="#mission/health/designation">
              Review monitoring designation
            </a>
          ) : nextAction.id === 'companion' ? (
            <a className="s-button" href={companionHref} target="_blank" rel="noreferrer">
              Open companion notification
            </a>
          ) : nextAction.id === 'review' ? (
            <a className="s-button" href="#mission/health/review">
              Bring findings into human review
            </a>
          ) : (
            <button
              className="s-button"
              disabled={!editable || busy}
              onClick={() => {
                if (nextAction.id === 'start') document.getElementById('mc-start')?.click();
                else if (nextAction.id === 'resume') void act((c) => c.control('resume'));
                else {
                  const el = document.getElementById(
                    nextAction.id === 'history' ? 'monitor-events-title' : 'mc-observation-detail',
                  );
                  el?.scrollIntoView({ block: 'start' });
                  el?.focus();
                }
              }}
            >
              {nextAction.id === 'start'
                ? 'Start synthetic replay'
                : nextAction.id === 'resume'
                  ? 'Resume replay for review'
                  : 'Inspect monitoring information'}
            </button>
          )}
        </ActionRegion>
      )}
      {!legacy && sameRawWithheld && (
        <section
          className="m-next-action"
          data-testid="quality-consequence"
          id="quality-consequence"
          tabIndex={-1}
        >
          <div>
            <h2>The number stayed the same. Its reliability changed.</h2>
            <p>
              Previously usable: {lastUsable!.observation.originalValue} bpm at{' '}
              {lastUsable!.observation.relativeSeconds} s, historical. New raw observation:{' '}
              {latestObs!.originalValue} bpm; quality code 2 reports garment disconnection. Current
              usable observation is unavailable.
            </p>
            <p>
              PARALLAX withholds the retained number when reported signal quality is unacceptable.
              Inspect the event; no garment repair or medical resolution is inferred.
            </p>
          </div>
        </section>
      )}
      <div className="mc-grid">
        <div className="mc-primary">
          <div
            id="mc-observation"
            tabIndex={-1}
            className={`mc-readout ${summary.current && !error ? 'is-current' : historicalUsable ? 'is-historical' : 'is-unavailable'}`}
          >
            <div
              role="status"
              aria-live="polite"
              aria-atomic="true"
              data-testid="monitor-current"
              className="mc-current"
            >
              <strong>
                {summary.current && !error ? (
                  <>
                    <span className="mc-label">Latest usable replay observation: </span>
                    <span className="mc-value">
                      {summary.current.observation.value}
                      <span className="mc-unit"> bpm</span>
                    </span>
                  </>
                ) : historicalUsable ? (
                  <>
                    <span className="mc-label">Recorded usable observation · historical</span>
                    <span className="mc-value">
                      {latestObs!.value}
                      <span className="mc-unit"> bpm</span>
                    </span>
                    <span className="mc-label">
                      Current usable observation unavailable while paused.
                    </span>
                  </>
                ) : (
                  <>
                    <span className="mc-label">Current usable replay observation </span>
                    <span className="mc-value mc-value-off">unavailable.</span>
                  </>
                )}
              </strong>
              <p className="mc-quality">
                {summary.latest
                  ? `Latest reported quality: ${summary.latest.observation.usability}; mask ${summary.latest.observation.originalQualityCode ?? 'missing'}; ${summary.latest.observation.qualityConditions.join(', ')}. Source relative ${summary.latest.observation.relativeSeconds} s.`
                  : 'No current associated sample.'}
              </p>
            </div>
            <div className="mc-readout-side">
              <span
                className={`m-chip ${
                  !latestObs
                    ? ''
                    : latestObs.usability === 'usable'
                      ? historical
                        ? 'is-historical'
                        : 'is-usable'
                      : latestObs.usability === 'withheld'
                        ? 'is-withheld'
                        : 'is-uncertain'
                }`}
              >
                {!latestObs
                  ? 'No samples yet'
                  : latestObs.usability === 'usable' && historical
                    ? `Replay ${run?.status ?? 'idle'} · sample historical`
                    : `${usabilityLabel[latestObs.usability]} · ${describeConditions(latestObs.qualityConditions)}`}
              </span>
              {!summary.current && lastUsable && (
                <p className="mc-fact">
                  <span>Last usable observation</span>
                  <strong>
                    {lastUsable.observation.value} bpm at {lastUsable.observation.relativeSeconds} s
                  </strong>
                  <em>historical</em>
                </p>
              )}
              {latestObs && latestObs.usability !== 'usable' && (
                <p className="mc-fact is-withheld">
                  <span>
                    {latestObs.usability === 'withheld'
                      ? 'Withheld raw reading'
                      : 'Uncertain raw reading'}
                  </span>
                  <strong>
                    {latestObs.originalValue} bpm at {latestObs.relativeSeconds} s
                  </strong>
                  <em>quality code {latestObs.originalQualityCode ?? 'missing'}</em>
                </p>
              )}
            </div>
            <p className="mc-limit">
              Signal usability only; no health assessment. Paused or completed readings are
              historical.
            </p>
          </div>

          <div className="mc-panel">
            <div className="m-monitor-controls" role="group" aria-label="Replay controls">
              <button
                className="s-button"
                disabled={
                  !ready ||
                  !viewingLatest ||
                  !editable ||
                  !currentPlan ||
                  busy ||
                  !!error ||
                  (!!run && ['active', 'paused'].includes(run.status) && associated)
                }
                id="mc-start"
                onClick={() =>
                  void act(async (c) => {
                    await c.start();
                    if (demoMode)
                      await c.control(
                        'pause',
                        'Guided inspection: observations are historical while paused.',
                      );
                  })
                }
              >
                {run ? 'Restart replay' : 'Start replay'}
              </button>
              <button
                className="s-button s-secondary"
                disabled={!associated || run?.status !== 'active' || busy || !!error || !editable}
                id="mc-pause"
                onClick={() => void act((c) => c.control('pause'))}
              >
                Pause replay
              </button>
              <button
                className="s-button s-secondary"
                disabled={!associated || run?.status !== 'paused' || busy || !!error || !editable}
                onClick={() => void act((c) => c.control('resume'))}
              >
                Resume replay
              </button>
              <button
                className="s-button s-secondary"
                disabled={!associated || run?.status !== 'paused' || busy || !!error || !editable}
                id="mc-next"
                onClick={() => void act((c) => c.next())}
              >
                Next sample
              </button>
              <button
                className="s-button s-secondary"
                disabled={
                  !associated ||
                  !['active', 'paused'].includes(run?.status ?? '') ||
                  busy ||
                  !!error ||
                  !editable
                }
                onClick={() => void act((c) => c.control('stop'))}
              >
                Stop replay
              </button>
            </div>
            <QualityChart
              samples={samples}
              events={runEvents}
              frames={replayFrames.length}
              historical={historical}
            />
            <p
              role="status"
              aria-live="polite"
              aria-atomic="true"
              data-testid="replay-state"
              className="mc-replay-state"
            >
              {run
                ? `Replay ${associated ? run.status : bindingMatches(run, state) ? 'historical run; later replay selected for monitoring' : 'plan stale; historical run'}. Progress ${run.cursor}/${replayFrames.length}. ${run.pauseReason}`
                : 'Source available for synthetic replay. Replay not started.'}
            </p>

            {run?.status === 'paused' && associated && (
              <p className="mc-hint">
                Paused replay shows no current observation. Use Resume replay to continue in the
                foreground, or Next sample to step one source second at a time. Hiding this page
                pauses replay.
              </p>
            )}
          </div>
        </div>

        <aside className="mc-side" aria-labelledby="mc-side-title">
          <h2 id="mc-side-title">Events and companion</h2>
          <p
            data-testid="companion-connection"
            className={`mc-conn ${companionSeen ? 'is-on' : ''}`}
          >
            {!broadcastAvailable
              ? 'BroadcastChannel unavailable. Ledger polling remains available; owner/companion connection unconfirmed.'
              : companionSeen
                ? 'Companion communication observed in this browser profile.'
                : 'Companion disconnected or unconfirmed. Open the companion tab; background contexts may be suspended.'}
          </p>
          <a className="s-button" href={companionHref} target="_blank" rel="noreferrer">
            Open companion in another tab
          </a>
          <p className="m-fine">
            Same browser profile and origin only. Fictional mission {state.context.missionId}.
          </p>
          {runEvents.length === 0 ? (
            <p className="mc-empty">
              No events yet. An event is recorded when usable data becomes unavailable, when it
              resumes, or when you simulate an external review request.
            </p>
          ) : (
            <ol className="mc-attention" aria-label="Latest events for this replay">
              {[...runEvents].reverse().map((e) => {
                const f = deliveryFacts(data, e.id);
                return (
                  <li
                    key={e.id}
                    className={
                      e.type === 'monitoring-recovery' ? 'is-info' : f.ack ? 'is-acked' : 'is-open'
                    }
                  >
                    <strong>{eventTitle(e)}</strong>
                    <span>{eventOrigin(e)}</span>
                    <span>
                      {f.receipt
                        ? 'Display receipt recorded'
                        : f.attempt
                          ? 'Delivery attempted · no receipt'
                          : 'Recorded · not yet delivered'}
                      {' · '}
                      {f.ack
                        ? 'Acknowledged'
                        : needsReview(e)
                          ? 'Not acknowledged'
                          : 'No acknowledgment needed'}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
          <button
            className="s-button s-secondary"
            disabled={
              !associated ||
              busy ||
              !!error ||
              !editable ||
              data.events.some((e) => e.runId === run?.id && e.type === 'simulated-external-alert')
            }
            onClick={() => void act((c) => c.simulateExternal())}
          >
            Simulate external review alert
          </button>
        </aside>
      </div>

      {data.runs.length > 0 && (
        <label className="mc-history">
          Retained replay history
          <select value={selectedRunId} onChange={(event) => setSelectedRunId(event.target.value)}>
            <option value="">Follow latest run in current mission</option>
            {[...data.runs].reverse().map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.createdAt} · {entry.id.slice(0, 8)} ·{' '}
                {entry.basis.sessionId === sessionId ? 'this generation' : 'historical generation'}
              </option>
            ))}
          </select>
        </label>
      )}
      {run && <EventHistory data={data} runId={run.id} state={state} />}
      <div className="m-monitor-table" id="mc-observation-detail" tabIndex={0}>
        <table>
          <caption>
            Sample log · adapter observations · earlier usable readings remain historical
          </caption>
          <thead>
            <tr>
              <th scope="col">Relative time / ticks</th>
              <th scope="col">Original raw HR</th>
              <th scope="col">Quality / use</th>
              <th scope="col">Actual processing time (UTC)</th>
            </tr>
          </thead>
          <tbody>
            {samples.map((s) => (
              <tr key={s.id} className={`is-${s.observation.usability}`}>
                <td>
                  {s.observation.relativeSeconds} s / {s.observation.originalTicks}
                </td>
                <td>{s.observation.originalValue} bpm</td>
                <td>
                  {s.observation.originalQualityCode ?? 'missing'} · {s.observation.usability}
                  <br />
                  {s.observation.qualityConditions.join(', ')}
                </td>
                <td>{s.observation.receivedAt}</td>
              </tr>
            ))}
            {samples.length === 0 && (
              <tr>
                <td colSpan={4}>No samples processed for this run.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <details className="m-details">
        <summary>How source time, processing time and recency work</summary>
        <p>
          Source ticks are relative 1/256-second units. Absolute acquisition time and physiological
          freshness are unknown. Processing time is local execution time. Replay advances one source
          second per {replayScheduleMs / 1000} local seconds; recency expires after{' '}
          {replayRecencyMs / 1000} seconds of execution delay. Paused, stopped and completed
          observations are historical. Good reported signal quality does not establish good health.
          Activity and workload are unknown for this replay; it is not resting HR and is separate
          from the cycling assessment.
        </p>
        {run && (
          <p className="m-fine">
            Run {run.id} · session {run.basis.sessionId} · plan {run.plan.id} · adapter{' '}
            {run.adapter} · source {run.source} · fixture {run.fixture} · {eventPolicy}
          </p>
        )}
      </details>
      <details className="m-details">
        <summary>Inspect replay source and persisted parser output</summary>
        <p>
          This is an independently authored coherent relative-clock recording. The Phase 4 finite
          batches are separate alternatives. Commercial JSON is parsed through ingestAstroskin
          before persistence.
        </p>
        <pre tabIndex={0}>
          {JSON.stringify(
            {
              fixture: replayFixtureVersion,
              acquisition: replayAcquisition,
              frames: replayFrames.map((raw) => JSON.parse(raw) as unknown),
            },
            null,
            2,
          )}
        </pre>
        <pre tabIndex={0} data-testid="monitor-ledger-json">
          {JSON.stringify(data, null, 2)}
        </pre>
        <p>
          Retention: {retention.runs} runs; {retention.samplesPerRun} samples/run;{' '}
          {retention.rawBytes} raw bytes; {retention.events} events; {retention.transitions}{' '}
          delivery transitions; {retention.acknowledgments} acknowledgments. Old inactive runs with
          acknowledged events included in retained human reviews may leave live history; saved
          snapshots remain. Full retention pauses new work; unresolved notifications are retained.
        </p>
      </details>
    </section>
  );
}
