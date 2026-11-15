import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Check, RotateCcw, Undo2 } from 'lucide-react';
import { evaluate, comparisonSummary, formatNumber } from '../core/engine';
import { healthActions } from '../core/actions';
import { reviewMarkdown } from '../core/review';
import { statusLabels, type Finding, type Measure, type Phase } from '../core/model';
import {
  featuredScenarioFor,
  featuredScenarios,
  obtainedTaskFollowup,
  obtainedTaskSuggestion,
} from '../data/scenarios';
import { ObservationEntry } from '../components/ObservationEntry';
import { ReviewHandoff } from '../components/ReviewHandoff';
import { SourceRecords } from '../components/SourceRecords';
import { handoffSummary } from '../components/handoffSummary';
import {
  availableScenarioMatches,
  guidedScenarios,
  type GuidedCase,
  type GuidedScenario,
  type GuidedStore,
  type ScenarioKey,
} from './guidedState';
import {
  ConditionRows,
  MeasureBars,
  Result,
  SourceCopy,
  Status,
  changeText,
  phaseRecord,
  plainName,
} from './charts';
import { Photo, download, movement } from './common';
import { freshCase } from '../data/cases';

import { stepCount } from './guidedState';

/* ---------- Scenario list ---------- */

export function ScenarioIndex({
  store,
  onRestart,
}: {
  store: GuidedStore;
  onRestart: (key: ScenarioKey) => void;
}) {
  return (
    <div className="g-index">
      <header className="s-intro s-wrap">
        <h1 tabIndex={-1} id="page-title">
          Explore the demonstration library
        </h1>
        <p>
          Start with a complete fictional health record, then investigate how availability,
          acquisition conditions and source dependencies affect a finding.
        </p>
      </header>
      <ol className="g-cards s-wrap">
        {guidedScenarios.map((s, i) => {
          const c = store.cases[s.key];
          const done = store.completed.includes(s.key);
          const step = c?.reached ?? 1;
          return (
            <li key={s.key} className={`g-card g-card-${s.key}`} data-testid={`scenario-${s.key}`}>
              <ScenarioGlyph scenario={s.key} />
              <span className="g-card-meta">
                {i === 0 ? 'Start here · ' : ''}
                {s.key === 'complete'
                  ? 'Fictional Earth assessments · 1 g'
                  : s.key === 'exercise'
                    ? 'Fictional microgravity cycling · 100 W'
                    : featuredScenarios.find((f) => f.id === s.caseId)?.context}
              </span>
              <h2>
                <a href={`#scenarios/${s.slug}/${done ? 1 : step}`}>
                  {s.title}
                  <span className="sr-only">
                    {done ? ', completed' : c ? `, continue at step ${step}` : ''}
                  </span>
                </a>
              </h2>
              <p>{s.question}</p>
              <span className="g-card-state">
                {done ? (
                  <>
                    <Check size={15} aria-hidden="true" /> Completed
                  </>
                ) : c ? (
                  `Continue at step ${step} of ${stepCount}`
                ) : (
                  `${stepCount} steps`
                )}
                <ArrowRight size={16} aria-hidden="true" />
              </span>
              {c && (
                <button className="g-card-restart" onClick={() => onRestart(s.key)}>
                  Restart <span className="sr-only">{s.title}</span>
                </button>
              )}
            </li>
          );
        })}
        <li className="g-card">
          <p className="g-card-meta">Fictional mission · actual replay workflow</p>
          <h2>
            <a href="#mission/monitoring">Monitoring signal quality</a>
          </h2>
          <p>
            Designate a monitoring requirement, then run the existing synthetic HR and quality
            replay. No device is connected.
          </p>
          <a className="s-link" href="#mission/monitoring">
            Open monitoring
          </a>
        </li>
      </ol>
      <section className="g-workspace-entry s-wrap" aria-labelledby="workspace-entry">
        <h2 id="workspace-entry">Advanced workspace</h2>
        <p>
          Import your own fictional records, inspect every field, and manage review actions. It
          keeps its own session, separate from these investigations.
        </p>
        <a className="s-link" href="#monitor">
          Open the advanced workspace <ArrowRight size={16} aria-hidden="true" />
        </a>
      </section>
    </div>
  );
}

/** Original diagrams for the three evidence problems. Decorative; the card text carries meaning. */
export function ScenarioGlyph({ scenario }: { scenario: ScenarioKey }) {
  return (
    <svg className="g-glyph" viewBox="0 0 200 96" aria-hidden="true">
      {(scenario === 'complete' || scenario === 'exercise') && (
        <>
          {[0, 1, 2, 3].map((n) => (
            <g key={n}>
              <rect
                x={20 + n * 42}
                y="18"
                width="12"
                height={25 + n * 7}
                rx="2"
                className="gl-before"
              />
              <rect
                x={34 + n * 42}
                y="18"
                width="12"
                height={scenario === 'exercise' ? 48 : 46 - n * 5}
                rx="2"
                className="gl-after"
              />
            </g>
          ))}
        </>
      )}
      {scenario === 'missing' && (
        <>
          <rect x="20" y="22" width="120" height="16" rx="3" className="gl-before" />
          <rect x="20" y="50" width="148" height="16" rx="3" className="gl-gap" />
          <text x="94" y="62" className="gl-text">
            ?
          </text>
        </>
      )}
      {scenario === 'conditions' && (
        <>
          <rect x="20" y="22" width="70" height="16" rx="3" className="gl-before" />
          <rect x="20" y="50" width="84" height="16" rx="3" className="gl-after" />
          <rect x="120" y="22" width="50" height="16" rx="3" className="gl-cond" />
          <rect x="120" y="50" width="62" height="16" rx="3" className="gl-cond gl-differs" />
        </>
      )}
      {scenario === 'copy' && (
        <>
          <rect x="18" y="24" width="60" height="48" rx="4" className="gl-doc" />
          <rect x="122" y="24" width="60" height="48" rx="4" className="gl-doc gl-copy" />
          <path d="M82 48H112" className="gl-line" />
          <path d="M108 43l7 5-7 5" className="gl-line" />
        </>
      )}
    </svg>
  );
}

/* ---------- One guided scenario ---------- */

interface Ctx {
  /** False once the records leave the fixture's recognised teaching states. */
  curated: boolean;
  findings: Finding[];
  finding: Finding;
  state: GuidedCase;
  openEntry: (m: Measure) => void;
  undo: ReactNode;
  toggleSource: () => void;
}
interface StepContent {
  title: string;
  lede: ReactNode;
  visual: ReactNode;
  action?: ReactNode;
  wide?: boolean;
}

export function GuidedRunner({
  scenario,
  state,
  step,
  completed,
  onStep,
  onChange,
  onRestart,
  onFinish,
  onTransfer,
  announce,
}: {
  scenario: GuidedScenario;
  state: GuidedCase;
  step: number;
  completed: boolean;
  onStep: (n: number) => void;
  onChange: (next: GuidedCase) => void;
  onRestart: () => void;
  onFinish: () => void;
  onTransfer: () => void;
  announce: (message: string) => void;
}) {
  const { packet, unavailable } = state;
  const findings = useMemo(() => evaluate(packet, unavailable), [packet, unavailable]);
  const actions = useMemo(
    () => healthActions(packet, unavailable, scenario.phase),
    [packet, unavailable, scenario.phase],
  );
  const finding = findings.find((f) => f.id === scenario.measure)!;
  // The control that opened the record form, so focus can return to it when the form closes.
  const [entry, setEntry] = useState<{ measure: Measure; trigger: HTMLElement | null } | null>(
    null,
  );
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    heading.current?.focus({ preventScroll: true });
  }, [step, scenario.key]);

  const focusResult = () =>
    requestAnimationFrame(() => {
      const el = document.getElementById('guided-result');
      if (!el) return;
      el.focus({ preventScroll: true });
      el.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    });

  const undo = state.undo ? (
    <button
      className="s-link"
      onClick={() => {
        onChange({
          ...state,
          packet: state.undo!.packet,
          unavailable: state.undo!.unavailable,
          undo: null,
        });
        announce('Entry undone. The comparison uses the previous records again.');
        focusResult();
      }}
    >
      <Undo2 size={16} aria-hidden="true" /> Undo entry
    </button>
  ) : null;

  const source = packet.observations.find(
    (r) =>
      r.id ===
      (scenario.key === 'complete'
        ? 'DEMO-01-force-followup'
        : scenario.key === 'exercise'
          ? 'DEMO-05-hr-followup'
          : 'DEMO-04-force-followup'),
  );
  const toggleSource = () => {
    if (!source) return;
    const excluded = unavailable.includes(source.id);
    onChange({
      ...state,
      undo: { packet: structuredClone(packet), unavailable: [...unavailable] },
      unavailable: excluded
        ? unavailable.filter((id) => id !== source.id)
        : [...unavailable, source.id],
    });
  };

  const curated = availableScenarioMatches(packet) || !!featuredScenarioFor(packet, unavailable);
  const ctx: Ctx = {
    curated,
    findings,
    finding,
    state,
    openEntry: (m) => setEntry({ measure: m, trigger: document.activeElement as HTMLElement }),
    undo,
    toggleSource,
  };
  const content = (
    scenario.key === 'complete' || scenario.key === 'exercise'
      ? availableStep
      : scenario.key === 'missing'
        ? missingStep
        : scenario.key === 'conditions'
          ? conditionStep
          : copyStep
  )(step, ctx);

  const next = actions.find((a) => a.findingIds.includes(scenario.measure));
  const markdown = useMemo(
    () =>
      reviewMarkdown(packet, unavailable, [], state.note, undefined, {
        missionPhase: scenario.phase,
        receipts: {},
        planCompleted: false,
        selected: scenario.measure,
      }),
    [packet, unavailable, state.note, scenario.phase, scenario.measure],
  );
  const changed =
    state.undo !== null ||
    unavailable.length > 0 ||
    state.note !== '' ||
    JSON.stringify(packet) !== JSON.stringify(freshCase(scenario.caseId));

  return (
    <div className={`g-run g-run-${scenario.key}`} data-testid="guided-scenario">
      <header className="g-head s-wrap">
        <div className="g-head-row">
          <a className="g-back-list" href="#scenarios">
            <ArrowLeft size={16} aria-hidden="true" /> All scenarios
          </a>
          <span className="g-chip">Fictional case</span>
          {(changed || step > 1) && (
            <button className="g-restart" onClick={onRestart}>
              <RotateCcw size={14} aria-hidden="true" /> Restart
            </button>
          )}
        </div>
        <p className="g-scenario-name">
          {scenario.title}
          {completed && <span className="g-done"> · Completed</span>}
        </p>
        <ol className="g-progress" aria-label={`Progress: step ${step} of ${stepCount}`}>
          {scenario.steps.map((label, i) => (
            <li
              key={label}
              aria-current={i + 1 === step ? 'step' : undefined}
              className={i + 1 < step ? 'is-past' : i + 1 === step ? 'is-current' : ''}
            >
              <span className="g-progress-mark" aria-hidden="true">
                {i + 1 < step ? <Check size={12} strokeWidth={3} /> : i + 1}
              </span>
              <span className="g-progress-label">{label}</span>
              <span className="sr-only">
                {i + 1 < step ? ' (done)' : i + 1 === step ? ' (current)' : ''}
              </span>
            </li>
          ))}
        </ol>
        {!curated && (
          <p className="g-edited" role="note" data-testid="edited-records">
            These records were edited, so this scenario’s source documents no longer apply. Undo the
            entry or restart the scenario to use them.
          </p>
        )}
      </header>

      {/* Keyed by step: bars animate only when evidence changes within a step, never between
          different measures on different steps. */}
      <article
        key={step}
        className={`g-step s-wrap ${content.wide ? 'g-step-wide' : ''}`}
        aria-labelledby="step-title"
        data-step={step}
      >
        <div className="g-copy">
          <p className="g-step-count">
            Step {step} of {stepCount} · {scenario.steps[step - 1]}
          </p>
          <h1 id="step-title" ref={heading} tabIndex={-1}>
            {content.title}
          </h1>
          <div className="g-lede">{content.lede}</div>
          {content.action}
          {step === stepCount && (
            <FinalStep
              next={next}
              handoff={
                <ReviewHandoff
                  compact
                  note={state.note}
                  onNote={(note) => onChange({ ...state, note })}
                  report={markdown}
                  onDownload={() =>
                    download(`PARALLAX-${packet.case.id}-review.md`, markdown, 'text/markdown')
                  }
                  contents={handoffSummary(markdown)}
                />
              }
              records={
                <SourceRecords packet={packet} finding={finding} unavailable={unavailable} />
              }
              onTransfer={onTransfer}
            />
          )}
        </div>
        <div className="g-visual">
          {content.visual}
          {step === stepCount && <Needs finding={finding} />}
        </div>
      </article>

      <nav className="g-nav s-wrap" aria-label="Scenario steps">
        {step > 1 ? (
          <button className="s-button s-secondary" onClick={() => onStep(step - 1)}>
            <ArrowLeft size={17} aria-hidden="true" /> Back
          </button>
        ) : (
          <span />
        )}
        {step < stepCount ? (
          <button className="s-button" onClick={() => onStep(step + 1)}>
            <span>
              Next<span className="g-next-label">: {scenario.steps[step]}</span>
            </span>
            <ArrowRight size={17} aria-hidden="true" />
          </button>
        ) : (
          <button className="s-button" onClick={onFinish}>
            Finish <Check size={17} aria-hidden="true" />
          </button>
        )}
      </nav>

      {entry && (
        <ObservationEntry
          packet={packet}
          phase={scenario.phase}
          initialMeasure={entry.measure}
          initialRole={'followup' as Phase}
          suggestedRecord={
            entry.measure === 'task' ? obtainedTaskSuggestion(packet, unavailable) : undefined
          }
          sourceNote={
            scenario.key === 'missing'
              ? `Assessment slip: after-mission task time ${formatNumber(obtainedTaskFollowup.value)} s, same protocol as the before test.`
              : scenario.key === 'conditions'
                ? 'Correction log, session 2: documented workload 100 W. Change only the recorded workload.'
                : undefined
          }
          onClose={() => {
            const { trigger } = entry;
            setEntry(null);
            requestAnimationFrame(() => trigger?.focus({ preventScroll: true }));
          }}
          onSave={(nextPacket, measurement, role) => {
            onChange({
              ...state,
              undo: { packet, unavailable },
              packet: nextPacket,
              unavailable: unavailable.filter(
                (id) =>
                  !nextPacket.observations.some(
                    (r) => r.id === id && r.measurement === measurement && r.phase === role,
                  ),
              ),
            });
            setEntry(null);
            announce('Record validated. The comparison was recalculated from the updated records.');
            focusResult();
          }}
        />
      )}
    </div>
  );
}

function FinalStep({
  next,
  handoff,
  records,
  onTransfer,
}: {
  next?: { title: string; reason: string };
  handoff: ReactNode;
  records: ReactNode;
  onTransfer: () => void;
}) {
  return (
    <div className="g-final">
      {next && (
        <section className="g-next-action" aria-labelledby="next-action" data-testid="next-action">
          <h2 id="next-action">Next review action</h2>
          <p className="g-next-title">{next.title.replace(/\bhr\b/g, 'heart-rate')}</p>
          <p>{next.reason}</p>
        </section>
      )}
      {handoff}
      <details className="g-disclosure">
        <summary>Source records</summary>
        {records}
      </details>
      <button className="s-link" onClick={onTransfer}>
        Continue in the advanced workspace <ArrowRight size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

function Needs({ finding }: { finding: Finding }) {
  if (!finding.requirements.length && !finding.issues.length) return null;
  return (
    <section className="g-needs" aria-labelledby="review-needs">
      <h2 id="review-needs">What the review still needs</h2>
      <ul>
        {finding.requirements.map((r) => (
          <li key={r}>{r}</li>
        ))}
        {finding.issues.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    </section>
  );
}

/** The findings this scenario is about, each with its engine status and supported change. */
function Ledger({ findings, ids }: { findings: Finding[]; ids: Finding['id'][] }) {
  return (
    <ul className="g-ledger" aria-label="What the records support">
      {ids.map((id) => {
        const f = findings.find((x) => x.id === id)!;
        return (
          <li key={id} className={`l-${f.status}`}>
            <span className="g-ledger-name">{plainName[id as Measure]}</span>
            <strong>{changeText(f)}</strong>
            <Status status={f.status} />
          </li>
        );
      })}
    </ul>
  );
}

/* ---------- Scenario 1: missing evidence ---------- */

function taskSentence(task: Finding) {
  const a = task.comparison!.absolute;
  if (a === 0) return 'The task time did not change.';
  return `The task took ${formatNumber(Math.abs(a))} seconds ${a > 0 ? 'longer' : 'less'}.`;
}

function missingStep(step: number, ctx: Ctx): StepContent {
  const { findings, state } = ctx;
  const force = findings.find((f) => f.id === 'force')!;
  const task = findings.find((f) => f.id === 'task')!;
  const after = phaseRecord(state.packet, state.unavailable, 'task', 'followup');
  const before = phaseRecord(state.packet, state.unavailable, 'task', 'baseline');
  const forceBars = (
    <MeasureBars
      packet={state.packet}
      unavailable={state.unavailable}
      measure="force"
      title="Leg-press force"
      caption="Zero-based scale. Fictional records, Earth assessments at 1 g."
    />
  );
  const taskBars = (
    <MeasureBars
      packet={state.packet}
      unavailable={state.unavailable}
      measure="task"
      title="Time to stand and walk the course"
      caption="Longer is slower. Zero-based scale. Fictional records."
    />
  );
  switch (step) {
    case 1:
      return {
        title: 'Does more strength mean easier movement?',
        lede: (
          <p>
            A fictional crew member has returned to Earth’s gravity. Reviewers have before-and-after
            records of leg strength and of a timed task: stand up, then walk a short course. They
            want to know whether moving has become easier.
          </p>
        ),
        visual: (
          <Photo
            src="/images/health-context-original.webp"
            alt="AI-generated illustration of an unoccupied health observation station in a fictional habitat"
            credit="Original AI-generated illustration · fictional health observation station, not flight equipment."
          />
        ),
      };
    case 2:
      return {
        title: `Leg strength ${movement(force)}`,
        lede: (
          <p>
            Leg-press force rose from {formatNumber(force.comparison?.baseline.value ?? 0)} N to{' '}
            {formatNumber(force.comparison?.followup.value ?? 0)} N. Both records are present, so
            the change is supported. Does that tell us the timed task got easier?
          </p>
        ),
        visual: (
          <>
            {forceBars}
            <Result finding={force} label="Force change" />
          </>
        ),
      };
    case 3:
      return {
        title: after
          ? 'The task has both records now'
          : 'The task result after the mission is missing',
        lede: after ? (
          <p>The after record you entered is in use. Step 4 shows how it changed the comparison.</p>
        ) : (
          <p>
            The before time is {before ? formatNumber(before.value) : 'unknown'} seconds. No after
            time was recorded, so the change is unknown. A force result cannot fill this gap, and
            PARALLAX does not estimate it.
          </p>
        ),
        visual: (
          <>
            {taskBars}
            <Result finding={task} label="Task change" />
          </>
        ),
      };
    case 4:
      return {
        title: 'A result exists on a separate slip',
        lede: (
          <p>
            This fictional assessment slip holds the after time. Enter it through the record form.
            PARALLAX checks the record before it uses it.
          </p>
        ),
        action: (
          <div className="g-interaction">
            {ctx.curated && (
              <SourceSlip
                rows={[
                  ['Task', 'Stand up and walk the course'],
                  ['Session', 'After the mission'],
                  ['Result', `${formatNumber(obtainedTaskFollowup.value)} s`],
                  ['Method', 'Same protocol as the before test'],
                ]}
                title="Assessment slip"
                state={
                  after ? `After record in use: ${formatNumber(after.value)} s` : 'Not yet entered'
                }
              />
            )}
            <div className="g-interaction-row">
              {!after && ctx.curated && (
                <button className="s-button" onClick={() => ctx.openEntry('task')}>
                  Enter the slip’s result
                </button>
              )}
              {ctx.undo}
            </div>
          </div>
        ),
        visual: (
          <div tabIndex={-1} className="g-result-focus" id="guided-result">
            {taskBars}
            <Result finding={task} label="Task change" />
            <p className="g-why" aria-live="polite">
              {task.comparison
                ? 'Both records come from the same test protocol, so PARALLAX calculates the change.'
                : 'PARALLAX needs a before and an after record from the same test. Until the slip is entered, the change stays unknown.'}
            </p>
          </div>
        ),
      };
    default:
      return {
        title: task.comparison
          ? `Force ${movement(force)}. ${taskSentence(task)}`
          : 'Force changed. The task result is still unknown.',
        lede: task.comparison ? (
          <p>
            One measurement cannot stand in for the other, so both go to the reviewer as separate
            findings.
          </p>
        ) : (
          <p>
            Force {movement(force)}. The task change is still unknown because its after record was
            not entered. One measurement cannot stand in for another.
          </p>
        ),
        visual: <Ledger findings={findings} ids={['force', 'task']} />,
      };
  }
}

/* ---------- Scenario 2: incompatible measurements ---------- */

function conditionStep(step: number, ctx: Ctx): StepContent {
  const { finding: hr, state } = ctx;
  const [s1, s2] = (['baseline', 'followup'] as const).map((p) =>
    state.packet.observations.find(
      (r) => r.measurement === 'hr' && r.phase === p && r.form === 'direct',
    ),
  );
  const matched = s1?.acquisition?.workloadWatts === s2?.acquisition?.workloadWatts;
  const bars = (
    <MeasureBars
      packet={state.packet}
      unavailable={state.unavailable}
      measure="hr"
      title="Heart rate near the end of each session"
      labels={['Session 1', 'Session 2']}
      caption="Zero-based scale. Fictional in-flight records."
    />
  );
  switch (step) {
    case 1:
      return {
        title: 'Did exercise heart rate change between two sessions?',
        lede: (
          <p>
            During a fictional mission, an astronaut rode the station’s exercise bike in two
            scheduled sessions. A heart-rate reading was logged near the end of each one.
          </p>
        ),
        visual: (
          <Photo
            src="/images/exercise-context-original.webp"
            alt="AI-generated illustration of an unoccupied exercise cycle in a fictional deep-space habitat"
            credit="Original AI-generated illustration · fictional exercise cycle, not an official flight protocol."
          />
        ),
      };
    case 2:
      return {
        title: `${s1 ? formatNumber(s1.value) : '—'} bpm, then ${s2 ? formatNumber(s2.value) : '—'} bpm`,
        lede: (
          <p>
            The second reading is higher. Whether that difference means anything depends on what the
            astronaut was doing during each reading.
          </p>
        ),
        visual: (
          <>
            {bars}
            <Result finding={hr} label="Heart-rate change" />
          </>
        ),
      };
    case 3:
      return {
        title: matched ? 'The workloads now match' : 'The recorded workloads were different',
        lede: matched ? (
          <p>
            Both sessions are recorded at {s1?.acquisition?.workloadWatts} W after the correction.
          </p>
        ) : (
          <p>
            Session 1 was recorded at {s1?.acquisition?.workloadWatts} W and session 2 at{' '}
            {s2?.acquisition?.workloadWatts} W. Heart rate depends on how hard the exercise is, so
            PARALLAX does not compare readings taken at different workloads.
          </p>
        ),
        visual: (
          <>
            <ConditionRows packet={state.packet} />
            <Result finding={hr} label="Heart-rate change" />
          </>
        ),
      };
    case 4:
      return {
        title: 'Check the correction log',
        lede: (
          <p>
            A fictional correction log documents session 2’s workload as 100 W. Apply that
            documented value through the record form. Change nothing else.
          </p>
        ),
        action: (
          <div className="g-interaction">
            {ctx.curated && (
              <SourceSlip
                title="Correction log"
                rows={[
                  ['Session', 'Session 2'],
                  ['Heart rate', s2 ? `${formatNumber(s2.value)} bpm` : '—'],
                  ['Workload documented', '100 W'],
                  ['Workload in the record', `${s2?.acquisition?.workloadWatts ?? '—'} W`],
                ]}
                state={matched ? 'Correction applied' : 'Not yet applied'}
              />
            )}
            <div className="g-interaction-row">
              {!matched && ctx.curated && (
                <button className="s-button" onClick={() => ctx.openEntry('hr')}>
                  Apply the documented workload
                </button>
              )}
              {ctx.undo}
            </div>
          </div>
        ),
        visual: (
          <div tabIndex={-1} className="g-result-focus" id="guided-result">
            <ConditionRows packet={state.packet} />
            <Result finding={hr} label="Heart-rate change" />
            <p className="g-why" aria-live="polite">
              {hr.comparison
                ? 'With matching recorded workloads, PARALLAX compares the two readings.'
                : 'PARALLAX withholds the comparison while the recorded workloads differ.'}
            </p>
          </div>
        ),
      };
    default:
      return {
        title: hr.comparison
          ? `A supported ${comparisonSummary(hr)} difference`
          : 'The comparison stays withheld',
        lede: hr.comparison ? (
          <p>
            This compares two recorded readings under matching recorded conditions. It is a
            numerical comparison, not a measure of fitness or heart health.
          </p>
        ) : (
          <p>
            The records still show different workloads, so no heart-rate change is reported. The
            reviewer needs the session records checked first.
          </p>
        ),
        visual: <Ledger findings={ctx.findings} ids={['hr']} />,
      };
  }
}

/* ---------- Scenario 3: dependent observations ---------- */

function copyStep(step: number, ctx: Ctx): StepContent {
  const { findings, finding: force, state } = ctx;
  const source = state.packet.observations.find((r) => r.id === 'DEMO-04-force-followup');
  const copy = state.packet.observations.find(
    (r) => r.measurement === 'force' && r.form === 'derived',
  );
  const excluded = !!source && state.unavailable.includes(source.id);
  const others = findings.filter(
    (f) =>
      f.id !== 'force' &&
      f.status !== 'outside' &&
      state.packet.observations.some((r) => r.measurement === f.id),
  );
  // The engine's own result with the original restored. No value is computed here.
  const restored = excluded
    ? evaluate(
        state.packet,
        state.unavailable.filter((id) => id !== source!.id),
      )
    : undefined;
  const withSource = restored?.find((f) => f.id === 'force');
  const unchanged = restored
    ? others.filter((f) => {
        const w = restored.find((v) => v.id === f.id);
        return w && w.status === f.status && comparisonSummary(w) === comparisonSummary(f);
      }).length
    : others.length;
  const copyDependent =
    !!copy &&
    !!source &&
    copy.derivedFrom.includes(source.id) &&
    !state.unavailable.includes(copy.id);
  const forceBars = (
    <MeasureBars
      packet={state.packet}
      unavailable={state.unavailable}
      measure="force"
      title="Leg-press force"
      extra={
        copy
          ? [
              {
                label: 'Copied display',
                detail: 'of the after value',
                value: copy.value,
                tone: 'copy',
                tag: 'not counted',
              },
            ]
          : []
      }
      caption="Zero-based scale. Fictional records, Earth assessments at 1 g."
    />
  );
  switch (step) {
    case 1:
      return {
        title: 'Two records show 1,050 N. Are they two measurements?',
        lede: (
          <p>
            In a fictional post-mission review, a leg-press result appears in the original
            assessment record and again on a review display. Both show{' '}
            {source ? formatNumber(source.value) : '—'} N.
          </p>
        ),
        visual: (
          <div className="g-two-records" aria-hidden="true">
            <div>
              <span>Assessment record</span>
              <strong>{source ? formatNumber(source.value) : '—'} N</strong>
            </div>
            <em>?</em>
            <div>
              <span>Review display</span>
              <strong>{copy ? formatNumber(copy.value) : '—'} N</strong>
            </div>
          </div>
        ),
      };
    case 2:
      return {
        title: excluded ? 'The after record is excluded' : `Force ${movement(force)}`,
        lede: (
          <p>
            The before result is{' '}
            {formatNumber(
              state.packet.observations.find(
                (r) => r.measurement === 'force' && r.phase === 'baseline',
              )?.value ?? 0,
            )}{' '}
            N and the after result is {source ? formatNumber(source.value) : '—'} N. The display
            repeats the after value.
          </p>
        ),
        visual: (
          <>
            {forceBars}
            <Result finding={force} label="Force change" />
          </>
        ),
      };
    case 3:
      return {
        title: 'The copy came from the original',
        lede: (
          <p>
            The display was produced from the assessment record, so it is the same measurement shown
            twice. It cannot confirm the original, and it cannot replace it.
          </p>
        ),
        visual: <SourceCopy source={source} copy={copy} excluded={excluded} />,
      };
    case 4:
      return {
        title: 'What if the original record were unavailable?',
        lede: (
          <p>
            Exclude the original to see what the copy supports on its own. Nothing is deleted, and
            you can restore it.
          </p>
        ),
        action: (
          <div className="g-interaction">
            <button
              className={`s-button ${excluded ? 's-secondary' : ''}`}
              aria-pressed={excluded}
              data-testid="source-toggle"
              onClick={() => {
                ctx.toggleSource();
                // Bring the compact result fully into view; focus stays on this control.
                requestAnimationFrame(() =>
                  document
                    .getElementById('guided-result')
                    ?.scrollIntoView({ block: 'nearest', behavior: 'instant' }),
                );
              }}
            >
              {excluded ? <RotateCcw size={16} aria-hidden="true" /> : null}
              {excluded ? 'Restore the original record' : 'Exclude the original record'}
            </button>
            <div
              id="guided-result"
              className={`g-compact r-${force.status}`}
              role="status"
              data-testid="compact-result"
            >
              <p>
                <strong>
                  {force.comparison
                    ? `Force comparison ${comparisonSummary(force)}`
                    : 'Force comparison unknown'}
                </strong>{' '}
                <Status status={force.status} />
              </p>
              {excluded ? (
                <ul>
                  {copy && (
                    <li>
                      {copyDependent
                        ? `The copy still shows ${formatNumber(copy.value)} N. It depends on the excluded record, so it is not counted.`
                        : 'The copy is also excluded.'}
                    </li>
                  )}
                  <li>
                    {unchanged === others.length
                      ? `${others.length} other ${others.length === 1 ? 'comparison is' : 'comparisons are'} unchanged.`
                      : `${unchanged} of ${others.length} other comparisons are unchanged.`}
                  </li>
                </ul>
              ) : (
                <p>The original record is in use.</p>
              )}
            </div>
          </div>
        ),
        visual: (
          <div className="g-dependency">
            <SourceCopy source={source} copy={copy} excluded={excluded} />
            {withSource && (
              <p className="g-counterfactual" data-testid="counterfactual">
                With the original available: <strong>{comparisonSummary(withSource)}</strong>{' '}
                <span>({statusLabels[withSource.status].toLowerCase()})</span>
              </p>
            )}
            <h2 className="g-subhead">Other comparisons in this review</h2>
            <ul className="g-ledger g-ledger-small" aria-label="Other comparisons">
              {others.map((f) => (
                <li key={f.id} className={`l-${f.status}`}>
                  <span className="g-ledger-name">{plainName[f.id as Measure]}</span>
                  <strong>{changeText(f)}</strong>
                  <Status status={f.status} />
                </li>
              ))}
            </ul>
          </div>
        ),
        wide: true,
      };
    default:
      return {
        title: excluded
          ? 'The copy cannot replace the original record'
          : 'The original record supports the force change',
        lede: excluded ? (
          <p>
            Without the original record, the force comparison is unknown even though{' '}
            {copy ? formatNumber(copy.value) : '—'} N is still on screen. The other comparisons keep
            their own records.
          </p>
        ) : (
          <p>
            With the original record available, the force change is supported:{' '}
            {comparisonSummary(force)}. The copy adds nothing to it.
          </p>
        ),
        visual: <Ledger findings={findings} ids={['force', ...others.map((f) => f.id)]} />,
      };
  }
}

function SourceSlip({
  title,
  rows,
  state,
}: {
  title: string;
  rows: [string, string][];
  state: string;
}) {
  return (
    <div className="g-slip" data-testid="source-slip">
      <p className="g-slip-title">
        {title} <span>Fictional</span>
      </p>
      <dl>
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <p className="g-slip-state">{state}</p>
    </div>
  );
}

function availableStep(step: number, ctx: Ctx): StepContent {
  const exercise = ctx.state.packet.case.id === 'DEMO-05';
  const ids: Measure[] = exercise ? ['hr'] : ['force', 'cardio', 'tandem', 'task'];
  const active = exercise ? 'hr' : ids[Math.min(step - 1, 3)];
  const f = ctx.findings.find((f) => f.id === active)!;
  return {
    title: !ctx.curated
      ? 'Review the edited fictional records'
      : exercise
        ? 'Two exercise records at the same workload'
        : 'Four endpoints, four separate findings',
    lede: (
      <p>
        {!ctx.curated
          ? 'These fictional records were edited. Inspect the actual endpoint definitions, values and acquisition declarations below; the original scenario narrative no longer applies.'
          : exercise
            ? 'The evaluator compares the two recorded sessions at 100 W. This describes exercise HR, with no HR-to-oxygen-uptake conversion.'
            : 'DEMO-01 contains fictional Earth assessments at 1 g. Force, postural heart-rate response, tandem performance and task duration can change in different directions. None is a Mars observation.'}
      </p>
    ),
    visual: (
      <div id="guided-result" tabIndex={-1}>
        <Ledger findings={ctx.findings} ids={ids} />
        <MeasureBars
          packet={ctx.state.packet}
          unavailable={ctx.state.unavailable}
          measure={active}
          title={f.title}
          caption="Separate fictional observations. Inspect the endpoint and protocol before interpreting the difference."
        />
        <Result finding={f} label="Evaluator finding" />
        {ids.map((id) => (
          <SourceRecords
            key={id}
            label={`Inspect ${plainName[id]} source records`}
            packet={ctx.state.packet}
            finding={ctx.findings.find((f) => f.id === id)!}
            unavailable={ctx.state.unavailable}
          />
        ))}
      </div>
    ),
    action: (
      <div className="g-interaction">
        <p>
          Exclude the original follow-up and observe which finding loses its support. Restore it or
          undo the change.
        </p>
        <button className="s-button" onClick={ctx.toggleSource}>
          {ctx.state.unavailable.length
            ? 'Restore original follow-up'
            : 'Exclude original follow-up'}
        </button>
        {ctx.undo}
        <p>Next: inspect each endpoint below, then review acquisition conditions in the library.</p>
      </div>
    ),
    wide: true,
  };
}
