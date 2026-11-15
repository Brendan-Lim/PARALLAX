import { PostReviewActions } from './PostReviewActions';
import type { MissionDispatch } from './writer';
import { revealTarget } from './navigation';
import { EditingNotice } from './EditingNotice';
import { canonical, evidenceIdentity } from './identity';
import { monitoringSnapshot, type MonitoringSnapshot } from '../monitoring/snapshot';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
const DeviceDemo = lazy(() => import('../devices/DeviceDemo'));
import type { MissionState } from './state';
import { healthInterpretations, interpretationSources, reviewOrderLabels } from './interpretation';
import {
  dispositions,
  humanPriorities,
  planAvailability,
  planCurrency,
  availableReviewReasons,
  fictionalReviewer,
  type Disposition,
  type HumanPriority,
  type ReviewReason,
} from './review';
import { currencyLabels, handoffDocument, handoffHtml } from './handoff';
import { channelContracts, channelSource } from './channels';
import { reviewStatus } from './identity';
import { missionOverview } from './overview';
import { signed } from '../core/engine';

const evidenceTone: Record<string, string> = {
  supported: 'is-supported',
  missing: 'is-missing',
  excluded: 'is-withheld',
  incompatible: 'is-historical',
  unresolved: 'is-unresolved',
  'historical-reference': 'is-historical',
};
function download(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function HealthReview({
  state,
  dispatch,
  editable,
  storageFailed = false,
}: {
  state: MissionState;
  dispatch: MissionDispatch;
  editable: boolean;
  storageFailed?: boolean;
}) {
  const overview = missionOverview(state);
  const comparison = overview.exerciseComparison;
  const [saveResult, setSaveResult] = useState<{ id: string | null; persisted: boolean } | null>(
    null,
  );
  const revealedResult = useRef<typeof saveResult>(null);
  const findings = healthInterpretations(state);
  const [disposition, setDisposition] = useState<Disposition>('findings-reviewed');
  const [reasons, setReasons] = useState<ReviewReason[]>([]);
  const [priority, setPriority] = useState<HumanPriority>('routine-review');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [action, setAction] = useState('');
  const [sourceOpen, setSourceOpen] = useState(false);
  const [designationAttempt, setDesignationAttempt] = useState(false);
  const [monitoring, setMonitoring] = useState<MonitoringSnapshot | undefined>();
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let closed = false;
    async function refresh() {
      try {
        const { ledgerTransaction } = await import('../monitoring/store');
        const data = await ledgerTransaction();
        if (!closed)
          setMonitoring((previous) => {
            const next = monitoringSnapshot(data, state.sessionId);
            return previous &&
              canonical({ ...previous, cutoff: '' }) === canonical({ ...next, cutoff: '' })
              ? previous
              : next;
          });
      } catch {
        if (!closed)
          setMonitoring((previous) =>
            previous?.availability === 'unavailable'
              ? previous
              : monitoringSnapshot(null, state.sessionId),
          );
      }
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 1000);
    return () => {
      closed = true;
      clearInterval(timer);
    };
  }, [state.sessionId]);
  const allowedReasons = availableReviewReasons(state, monitoring);
  const visibleReasons = reasons.filter((r) => Object.hasOwn(allowedReasons, r));
  const currentPlan = state.monitoringPlans.find((p) => planCurrency(p, state) === 'current');
  const latestReview = state.reviews.at(-1);
  const recorded = !!saveResult?.id && latestReview?.id === saveResult.id;
  const selected = state.reviews.find((r) => r.id === selectedId) ?? latestReview;
  // This object is the sole source of the preview and both downloaded files.
  const doc = useMemo(
    () =>
      selected ? handoffDocument(selected, state, new Date().toISOString(), monitoring) : undefined,
    [selected, state, monitoring],
  );
  useEffect(() => {
    if (!saveResult || revealedResult.current === saveResult) return;
    revealedResult.current = saveResult;
    const success =
      saveResult.persisted && !storageFailed && state.reviews.some((r) => r.id === saveResult.id);
    revealTarget(success ? 'm-handoff-title' : 'm-review-status');
  }, [saveResult, state.reviews, storageFailed]);
  return (
    <section
      className="m-health-review"
      aria-labelledby="m-interpretation-title"
      data-testid="health-interpretation"
    >
      <p className="m-eyebrow">Understand the observations</p>
      <h2 id="m-interpretation-title" tabIndex={-1}>
        Health interpretation and watchlist
      </h2>
      <p>
        The watchlist connects recorded evidence and unanswered questions to the upcoming activity.
        Its order describes review needs. It makes no diagnosis or clinical triage decision.
      </p>
      <ol className="m-watchlist" aria-label="Mission health watchlist">
        {findings.map((f) => (
          <li key={f.id} data-testid={`watch-${f.id}`}>
            <article>
              <div className="m-watch-key">
                <p className="m-eyebrow">{reviewOrderLabels[f.priority]}</p>
                <h3>{f.domain}</h3>
                <WatchFigure
                  id={f.id}
                  comparison={comparison}
                  figure={
                    f.evidenceStatus === 'supported' && ['aerobic', 'sleep'].includes(f.id)
                      ? f.recordedObservation.split(';')[0]
                      : undefined
                  }
                  excluded={f.evidenceStatus === 'excluded'}
                />
                <span className={`m-chip ${evidenceTone[f.evidenceStatus] ?? ''}`}>
                  {f.evidenceStatus === 'supported' ? (
                    <i className="m-mark is-ok" aria-hidden="true" />
                  ) : f.evidenceStatus === 'historical-reference' ||
                    f.evidenceStatus === 'incompatible' ? (
                    <i className="m-mark is-hist" aria-hidden="true" />
                  ) : (
                    <i className="m-mark is-open" aria-hidden="true" />
                  )}
                  {f.evidenceStatus.replaceAll('-', ' ')}
                </span>
              </div>
              <div className="m-watch-body">
                {f.id === 'cardiovascular' && comparison && (
                  <p>Recorded between comparable cycling sessions at 100 W.</p>
                )}
                <p>
                  <strong>{f.meaning}</strong>
                </p>
                <p>{f.recordedObservation}</p>
                <p className="m-fine">{f.limitation}</p>
                <a
                  onClick={(event) => {
                    if (!overview.rich || !['aerobic', 'sleep'].includes(f.id)) return;
                    const details = document.querySelector<HTMLDetailsElement>(
                      `[data-testid="rich-${f.id === 'aerobic' ? 'vo2peak' : 'reported-sleep-duration'}"] details`,
                    );
                    if (details) {
                      event.preventDefault();
                      details.open = true;
                      details.scrollIntoView({ block: 'start', behavior: 'instant' });
                      details.querySelector('summary')?.focus();
                    }
                  }}
                  className="m-text-action"
                  href={
                    f.id === 'functional'
                      ? '#mission/surface'
                      : f.id === 'cardiovascular' && comparison
                        ? '#mission/health/designation'
                        : f.id === 'musculoskeletal'
                          ? '#mission/health/assessments/force'
                          : '#mission/health/assessments'
                  }
                >
                  {f.id === 'functional'
                    ? 'Plan the surface assessment'
                    : f.id === 'cardiovascular'
                      ? comparison
                        ? 'Set up heart-rate monitoring'
                        : 'Inspect the exercise archive'
                      : f.id === 'aerobic'
                        ? 'Review gas-analysis records'
                        : f.id === 'sleep'
                          ? 'Review the diary context'
                          : 'Review force assessment requirements'}
                </a>
                <p className="m-evidence-label">
                  Evidence: {f.evidenceStatus.replaceAll('-', ' ')} ·{' '}
                  {f.concernBasis.replaceAll('-', ' ')}
                </p>
                <p className="m-priority">Why here: {f.priorityReason}</p>
                <details className="m-details">
                  <summary>Why {f.domain.toLowerCase()} matters</summary>
                  <dl className="m-option-resources">
                    <dt>Scientific relevance</dt>
                    <dd>{f.scientificRelevance}</dd>
                    <dt>Upcoming activity</dt>
                    <dd>{f.missionRelevance}</dd>
                    <dt>What remains unknown</dt>
                    <dd>{f.unresolvedInformation}</dd>
                    <dt>Interpretation limit</dt>
                    <dd>{f.limitation}</dd>
                    <dt>Review action</dt>
                    <dd>{f.reviewAction}</dd>
                    <dt>Monitoring relationship</dt>
                    <dd>{f.monitoringRelationship}</dd>
                    <dt>Potential source</dt>
                    <dd>{f.potentialSource}</dd>
                    <dt>Monitoring limit</dt>
                    <dd>{f.monitoringLimitation}</dd>
                  </dl>
                  {f.sourceIds.map((id) => {
                    const s = interpretationSources.find((source) => source.id === id)!;
                    return (
                      <div className="m-source-rationale" key={id}>
                        <a href={s.url} target="_blank" rel="noreferrer">
                          {s.reference}
                        </a>
                        <p className="m-fine">
                          {s.locator}. {s.population} {s.boundary}
                        </p>
                      </div>
                    );
                  })}
                </details>
              </div>
            </article>
          </li>
        ))}
      </ol>
      <section
        className="m-monitor-plan"
        aria-labelledby="m-monitor-plan-title"
        data-testid="monitoring-plan"
      >
        <h3 id="m-monitor-plan-title">Prepare a future monitoring requirement</h3>
        <p>
          Heart-rate observations could contribute context for cardiovascular review. Research
          relevance alone does not instruct this astronaut to monitor. The fixed fictional reviewer
          can designate this bounded requirement.
        </p>
        <p>
          <span className={`m-chip ${currentPlan ? 'is-supported' : ''}`}>
            {currentPlan ? (
              <i className="m-mark is-ok" aria-hidden="true" />
            ) : (
              <i className="m-mark is-open" aria-hidden="true" />
            )}
            <strong>
              {currentPlan
                ? 'Fictional monitoring requirement designated'
                : 'Monitoring candidate identified'}
            </strong>
          </span>
        </p>
        {!currentPlan && state.monitoringPlans.length > 0 && (
          <p className="m-unresolved-context" role="note">
            <strong>
              <i className="m-mark is-warn" aria-hidden="true" /> Earlier designation is stale
            </strong>
            <span>
              The evidence or mission context changed after the last designation, so it no longer
              applies to this review. It stays in the history below. Designate again to monitor the
              current evidence.
            </span>
          </p>
        )}
        <dl className="m-plan-props">
          <dt>Quantity</dt>
          <dd>Heart rate, bpm (device channel 19, quality channel 1000)</dd>
          <dt>Why it is relevant</dt>
          <dd>
            {comparison
              ? `The cycling records support ${signed(comparison.absolute)} ${comparison.changeUnit} at the same workload. Heart rate adds context for cardiovascular review; it sets no alarm threshold.`
              : 'Heart rate adds context for cardiovascular review. No exercise comparison is supported yet.'}
          </dd>
          <dt>Designated by</dt>
          <dd>
            {currentPlan
              ? `${currentPlan.designatedBy} · ${currentPlan.createdAtLocal}`
              : `Not yet designated. Only ${fictionalReviewer} can designate it in this scenario.`}
          </dd>
          <dt>Source availability</dt>
          <dd>
            Synthetic documented-format source available. Physical hardware is disconnected. Open
            the monitoring console for replay state and event history.
          </dd>
          <dt>Cannot establish</dt>
          <dd>Aerobic capacity, post-landing mobility, diagnosis or fitness to land.</dd>
        </dl>
        <details className="m-details">
          <summary>Observation source, required context and limits</summary>
          <p>
            Observe: heart rate in bpm for cardiovascular review. Potential source: commercial
            Astroskin documented HR channel 19 with quality channel 1000. A separate synthetic
            format demonstration is available; live and recorded sources remain unavailable.
          </p>
          <p>{channelContracts[0].context}</p>
          <p>{channelContracts[0].limitation}</p>
          <p>No personalised thresholds or automatic alarms are defined.</p>
          <a href={channelSource.url} target="_blank" rel="noreferrer">
            {channelSource.reference}
          </a>
          <p className="m-fine">{channelSource.boundary}</p>
        </details>
        <EditingNotice editable={editable} />
        {(currentPlan || designationAttempt) && (
          <p id="m-designation-status" tabIndex={-1} role="status">
            {currentPlan
              ? storageFailed
                ? 'Designation recorded in memory only. Restore storage before continuing.'
                : 'Fictional heart-rate monitoring requirement designated. Monitoring has not started.'
              : 'Designation was not recorded. Check editing ownership and saved evidence before retrying.'}
          </p>
        )}
        <div className="m-plan-actions">
          <button
            id="m-designate"
            className="s-button"
            disabled={!editable || !!currentPlan}
            onClick={() => {
              dispatch({ type: 'designate-monitoring' });
              setDesignationAttempt(true);
              revealTarget('m-designation-status');
            }}
          >
            {currentPlan
              ? 'Requirement designated for this evidence'
              : 'Designate fictional HR monitoring requirement'}
          </button>
          <a
            className={currentPlan ? 's-button' : 's-button s-secondary'}
            href="#mission/monitoring"
          >
            Open monitoring console
          </a>
        </div>
        <button
          className="m-text-action"
          aria-expanded={sourceOpen}
          aria-controls="mission-device-source"
          onClick={() => setSourceOpen(!sourceOpen)}
        >
          {sourceOpen ? 'Close documented-format source' : 'Open documented-format source'}
        </button>
        {sourceOpen && (
          <div id="mission-device-source">
            <Suspense fallback={<p role="status">Opening synthetic source…</p>}>
              <DeviceDemo state={state} editable={editable} />
            </Suspense>
          </div>
        )}
        {state.monitoringPlans.length > 0 && (
          <details className="m-details" data-testid="plan-history">
            <summary>Monitoring designation history ({state.monitoringPlans.length})</summary>
            {state.monitoringPlans.map((p) => (
              <article key={p.id}>
                <h4>Heart-rate review · {planCurrency(p, state)}</h4>
                <ul>
                  {planAvailability(p, state).map((s) => (
                    <li key={s}>
                      {s === 'Monitoring not yet started'
                        ? monitoring?.run?.plan.id === p.id
                          ? `Synthetic replay ${monitoring.run.status}; inspect the console for history. Physical hardware disconnected.`
                          : 'No replay included for this designation in the latest-run lookup. Physical hardware disconnected.'
                        : s}
                    </li>
                  ))}
                </ul>
                <p>
                  {p.designatedBy} · local creation {p.createdAtLocal} · fictional time{' '}
                  {p.fictionalAt}
                </p>
                <p className="m-fine">
                  {p.id} · session {p.basis.sessionId} · {p.basis.fingerprint}
                </p>
              </article>
            ))}
          </details>
        )}
      </section>
      <section
        className="m-fictional-review"
        aria-labelledby="m-fictional-review-title"
        data-testid="fictional-review"
      >
        <h3 id="m-fictional-review-title" tabIndex={-1}>
          Bring the findings together. Record a fictional human review
        </h3>
        <p>
          {fictionalReviewer}. This demo role is hypothetical and authenticates no clinician or
          mission authority. Choose workflow selections after inspecting the findings, watchlist,
          missing requirements and monitoring candidates above.
        </p>
        <p id="m-review-status" role="status" aria-live="polite" aria-atomic="true" tabIndex={-1}>
          {action && (
            <>
              {action === 'review-attempt'
                ? recorded
                  ? storageFailed
                    ? 'Fictional review recorded in memory only; reload may lose it.'
                    : 'Fictional review recorded through its monitoring cutoff. Unresolved requirements retained.'
                  : 'Review was not recorded. Existing snapshots retained; reconcile saved information before retrying.'
                : action}{' '}
            </>
          )}
          {reviewStatus(state)}
        </p>
        {action && saveResult && (!saveResult.persisted || storageFailed) && (
          <p>
            Keep your selections. Reconcile saved information, then{' '}
            <button className="m-text-action" onClick={() => location.reload()}>
              Reload saved mission
            </button>{' '}
            before retrying.
          </p>
        )}
        <ReviewSummary
          state={state}
          comparison={comparison ? `${signed(comparison.absolute)} ${comparison.changeUnit}` : null}
          monitoring={monitoring}
        />
        <EditingNotice editable={editable} />
        <p className="m-fine">
          {!editable
            ? 'Editing ownership is required to save.'
            : saving
              ? 'Saving the review and its monitoring cutoff…'
              : visibleReasons.length === 0
                ? 'Select at least one review reason to enable Save.'
                : 'Ready to record your fictional review.'}
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (saving) return;
            setSaving(true);
            setSaveResult(null);
            setAction('');
            const previousId = latestReview?.id ?? '';
            const expectedIdentity = canonical({
              basis: evidenceIdentity(state),
              plans: state.monitoringPlans,
              revision: state.planRevision,
            });
            void (async () => {
              let snapshot: MonitoringSnapshot;
              try {
                const { ledgerTransaction } = await import('../monitoring/store');
                snapshot = monitoringSnapshot(await ledgerTransaction(), state.sessionId);
              } catch {
                snapshot = monitoringSnapshot(null, state.sessionId);
              }
              const result = dispatch({
                type: 'save-review',
                selection: { disposition, reasons: visibleReasons, priority },
                monitoring: snapshot,
                expectedIdentity,
              });
              setMonitoring(snapshot);
              const created = result?.state.reviews.at(-1);
              const id = created && created.id !== previousId ? created.id : null;
              setSelectedId(id);
              setSaveResult({ id, persisted: !!id && !!result?.persisted });
              setAction('review-attempt');
            })()
              .catch((error: unknown) => {
                setAction(error instanceof Error ? error.message : 'Review could not be saved.');
                setSaveResult({ id: null, persisted: false });
              })
              .finally(() => setSaving(false));
          }}
        >
          <fieldset disabled={!editable || saving}>
            <legend>Fictional review workflow</legend>
            <label htmlFor="m-disposition">Disposition</label>
            <select
              id="m-disposition"
              value={disposition}
              onChange={(e) => setDisposition(e.target.value as Disposition)}
            >
              {Object.entries(dispositions).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
            <p data-testid="selected-disposition">
              Selected disposition: {dispositions[disposition]}
            </p>
            <fieldset>
              <legend>Review reasons (select at least one)</legend>
              {Object.entries(allowedReasons).map(([id, label]) => (
                <label className="m-check" key={id}>
                  <input
                    type="checkbox"
                    checked={reasons.includes(id as ReviewReason)}
                    onChange={(e) =>
                      setReasons((previous) =>
                        e.target.checked
                          ? [...previous, id as ReviewReason]
                          : previous.filter((r) => r !== id),
                      )
                    }
                  />
                  {label}
                </label>
              ))}
            </fieldset>
            <label htmlFor="m-human-priority">Priority selected by the fictional reviewer</label>
            <select
              id="m-human-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as HumanPriority)}
            >
              {Object.entries(humanPriorities).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
            <p className="m-fine">
              This records a fictional review action. No medical or mission clearance is provided.
            </p>
            <button className="s-button" type="submit" disabled={visibleReasons.length === 0}>
              Save fictional review
            </button>
          </fieldset>
        </form>
        <p className="m-fine">
          Local history retains the latest five reviews and five designations, including earlier
          sessions. Older entries are removed when this bound is exceeded. Removed so far:{' '}
          {state.droppedHistory.reviews} reviews and {state.droppedHistory.plans} designations.
          Download a handoff to keep a separate copy.
        </p>
      </section>
      {doc && (
        <section
          className="m-handoff"
          aria-labelledby="m-handoff-title"
          data-testid="mission-handoff"
        >
          <div className="m-handoff-title">
            {recorded &&
            saveResult?.persisted &&
            !storageFailed &&
            selected === latestReview &&
            doc.currency === 'current-review' ? (
              <>
                <i className="m-mark is-ok" aria-hidden="true" />
                <h3 id="m-handoff-title" tabIndex={-1}>
                  Review saved
                </h3>
              </>
            ) : (
              <h3 id="m-handoff-title" tabIndex={-1}>
                {recorded && storageFailed && selected === latestReview
                  ? 'Review recorded in memory only'
                  : doc.currency === 'current-review'
                    ? 'Saved review snapshot'
                    : 'Saved review snapshot · historical'}
              </h3>
            )}
          </div>
          {storageFailed && (
            <p role="alert">
              This browser could not store the review. It exists in this page only; download the
              handoff to keep a copy.
            </p>
          )}
          <PostReviewActions
            state={state}
            monitoring={monitoring}
            reviewNotice={
              selected !== latestReview
                ? 'A later saved review is available in the selector below.'
                : doc.currency === 'current-review' &&
                    !doc.monitoringUpdate?.newSamples &&
                    !doc.monitoringUpdate?.newEventIds.length &&
                    !doc.monitoringUpdate?.newAcknowledgments
                  ? ''
                  : 'Updated review needed: the selected snapshot does not cover the current evidence or monitoring.'
            }
            durable={!storageFailed}
          />
          <dl className="m-handoff-meta">
            <div>
              <dt>Review ID</dt>
              <dd>{selected!.id}</dd>
            </div>
            <div>
              <dt>Recorded locally</dt>
              <dd>{selected!.createdAtLocal}</dd>
            </div>
            <div>
              <dt>Monitoring cutoff</dt>
              <dd>
                {selected!.monitoring
                  ? selected!.monitoring.cutoff
                  : 'No monitoring snapshot in this review'}
              </dd>
            </div>
            <div>
              <dt>Disposition (fictional reviewer)</dt>
              <dd>{dispositions[selected!.disposition]}</dd>
            </div>
            <div>
              <dt>Clearance</dt>
              <dd>None. This records a review, not a medical decision.</dd>
            </div>
          </dl>
          <label htmlFor="m-review-history">Saved review snapshot</label>
          <select
            id="m-review-history"
            value={selected!.id}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {[...state.reviews].reverse().map((r) => (
              <option key={r.id} value={r.id}>
                {r.createdAtLocal} · {dispositions[r.disposition]} · {r.id.slice(0, 8)}
              </option>
            ))}
          </select>
          <p
            role="status"
            data-testid="review-currency"
            className={doc.currency === 'current-review' ? undefined : 'is-stale'}
          >
            <strong>{currencyLabels[doc.currency]}</strong> {doc.monitoringUpdate?.message}
          </p>
          <p>
            Saved findings are software-generated. The disposition belongs to the fictional demo
            reviewer. A saved snapshot retains its original contents as evidence changes; the
            handoff states its currency against the current mission.
          </p>
          <p>
            <strong>Available to download and share.</strong> It preserves your available
            observations, acquisition context, unresolved requirements and monitoring history for
            qualified review.
          </p>
          <div className="m-handoff-actions">
            <button
              className="s-button"
              onClick={() =>
                download(
                  handoffHtml(doc),
                  `PARALLAX-mission-review-${selected!.id}.html`,
                  'text/html;charset=utf-8',
                )
              }
            >
              Download mission review
            </button>
            <button
              className="s-button s-secondary"
              onClick={() =>
                download(
                  JSON.stringify(doc, null, 2),
                  `PARALLAX-mission-review-${selected!.id}.json`,
                  'application/json',
                )
              }
            >
              Download review JSON
            </button>
          </div>
          <details className="m-details" data-testid="handoff-preview">
            <summary>Preview the handoff document</summary>
            {doc.sections.map((s) => (
              <section key={s.heading}>
                <h4>{s.heading}</h4>
                {s.lines.map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </section>
            ))}
          </details>
        </section>
      )}
    </section>
  );
}

function WatchFigure({
  id,
  comparison,
  figure,
  excluded,
}: {
  id: string;
  comparison?: { absolute: number; changeUnit: string };
  figure?: string;
  excluded: boolean;
}) {
  if (figure) return <span className="m-watch-figure">{figure}</span>;
  if (excluded) return <span className="m-watch-figure is-empty">Excluded reference</span>;
  if (id === 'cardiovascular')
    return comparison ? (
      <span className="m-watch-figure">
        {signed(comparison.absolute)} {comparison.changeUnit}
      </span>
    ) : (
      <span className="m-watch-figure is-empty">No supported change</span>
    );
  if (id === 'musculoskeletal')
    return (
      <span className="m-watch-figure">
        1,000 N<span className="sr-only"> historical preflight reference</span>
      </span>
    );
  return (
    <span className="m-watch-figure is-empty">
      {id === 'functional' ? 'Unresolved' : 'Not established'}
    </span>
  );
}

/** GOV.UK check-answers pattern: everything the reviewer is about to record, with a way back. */
function ReviewSummary({
  state,
  comparison,
  monitoring,
}: {
  state: MissionState;
  comparison: string | null;
  monitoring?: MonitoringSnapshot;
}) {
  const unresolved = healthInterpretations(state).filter((f) => f.evidenceStatus !== 'supported');
  const samples = monitoring?.samples ?? [];
  const events = monitoring?.events ?? [];
  const count = (u: string) => samples.filter((x) => x.usability === u).length;
  const receipts =
    monitoring?.transitions.filter((t) => t.kind === 'displayed-receipt').length ?? 0;
  const acks = monitoring?.acknowledgments.length ?? 0;
  const findings = healthInterpretations(state);
  const rows: [string, string, string, string][] = [
    ...findings
      .filter((f) => ['aerobic', 'sleep', 'musculoskeletal'].includes(f.id))
      .map(
        (f) =>
          [
            f.domain,
            f.recordedObservation + ' ' + f.meaning,
            '#mission/health/watchlist',
            'Inspect finding',
          ] as [string, string, string, string],
      ),
    [
      'Recorded observations',
      comparison
        ? `Exercise HR ${comparison} between 15 and 28 June at 100 W (two sessions)`
        : 'Exercise change unestablished; no supported comparison',
      '#mission/health/assessments',
      'Change records',
    ],
    [
      'Unresolved requirements',
      unresolved.map((f) => f.domain).join(' · ') || 'None listed',
      '#mission/health/watchlist',
      'Inspect watchlist',
    ],
    [
      'Monitoring record',
      monitoring?.run
        ? `${samples.length} synthetic samples · replay ${monitoring.run.status} · ${count('usable')} usable, ${count('withheld')} withheld, ${count('uncertain')} uncertain`
        : 'No synthetic replay recorded for this mission',
      '#mission/monitoring',
      'Open console',
    ],
    [
      'Events',
      events.length
        ? [
            ['monitoring-interruption', 'interruption'],
            ['monitoring-recovery', 'recovery'],
            ['simulated-external-alert', 'simulated external alert'],
          ]
            .map(([t, label]) => [events.filter((e) => e.type === t).length, label] as const)
            .filter(([n]) => n > 0)
            .map(([n, label]) => `${n} ${label}${n > 1 ? 's' : ''}`)
            .join(' · ')
        : 'No monitoring events',
      '#mission/monitoring',
      'Inspect events',
    ],
    [
      'Delivery',
      events.length
        ? `${receipts} of ${events.length} display receipts · ${acks} acknowledgment${acks === 1 ? '' : 's'}`
        : 'Nothing to deliver',
      '#mission/monitoring',
      'Inspect delivery',
    ],
  ];
  return (
    <dl className="m-summary-list" aria-label="What this review will record">
      {rows.map(([label, value, href, action]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
          <dd>
            <a href={href}>
              {action}
              <span className="sr-only"> for {label.toLowerCase()}</span>
            </a>
          </dd>
        </div>
      ))}
    </dl>
  );
}
