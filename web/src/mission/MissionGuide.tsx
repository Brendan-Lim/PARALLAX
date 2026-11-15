import { companionLink, revealTarget } from './navigation';
import { useEffect, useRef, useState } from 'react';
import type { MissionState } from './state';
import { demoMode } from './demoProfile';
import { guideFacts, guideRecovery, guideRoutes, guideStep } from './guideState';
import { EditingNotice } from './EditingNotice';
import type { Ledger } from '../monitoring/model';
import './guide.css';
const key = 'parallax.mission-guide.v1';
const titles = [
  'Personal baseline',
  'In-flight changes',
  'Pre-landing assessment',
  'Device monitoring',
  'Monitoring interruption',
  'Human review',
  'Surface planning',
];
const contexts = [
  'Preflight · Earth 1 g',
  'Transit · microgravity',
  'Approach · landing tomorrow',
  'Approach · synthetic equipment sources',
  'Approach · reported signal quality',
  'Approach · fictional reviewer',
  'Surface chapter · illustrative Mars 0.38 g',
];
const explanations = [
  'Inspect your personal reference measurements. Compatible acquisition conditions make later comparisons useful.',
  'Compare separate gas-analysis, diary and exercise records. The archive and active review keep distinct membership.',
  'Retrieve the missing exercise follow-up. PARALLAX validates its acquisition conditions before calculating the difference.',
  'Choose an explicit fictional HR designation, then process the wearable source. Its unknown workload stays separate from cycling records.',
  'At 3 s the raw number remains 72 bpm, but quality code 2 reports garment disconnection. Inspect the event and acknowledge it in the separate companion.',
  'Inspect findings and unresolved requirements, select reasons and save. PARALLAX preserves the actual monitoring cutoff and human selections.',
  'Explore the requirements for a different gravity environment. Historical physiology cannot establish mobility on Mars.',
];
function readVisits(sessionId: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? 'null');
    return v?.sessionId === sessionId && Array.isArray(v.visits)
      ? v.visits.filter((x: unknown) => ['preflight', 'transit', 'surface'].includes(String(x)))
      : [];
  } catch {
    return [];
  }
}
const reveal = (id: string) => revealTarget(id, true);
export default function MissionGuide({
  state,
  editable,
  storageFailed,
  navigation,
  onNavigate,
}: {
  state: MissionState;
  editable: boolean;
  storageFailed: boolean;
  navigation: object;
  onNavigate: (hash: string) => void;
}) {
  const step = guideStep(location.hash),
    short = demoMode === 'short';
  const [, setVisits] = useState(() => readVisits(state.sessionId));
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [error, setError] = useState('');
  const [expandedFor, setExpandedFor] = useState<object | null>(null);
  const expanded = expandedFor === navigation;
  const setExpanded = (value: boolean) => setExpandedFor(value ? navigation : null);
  const detailsToggle = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null),
    restart = useRef<HTMLDialogElement>(null);
  const facts = guideFacts(state, ledger);
  const recovery = guideRecovery(state, ledger);
  const recovering = step === 5 && !!facts.review && !facts.saved;
  const activeSteps = short ? [2, 3, 4, 5] : [0, 1, 2, 3, 4, 5, 6];
  function mark(phase: string) {
    try {
      const next = [...new Set([...readVisits(state.sessionId), phase])];
      localStorage.setItem(key, JSON.stringify({ sessionId: state.sessionId, visits: next }));
      setVisits(next);
      setError('');
    } catch {
      setError('Guide progress could not be saved. Retry after restoring browser storage.');
    }
  }
  useEffect(() => {
    const listener = (e: Event) => {
      const phase = (e as CustomEvent<string>).detail;
      if (
        ['preflight', 'surface'].includes(phase) &&
        document.querySelector(`[data-chapter="${phase}"]`)
      )
        mark(phase);
    };
    window.addEventListener('parallax:chapter-inspected', listener);
    return () => window.removeEventListener('parallax:chapter-inspected', listener);
    // A visit is bound to this mission generation; it never stands in for evidence.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.sessionId]);
  useEffect(() => {
    const el = panel.current;
    if (!el) return;
    const header = document.querySelector('.s-header');
    const observer = new ResizeObserver(() => {
      const h =
        header && getComputedStyle(header).position === 'sticky'
          ? header.getBoundingClientRect().height
          : 0;
      el.style.top = `${h}px`;
      document.documentElement.style.setProperty(
        '--guide-offset',
        `${(getComputedStyle(el).position === 'sticky' ? el.getBoundingClientRect().height : 0) + h + 16}px`,
      );
    });
    observer.observe(el);
    if (header) observer.observe(header);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty('--guide-offset');
    };
  }, []);
  useEffect(() => {
    if (!state.monitoringPlans.length) return;
    let closed = false,
      pending = false;
    const poll = async () => {
      if (pending) return;
      pending = true;
      try {
        const { ledgerTransaction } = await import('../monitoring/store');
        const next = await ledgerTransaction();
        if (!closed) {
          setLedger(next);
          setError('');
        }
      } catch {
        if (!closed)
          setError('Monitoring storage is unavailable. No monitoring completion is confirmed.');
      } finally {
        pending = false;
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), 500);
    return () => {
      closed = true;
      clearInterval(timer);
    };
  }, [state.sessionId, state.monitoringPlans.length]);
  useEffect(() => {
    if (location.hash === '#mission/resume') {
      let route: string = guideRoutes[short ? 2 : 0];
      try {
        const saved = localStorage.getItem(key + '.route.' + demoMode);
        if (
          saved &&
          (guideRoutes.includes(saved as (typeof guideRoutes)[number]) ||
            saved === 'mission/health/review/completed')
        )
          route = saved;
      } catch {
        /* Show first step. */
      }
      onNavigate(route);
      return;
    }
    try {
      const route = step === 7 && short ? 'mission/health/review/completed' : guideRoutes[step];
      localStorage.setItem(key + '.route.' + demoMode, route);
    } catch {
      /* Completion still requires persistence. */
    }
    // Navigation updates the contextual guide, including browser Back/Forward.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation]);
  useEffect(() => {
    if (step === 7) return revealTarget('mg-conclusion');
  }, [step, navigation]);
  const actualVisits = readVisits(state.sessionId);
  const complete = [
    actualVisits.includes('preflight'),
    actualVisits.includes('transit'),
    facts.retrieved,
    facts.designated && facts.usable,
    facts.interrupted && facts.acknowledged,
    facts.saved,
    actualVisits.includes('surface'),
  ];
  const firstMissing = activeSteps.find((i) => !complete[i]);
  const done = firstMissing === undefined && !storageFailed && !error;
  const blocked = !editable || storageFailed || !!error;
  function go(n: number) {
    onNavigate(guideRoutes[n]);
  }
  function next() {
    if (blocked) return;
    if (step === 0) {
      if (complete[0]) go(1);
      else reveal('chapter-inspect');
    } else if (step === 1) {
      if (document.querySelector('[data-chapter="transit"] [data-testid="transit-exercise"]')) {
        mark('transit');
        go(2);
      }
    } else if (step === 2) {
      if (facts.retrieved) onNavigate('mission/health/designation');
      else onNavigate('mission/health/assessments');
    } else if (step === 3) {
      if (!facts.designated) onNavigate('mission/health/designation');
      else if (!location.hash.includes('/monitoring')) go(3);
      else if (!facts.usable) reveal('mc-start');
      else {
        reveal('mc-pause');
        go(4);
      }
    } else if (step === 4) {
      if (!facts.interrupted) {
        reveal(facts.run?.status === 'active' ? 'mc-pause' : 'mc-next');
      } else if (facts.acknowledged) go(5);
    } else if (step === 5) {
      if (recovering && recovery) {
        onNavigate(recovery.route);
      } else if (facts.saved) {
        if (short) onNavigate('mission/health/review/completed');
        else go(6);
      } else reveal('m-fictional-review-title');
    } else if (step === 6) {
      if (complete[6]) go(7);
      else reveal('surface-plan');
    } else if (firstMissing !== undefined) go(firstMissing);
  }
  const action =
    step === 0
      ? complete[0]
        ? 'Continue to in-flight observations'
        : 'Review baseline measurements'
      : step === 1
        ? 'Continue to pre-landing review'
        : step === 2
          ? facts.retrieved
            ? 'Set up heart-rate monitoring'
            : 'Inspect and retrieve the exercise record'
          : step === 3
            ? !facts.designated
              ? 'Choose the HR monitoring requirement'
              : !location.hash.includes('/monitoring')
                ? 'Inspect the two simulated sources'
                : !facts.usable
                  ? 'Start synthetic replay'
                  : 'Continue to signal-quality review'
            : step === 4
              ? !facts.interrupted
                ? facts.run?.status === 'active'
                  ? 'Pause replay to inspect'
                  : 'Process next source sample'
                : facts.acknowledged
                  ? 'Continue to human review'
                  : 'Open companion and acknowledge'
              : step === 5
                ? facts.saved
                  ? short
                    ? 'Complete short demonstration'
                    : 'Continue to surface planning'
                  : recovering && recovery
                    ? recovery.title
                    : 'Inspect findings and save review'
                : step === 6
                  ? complete[6]
                    ? 'Complete guided demonstration'
                    : 'Plan the next mobility assessment'
                  : done
                    ? 'Explore PARALLAX'
                    : 'Return to the incomplete action';
  return (
    <aside
      ref={panel}
      className="m-guide"
      aria-label="Guided mission demonstration"
      data-step={step}
    >
      <div className="mg-row">
        <div className="mg-current">
          <span className="mg-step">
            {step === 7
              ? 'Conclusion'
              : `Step ${Math.max(1, activeSteps.indexOf(step) + 1)}/${activeSteps.length}`}
          </span>
          <h2 id="mg-conclusion" tabIndex={-1}>
            {step === 7
              ? done
                ? 'Demonstration completed'
                : 'Some actions still need review'
              : titles[step]}
          </h2>
          <progress
            aria-label="Demonstration actions completed, never readiness"
            value={activeSteps.filter((i) => complete[i]).length}
            max={activeSteps.length}
          />
        </div>
        <div className="mg-primary">
          {(step === 4 && facts.interrupted && !facts.acknowledged) ||
          (recovering && recovery?.companion) ? (
            <a
              className="s-button"
              aria-disabled={blocked}
              href={companionLink(state.sessionId, facts.run?.id ?? '', facts.event?.id)}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => {
                if (blocked) e.preventDefault();
                else setExpanded(false);
              }}
            >
              Open companion and acknowledge
            </a>
          ) : step === 7 && done ? (
            <a className="s-button" href="/#mission/health">
              Explore PARALLAX
            </a>
          ) : (
            <button
              className="s-button"
              disabled={blocked}
              onClick={() => {
                setExpanded(false);
                next();
              }}
            >
              {action}
            </button>
          )}
        </div>
        <button
          ref={detailsToggle}
          type="button"
          className="mg-toggle"
          aria-label="Guide details"
          aria-expanded={expanded}
          aria-controls="mg-guide-details"
          onClick={() => setExpanded(!expanded)}
        >
          Details
        </button>
      </div>
      <div
        id="mg-guide-details"
        className="mg-expanded"
        hidden={!expanded}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setExpanded(false);
            detailsToggle.current?.focus();
          }
        }}
      >
        <div className="mg-heading">
          <p className="m-eyebrow">
            {short ? 'Short judging path' : 'Guided mission demo'} ·{' '}
            {step === 7
              ? 'Conclusion'
              : `Step ${Math.max(1, activeSteps.indexOf(step) + 1)} of ${activeSteps.length}`}{' '}
            · demonstration progress, never readiness
          </p>
          <a href="/#mission">Exit guided demo</a>
        </div>
        {step === 7 ? (
          <p>
            {done
              ? `You retrieved the exercise evidence, processed synthetic wearable observations, inspected the quality interruption, acknowledged the companion event and saved a fictional human review.${short ? ' Baseline, Transit and Surface are optional in the short path.' : ' You also explored baseline, Transit and surface assessment requirements.'} No medical or mission clearance follows.`
              : 'Progress is recalculated from current evidence, the saved designation, ledger and review. Earlier results may have become stale.'}
          </p>
        ) : (
          <details className="mg-context">
            <summary>{contexts[step]} · Why this step</summary>
            <p>{explanations[step]}</p>
          </details>
        )}
        {!editable && <EditingNotice editable={editable} />}
        {storageFailed && (
          <p role="alert">
            Browser persistence failed. The guide cannot confirm completion from memory-only work.
          </p>
        )}
        {error && <p role="alert">{error}</p>}
        {step === 5 && recovery && (
          <p role="status">
            <strong>
              {facts.review
                ? 'Local review and guide progress are separate. '
                : 'Demonstration prerequisite: '}
            </strong>
            {recovery.why}
            {!facts.review && (
              <a
                href={'#' + recovery.route}
                target={recovery.companion ? '_blank' : undefined}
                rel={recovery.companion ? 'noreferrer' : undefined}
              >
                {' '}
                {recovery.title}
              </a>
            )}
          </p>
        )}
        <div className="mg-actions">
          {step > activeSteps[0] && (
            <button
              className="m-text-action"
              onClick={() =>
                go(
                  step === 7
                    ? activeSteps.at(-1)!
                    : activeSteps[Math.max(0, activeSteps.indexOf(step) - 1)],
                )
              }
            >
              Back
            </button>
          )}
          <button className="m-text-action" onClick={() => restart.current?.showModal()}>
            Restart walkthrough
          </button>
          {step === 7 && facts.saved && (
            <a className="m-text-action" href="#mission/health/saved">
              View saved review
            </a>
          )}
        </div>
        {step === 7 && done && (
          <p>
            Continue the assessment cycle by reviewing outstanding requirements and incorporating
            new evidence when available. Surface exploration does not establish that a planning
            request was recorded.{' '}
            <a href="#mission/health/actions">Review outstanding health actions</a> ·{' '}
            <a href="#mission/surface/requirements">Open surface planning</a>
          </p>
        )}
        <details className="mg-progress">
          <summary>Actual completion and navigation</summary>
          <ol>
            {activeSteps.map((i) => (
              <li key={i}>
                <button className="m-text-action" onClick={() => go(i)}>
                  {titles[i]} · {complete[i] ? 'completed' : 'still to review'}
                </button>
              </li>
            ))}
          </ol>
          <p>
            Chapter inspection means exploration. Monitoring and review require committed evidence.
            Back and restart walkthrough preserve records, reviews and unresolved events. Use
            Restart mission for an explicit new generation.
          </p>
        </details>
      </div>
      <dialog ref={restart} className="s-dialog" aria-labelledby="mg-restart">
        <h2 id="mg-restart">Restart the walkthrough?</h2>
        <p>
          This resets chapter-inspection progress only. Retrieved evidence, saved reviews and
          protected monitoring events remain. Use Restart mission to start a new evidence
          generation.
        </p>
        <button className="s-button s-secondary" onClick={() => restart.current?.close()}>
          Keep progress
        </button>
        <button
          className="s-button"
          onClick={() => {
            try {
              localStorage.setItem(key, JSON.stringify({ sessionId: state.sessionId, visits: [] }));
              setVisits([]);
              restart.current?.close();
              go(short ? 2 : 0);
            } catch {
              setError('Walkthrough restart could not be saved.');
            }
          }}
        >
          Restart walkthrough with retained evidence
        </button>
      </dialog>
    </aside>
  );
}
