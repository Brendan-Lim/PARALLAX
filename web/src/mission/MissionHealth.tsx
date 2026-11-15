import type { MissionDispatch } from './writer';
import { revealTarget } from './navigation';
import { RichObservations } from './RichObservations';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, ChevronRight } from 'lucide-react';
import { formatNumber, signed } from '../core/engine';
import { missionOverview } from './overview';
import { AssessmentPlanner, focusPlannerHeading } from './Planner';
import { SourceRecords } from './Records';
import { followupRecordId } from './archive';
import { PairedObservationChart } from './PairedObservationChart';
import type { MissionState } from './state';
import type { MissionSection, SectionRequest } from './Mission';
const HealthReview = lazy(() => import('./HealthReview'));

const shortDate = (value: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
    new Date(value),
  );

export default function MissionHealth({
  state,
  dispatch,
  storageFailed,
  editable,
  request,
  onSectionChange,
}: {
  state: MissionState;
  dispatch: MissionDispatch;
  storageFailed: boolean;
  editable: boolean;
  request: SectionRequest;
  onSectionChange: (section: MissionSection) => void;
}) {
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const model = missionOverview(state);
  const { context } = state;
  const c = model.exerciseComparison;
  const surface = context.phase === 'surface';
  const excluded = state.excludedRecordIds.includes(followupRecordId);
  const included = state.includedRecordIds.includes(followupRecordId);
  const baseline = model.records
    .filter((r) => r.measurement === 'exercise-hr' && r.id !== followupRecordId)
    .at(0);
  const phaseLabel =
    context.phase === 'approach'
      ? 'Approach to Mars'
      : surface
        ? 'Mars surface'
        : context.phase === 'transit'
          ? 'Microgravity transit'
          : 'Earth preflight';
  const openPlanner = () => {
    setPlannerOpen(true);
    onSectionChange('assessments');
    focusPlannerHeading();
  };
  const openHealthReview = (
    focus: 'watchlist' | 'review' | 'designation' | 'saved' | 'actions' = 'watchlist',
  ) => {
    onSectionChange(focus);
    revealTarget(
      (focus === 'saved' || focus === 'actions') && state.reviews.length
        ? focus === 'saved'
          ? 'm-handoff-title'
          : 'm-health-actions-title'
        : focus === 'review' || focus === 'saved' || focus === 'actions'
          ? 'm-fictional-review-title'
          : focus === 'designation'
            ? 'm-designate'
            : 'm-interpretation-title',
      false,
      'm-designation-status',
    );
    setReviewOpen(true);
  };
  const reviewQuestion = () => {
    const el = document.getElementById('mission-question');
    el?.scrollIntoView({ behavior: 'instant', block: 'start' });
    el?.focus({ preventScroll: true });
  };
  // Sidebar and deep-link requests reveal the same sections the in-page actions open.
  const handled = useRef(-1);
  useEffect(() => {
    if (handled.current === request.n) return;
    if (location.hash.endsWith('/completed')) return;
    const first = handled.current === -1;
    handled.current = request.n;
    if (first && request.section === 'overview') {
      revealTarget('m-health-title');
      return;
    }
    const section = request.section;
    if (section === 'assessments') queueMicrotask(openPlanner);
    else if (
      section === 'watchlist' ||
      section === 'review' ||
      section === 'designation' ||
      section === 'saved' ||
      section === 'actions'
    )
      queueMicrotask(() => openHealthReview(section));
    else revealTarget('m-health-title');
    // Only a new request should reveal a section.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request.n]);

  const availablePairs = model.descriptive.filter((p) => p.supported);
  const coverageCells = Array.from({ length: model.coverage.total }, (_, i) => i);
  return (
    <>
      <div className="m-health-layout">
        <div className="m-health-body">
          <header className="m-health-heading">
            <p className="m-eyebrow">{phaseLabel} · fictional mission</p>
            <h1 id="m-health-title" tabIndex={-1}>
              {surface ? 'Your health, after landing.' : 'Understand your health before landing.'}
            </h1>
            <p>
              What do we know about {context.astronaut.name}’s health, and what still needs review
              {surface ? ' on the surface' : ' before the landing tomorrow'}?
            </p>
          </header>

          {model.rich && (
            <RichObservations
              model={model}
              onInterpretation={() => openHealthReview('watchlist')}
            />
          )}
          <section
            className="m-insight m-unresolved"
            aria-labelledby="mobility-title"
            data-testid="mission-mobility"
          >
            <span className="m-chip is-unresolved">
              <i className="m-mark is-open" aria-hidden="true" /> Unresolved · most relevant to the
              landing
            </span>
            <h2 id="mobility-title">
              {surface
                ? 'Functional capability on the surface remains unestablished.'
                : 'Post-landing functional capability remains unestablished.'}
            </h2>
            <p>
              Balance and functional mobility remain unestablished. A cycling heart-rate change
              cannot establish how you will stand, walk or transfer from the lander to a habitat.
            </p>
            <section className="m-next-action" aria-labelledby="m-next-title">
              <p>
                <span className="m-next-label">Next review action</span>
                <strong id="m-next-title">
                  {c
                    ? 'Interpret the supported comparison'
                    : excluded
                      ? 'Decide whether to restore the excluded record'
                      : model.archivedRecords.length
                        ? 'Retrieve the 28 June exercise record'
                        : 'Inspect the exercise records'}
                </strong>
                <span className="m-next-detail">
                  {c
                    ? `The evaluator supports ${signed(c.absolute)} ${c.changeUnit} between two recorded sessions. Current force and post-landing mobility remain separate questions.`
                    : model.archivedRecords.length
                      ? 'It was recorded in transit and is stored in the onboard archive. Adding it lets the evaluator compare the two sessions.'
                      : 'The comparison is not supported with the current selection.'}
                </span>
              </p>
              <div className="m-next-buttons">
                {!c && (
                  <button className="s-button" onClick={openPlanner}>
                    {excluded ? 'Review the excluded record' : 'Find the missing exercise record'}
                    <ArrowRight size={17} aria-hidden="true" />
                  </button>
                )}
                <button
                  className="m-text-action"
                  aria-expanded={plannerOpen}
                  aria-controls="mission-planner"
                  onClick={openPlanner}
                >
                  Plan missing assessments
                </button>
                <button
                  className={c ? 's-button' : 'm-text-action'}
                  aria-expanded={reviewOpen}
                  aria-controls="mission-health-review"
                  onClick={() => openHealthReview('watchlist')}
                >
                  Interpret health and open watchlist
                  {c && <ArrowRight size={17} aria-hidden="true" />}
                </button>
              </div>
            </section>

            <div className="m-unresolved-context">
              <strong>
                {surface ? 'Assessment remains unresolved' : 'Not assessable in this context'}
              </strong>
              <span>
                {surface ? 'The crew is on Mars. ' : 'The crew is still in microgravity. '}No
                surface assessment has been collected, and no Mars-specific test protocol is
                established here.
              </span>
            </div>
            <button className="m-text-action" onClick={reviewQuestion}>
              Review what remains unresolved <ChevronRight size={18} aria-hidden="true" />
            </button>
          </section>

          <section
            className="m-observation"
            aria-labelledby="exercise-title"
            data-testid="mission-exercise"
          >
            <div className="m-section-head">
              <span className="m-eyebrow">Cardiovascular response · recorded observations</span>
              <span className="m-record-tag">Fictional exercise log</span>
            </div>
            <h2 id="exercise-title">
              {c
                ? 'A higher heart rate in the later session.'
                : 'The exercise change is not established.'}
            </h2>
            <p>
              {c
                ? `At the same recorded workload, heart rate increased by ${formatNumber(c.absolute)} ${c.changeUnit}. This describes two past exercise sessions, not your current resting heart rate.`
                : model.exerciseApplicable
                  ? model.archivedRecords.length
                    ? 'The 15 June reference is in this review. The 28 June observation was collected and is stored in the fictional exercise archive; it has not been added to this review.'
                    : model.exercise.explanation
                  : 'These historical microgravity exercise records do not establish a current assessment in this mission phase.'}
            </p>
            {c ? (
              <figure className="m-chart" data-testid="mission-chart">
                <div className="m-chart-result">
                  <strong>
                    {signed(c.absolute)} {c.changeUnit}
                  </strong>
                  <span>
                    Supported difference · two recorded sessions · no clinical significance inferred
                  </span>
                </div>
                <PairedObservationChart
                  early={{ value: c.baseline.value, label: '15 June 2040' }}
                  late={{ value: c.followup.value, label: '28 June 2040' }}
                  unit="bpm"
                  difference={`${signed(c.absolute)} ${c.changeUnit}`}
                  title="Two fictional cycling heart-rate records"
                  description={`15 June 2040: ${c.baseline.value} bpm. 28 June 2040: ${c.followup.value} bpm. Both at 100 W, final minute of the recorded session. These are two separate observations on one value axis, not continuous monitoring.`}
                />
                <p className="m-chart-values">
                  15 June: <strong>{c.baseline.value} bpm</strong> · 28 June:{' '}
                  <strong>{c.followup.value} bpm</strong>
                </p>
                <figcaption>
                  100 W · final-minute reading · same fictional monitor and protocol · 13 days apart
                </figcaption>
                <table className="sr-only">
                  <caption>Recorded exercise heart rate; both sessions at 100 W</caption>
                  <thead>
                    <tr>
                      <th scope="col">Fictional date</th>
                      <th scope="col">Heart rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th scope="row">15 June 2040</th>
                      <td>{c.baseline.value} bpm</td>
                    </tr>
                    <tr>
                      <th scope="row">28 June 2040</th>
                      <td>{c.followup.value} bpm</td>
                    </tr>
                  </tbody>
                </table>
              </figure>
            ) : (
              <div className="m-no-comparison" data-testid="mission-no-comparison">
                <strong>
                  {model.exercise.status === 'unresolved'
                    ? 'Comparison withheld'
                    : 'Change unknown'}{' '}
                  · No numerical change is displayed.
                </strong>
                {baseline && model.exerciseApplicable && (
                  <PairedObservationChart
                    early={{ value: baseline.value, label: shortDate(baseline.timestamp) }}
                    unit="bpm"
                    missingLabel={
                      excluded
                        ? '28 June: excluded from this review'
                        : included
                          ? '28 June: not comparable'
                          : '28 June: in archive, not in this review'
                    }
                    title="One recorded exercise observation in this review"
                    description={`${shortDate(baseline.timestamp)} 2040: ${baseline.value} bpm at 100 W. The later session is not part of this review, so no difference is drawn or calculated.`}
                  />
                )}
              </div>
            )}
            <details className="m-details">
              <summary>Inspect records and comparison</summary>
              <p>
                Include or exclude an existing fictional record from this review. The source record
                is preserved. This does not collect a new measurement.
              </p>
              <label className="m-check">
                <input
                  type="checkbox"
                  disabled={!editable || !included}
                  checked={included && !excluded}
                  onChange={(event) =>
                    dispatch({
                      type: 'record-availability',
                      recordId: 'mars-hr-jun28',
                      available: event.target.checked,
                    })
                  }
                />{' '}
                Use the 28 June record in this review
              </label>
              {!included && (
                <p>
                  The follow-up is in the archive only. Use the assessment planner to inspect and
                  retrieve it.
                </p>
              )}
              <p role="status">{model.exercise.explanation}</p>
              {model.exercise.issues.length > 0 && (
                <ul>
                  {model.exercise.issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              )}
              <SourceRecords
                records={model.records.filter((r) => r.measurement === 'exercise-hr')}
                excluded={state.excludedRecordIds}
              />
              <p className="m-fine">
                Comparison delegated to the existing evaluator through explicit assessment
                selection. Declared matching conditions do not validate a physiological protocol or
                device accuracy. The readings are not a continuous series.
              </p>
            </details>
          </section>

          <section className="m-other" aria-labelledby="m-other-title">
            <div className="m-section-head">
              <h2 id="m-other-title">
                {model.rich ? 'Historical muscular force' : 'Aerobic capacity and muscular force'}
              </h2>
              <span className="m-record-tag">
                {model.rich ? 'Separate preflight reference' : 'Two more domains in this review'}
              </span>
            </div>
            <div className="m-domain-grid">
              {!model.rich && (
                <article data-testid="mission-aerobic">
                  <span className="m-chip is-missing">
                    <i className="m-mark is-open" aria-hidden="true" /> Not established
                  </span>
                  <h3>An appropriate result is missing.</h3>
                  <p>
                    No VO2max result is supplied. Isolated heart-rate readings cannot establish
                    aerobic capacity, fitness for duty or medical clearance.
                  </p>
                </article>
              )}
              <article data-testid="mission-strength">
                <span className="m-chip is-historical">
                  <i className="m-mark is-hist" aria-hidden="true" /> Historical reference only
                </span>
                <span className="m-domain-figure">
                  1,000 N<small>preflight · Earth 1 g</small>
                </span>
                <h3>A reference, with no follow-up.</h3>
                <p>
                  The preflight leg-press record is <strong>1,000 N</strong>, measured on Earth at 1
                  g.{' '}
                  {model.strength.comparison
                    ? 'Historical acquisition remains separate from this mission phase.'
                    : 'No supported change is available.'}{' '}
                  It is not a current Mars strength measurement.
                </p>
              </article>
            </div>
            <details className="m-details">
              <summary>Inspect the historical force record</summary>
              <SourceRecords
                records={model.records.filter((r) => r.measurement === 'leg-press-force')}
                excluded={state.excludedRecordIds}
              />
            </details>
          </section>

          <div id="mission-planner" hidden={!plannerOpen}>
            {plannerOpen && (
              <AssessmentPlanner
                key={state.sessionId}
                navigation={request.n}
                state={state}
                model={model}
                dispatch={dispatch}
                editable={editable}
                onInterpretation={() => {
                  setPlannerOpen(false);
                  openHealthReview('watchlist');
                }}
              />
            )}
          </div>
          <div id="mission-health-review" hidden={!reviewOpen}>
            {reviewOpen && (
              <Suspense fallback={<p role="status">Opening health interpretation…</p>}>
                <HealthReview
                  key={state.sessionId}
                  state={state}
                  dispatch={dispatch}
                  editable={editable}
                  storageFailed={storageFailed}
                />
              </Suspense>
            )}
          </div>

          <section className="m-question" aria-labelledby="mission-question">
            <p className="m-eyebrow">The next review question</p>
            <h2 id="mission-question" tabIndex={-1}>
              {surface
                ? 'What information remains unresolved after landing?'
                : 'What information can we establish before landing?'}
            </h2>
            <p>
              {c
                ? 'The retrieved exercise record supports a comparison of two past sessions.'
                : 'The exercise comparison needs a compatible follow-up in this review.'}{' '}
              {model.rich
                ? 'Measured peak oxygen uptake and reported sleep are available separately.'
                : 'An appropriate aerobic-capacity result is missing.'}{' '}
              Balance and mobility need a task-specific assessment in the right environment, with
              suitable equipment and qualified oversight.
            </p>
            <p>
              Landing is the upcoming gravitational transition. Later discretionary surface
              activities require their own review. This prototype makes no continuation, abort or
              clearance decision.
            </p>
            <details className="m-details">
              <summary>Requirements, sources and limits</summary>
              <p className="m-fine">
                The three items below define this demonstration’s review scope. They are not a
                complete mission medical checklist or instructions to perform a test.
              </p>
              {model.requirements.map((r) => (
                <article className="m-requirement" key={r.id}>
                  <h3>{r.label}</h3>
                  <p>
                    {r.state.replaceAll('-', ' ')} · {r.unresolvedReason}
                  </p>
                  <p>
                    Equipment: {r.requiredEquipment.join(', ')}. {r.requiredSupervision}
                  </p>
                  <a href={r.source.sourceUrl} target="_blank" rel="noreferrer">
                    {r.source.locator} <ArrowUpRight size={14} aria-hidden="true" />
                  </a>
                  <p className="m-fine">
                    {r.source.population}. {r.source.acquisitionContext}
                  </p>
                </article>
              ))}
              <p>
                NASA’s V1 4002 specifies VO2max of at least 36.5 mL/(min kg) for missions with
                extraterrestrial surface EVAs; V1 4003 specifies at least 80% of pre-mission aerobic
                capacity. These published programme requirements are separate from this fictional
                case’s exercise HR. Neither can be evaluated from the supplied observations.
              </p>
              <p>
                Clément et al. (2022) assessed functional tasks after return to Earth. Those
                findings motivate the unanswered question; they do not establish a Mars protocol or
                a personal risk probability.
              </p>
            </details>
            <p>
              <a href="#research">Explore why matched acquisition conditions matter</a>. Published
              group research explains the comparison boundary; individual mobility remains
              unresolved.
            </p>
            <a className="m-text-action" href="#research">
              Explore the scientific context <ArrowRight size={17} aria-hidden="true" />
            </a>
          </section>
        </div>

        <aside className="m-summary" aria-labelledby="m-summary-title">
          <h2 id="m-summary-title" tabIndex={-1}>
            Your review so far
          </h2>
          <div data-testid="mission-summary-observations">
            <h3>Supported observations</h3>
            <strong>
              {c
                ? `${signed(c.absolute)} ${c.changeUnit} exercise HR`
                : model.rich
                  ? availablePairs
                      .map((p) => (p.measurement === 'vo2peak' ? 'VO₂peak' : 'sleep'))
                      .join(' and ') +
                    (availablePairs.length ? ' pairs available' : 'No supported descriptive pairs')
                  : 'Exercise change unestablished'}
            </strong>
            <p>
              {c
                ? 'Two historical transit sessions. No general functional conclusion.'
                : model.rich
                  ? `${availablePairs.length} descriptive pairs are available. Exercise HR awaits compatible active records.`
                  : 'The available records do not support a current-context comparison.'}
            </p>
          </div>
          <div data-testid="mission-summary-requirements">
            <h3>Information requirements</h3>
            <strong>
              Information available for {model.coverage.available} of {model.coverage.total}{' '}
              {context.phase} items
            </strong>
            <div className="m-coverage" aria-hidden="true">
              {coverageCells.map((i) => (
                <span key={i} className={i < model.coverage.available ? 'is-on' : ''} />
              ))}
            </div>
            <p>
              Scope:{' '}
              {model.coverage.ids
                .map((id) =>
                  id === 'exercise'
                    ? 'exercise response'
                    : id === 'aerobic'
                      ? 'aerobic-capacity evidence'
                      : id === 'sleep'
                        ? 'reported sleep duration'
                        : 'post-landing mobility',
                )
                .join(' and ')}
              . This is information coverage, never a health score.
            </p>
            <p className="m-summary-gap">
              Post-landing mobility remains unresolved
              {surface ? ' in this review.' : ' and outside this approach count.'}
            </p>
          </div>
          <div data-testid="mission-summary-disposition">
            <h3>Human review</h3>
            <strong>{model.reviewDisposition}</strong>
            <p>
              {context.reviewAuthority.label}: a hypothetical role. No medical authority is
              authenticated.
            </p>
          </div>
          <details className="m-summary-context">
            <summary>Mission resources and communications</summary>
            <p>
              Available: fictional cycle, HR monitor, onboard record archive and a fictional CMO.{' '}
              {model.rich &&
                'Previously collected gas-analysis and diary records declare their own acquisition resources.'}{' '}
              No device is connected.
            </p>
            <p>
              Earth link: illustrative {context.earthCommunications.oneWayDelaySeconds / 60}
              -minute one-way delay;{' '}
              {context.earthCommunications.status === 'outage'
                ? 'scenario outage'
                : 'no simulated outage'}
              . This is independent of this browser’s online status.
            </p>
            <p>
              Session {state.sessionId} · context revision {context.contextRevision} · evidence
              revision {state.evidenceRevision}.
            </p>
          </details>
        </aside>
      </div>
      <div
        className="m-mobile-review"
        role="region"
        aria-label="Persistent mission review reminder"
      >
        <div>
          <strong>Mobility unresolved</strong>
          <span>
            {model.coverage.available} of {model.coverage.total} {context.phase} items ·{' '}
            {state.reviews.length
              ? 'review ' + (model.reviewDisposition.startsWith('Earlier') ? 'stale' : 'recorded')
              : 'no human review'}
          </span>
        </div>
        <button
          onClick={() => {
            const title = document.getElementById('m-summary-title');
            title?.scrollIntoView({ behavior: 'instant', block: 'start' });
            title?.focus({ preventScroll: true });
          }}
        >
          Review summary
        </button>
      </div>
    </>
  );
}
