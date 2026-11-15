import { revealTarget } from './navigation';
import { useEffect } from 'react';
import { missionPhases, type MissionPhase } from './context';
import { missionChapter, surfaceDiary, validateSurfaceDiary } from './chapters';
import { DescriptiveCards } from './RichObservations';
import { formatNumber, signed } from '../core/engine';
import { comparisonBridge } from './bridge';
import { SourceRecords } from './Records';
import { PlanningRequest } from './PlanningRequest';
import './mission.css';
export function ChapterNavigation({ active }: { active: MissionPhase }) {
  return (
    <nav className="m-chapter-nav" aria-label="Mission chapters">
      {missionPhases.map((p) => (
        <a
          key={p}
          className="s-button s-secondary"
          aria-current={p === active ? 'page' : undefined}
          href={p === 'approach' ? '#mission/health' : `#mission/${p}`}
        >
          {p[0].toUpperCase() + p.slice(1)}
        </a>
      ))}
    </nav>
  );
}
export default function Chapters({
  phase,
  navigation,
}: {
  phase: MissionPhase;
  navigation?: object;
}) {
  if (phase === 'surface') validateSurfaceDiary(surfaceDiary, '2040-06-30T18:00:00Z');
  const model = missionChapter(phase);
  const { context, records } = model;
  const exercise = records.filter((r) => r.measurement === 'exercise-hr');
  const exercisePair =
    phase === 'transit'
      ? comparisonBridge(context, exercise, {
          policy: 'explicit-assessment-selection-v1',
          recordIds: exercise.map((r) => r.id),
        }).findings.find((f) => f.id === 'hr')?.comparison
      : undefined;
  useEffect(() => {
    if (location.hash.endsWith('/completed')) return;
    if (phase === 'surface' && location.hash.includes('/requests')) {
      const details = document.getElementById(
        'saved-request-surface-mobility',
      ) as HTMLDetailsElement | null;
      if (details) {
        details.open = true;
        return revealTarget('saved-request-surface-mobility-title');
      }
    }
    if (phase === 'surface' && location.hash.includes('/requirements')) {
      const details = document.getElementById('surface-requirements') as HTMLDetailsElement;
      details.open = true;
      return revealTarget('surface-requirements-title');
    }
    return revealTarget('chapter-title');
  }, [phase, navigation]);
  return (
    <div className="m-experience m-chapter s-wrap" data-chapter={phase}>
      <ChapterNavigation active={phase} />
      <header className="m-health-heading">
        <p className="m-eyebrow">Fictional longitudinal record · chapter exploration</p>
        <h1 id="chapter-title" tabIndex={-1}>
          {phase === 'preflight'
            ? 'Start with your personal baseline.'
            : phase === 'transit'
              ? 'See how your recorded measurements changed in transit.'
              : 'A new environment. New assessment questions.'}
        </h1>
        <p>
          {context.fictionalNow.slice(0, 10)} · {context.gravity} · Alex Morgan, fictional crew
          member.
        </p>
        <p>
          This chapter shows only records available by its declared time. Your active Approach
          review, record membership, monitoring and saved reviews retain their own state.
        </p>
      </header>
      {phase === 'preflight' && (
        <>
          <p>
            Before departure, PARALLAX brings your recorded reference measurements together. These
            establish what was observed about you, rather than relying on averages from other
            astronauts.
          </p>
          <div className="m-baseline-grid">
            {records.map((r) => (
              <article className="m-observation" key={r.id}>
                <h2>
                  {r.measurement === 'leg-press-force'
                    ? 'Leg-press force'
                    : r.measurement === 'vo2peak'
                      ? 'Peak oxygen uptake'
                      : r.measurement === 'preflight-exercise-hr'
                        ? 'Exercise heart rate'
                        : 'Reported sleep duration'}
                </h2>
                <strong className="m-rich-value">
                  {r.measurement === 'vo2peak' ? r.value.toFixed(1) : formatNumber(r.value)}{' '}
                  {r.unit}
                </strong>
                <p>{r.timestamp.slice(0, 10)} · Earth 1 g</p>
                <p>
                  {r.measurement === 'leg-press-force'
                    ? 'One recorded isometric lower-body force reference for a compatible later assessment.'
                    : r.measurement === 'vo2peak'
                      ? 'Peak cycle gas analysis. A personal oxygen-uptake reference, separate from heart rate.'
                      : r.measurement === 'preflight-exercise-hr'
                        ? '100 W cycling, final-minute acquisition. Future comparisons require compatible conditions.'
                        : 'Diary report over the preceding 24 hours. A reference for equivalent reporting periods.'}
                </p>
                <p className="m-fine">
                  {r.acquisition.device}. This record establishes no normal range, diagnosis or
                  clearance.
                </p>
              </article>
            ))}
          </div>
          <button
            id="chapter-inspect"
            className="s-button"
            onClick={() => {
              const el = document.getElementById('chapter-records') as HTMLDetailsElement;
              el.open = true;
              el.scrollIntoView({ block: 'start' });
              el.querySelector('summary')?.focus();
            }}
          >
            Review baseline measurements
          </button>
        </>
      )}
      {phase === 'transit' && (
        <>
          <h2>Available in-flight paired observations</h2>
          <DescriptiveCards
            model={{ descriptive: model.descriptive, records, excludedRecordIds: [] }}
          />
          <article className="m-observation" data-testid="transit-exercise">
            <p className="m-chip is-historical">
              Longitudinal archive · active membership is separate
            </p>
            <h2>Recorded exercise response</h2>
            {exercisePair && (
              <>
                <strong className="m-rich-value">
                  {exercisePair.baseline.value} → {exercisePair.followup.value} bpm at 100 W
                </strong>
                <p>
                  {signed(exercisePair.absolute)} bpm between recorded sessions. Final-minute
                  acquisition under matching declared conditions.
                </p>
              </>
            )}
            <p>
              The archive contains a later exercise observation. Add it to the active health review
              when you prepare for landing. This chapter adds no records to that review.
            </p>
            <p>No reduced fitness or cardiovascular disease is established.</p>
          </article>
        </>
      )}
      <section className="m-observation">
        <h2>
          {phase === 'preflight'
            ? 'Reference assessments on Earth'
            : phase === 'transit'
              ? 'Available in-flight observations'
              : 'Historical evidence carried forward'}
        </h2>
        <p>
          {phase === 'preflight'
            ? 'The 1,000 N leg-press reference, preflight cycle record, gas-analysis assessment and diary describe separate endpoints. A future comparison needs the same endpoint and compatible protocol, equipment and environment. Transit has not occurred in this chapter.'
            : phase === 'transit'
              ? 'The fictional exercise archive contains 125 and 140 bpm at 100 W. Separate gas-analysis records show 2.8 and 2.7 L/min; equivalent diary periods report 7.5 and 6.5 h. Acquisition declarations permit descriptive comparisons, with no diagnosis or cause inferred.'
              : 'Preflight and microgravity records remain historical. Earth force, exercise HR and oxygen uptake cannot establish walking or balance on Mars at an illustrative 0.38 g.'}
        </p>
        <details
          id="chapter-records"
          className="m-details"
          onToggle={(event) => {
            if (event.currentTarget.open)
              window.dispatchEvent(
                new CustomEvent('parallax:chapter-inspected', { detail: phase }),
              );
          }}
        >
          <summary>Inspect dated records and acquisition information</summary>
          <SourceRecords
            records={records}
            excluded={[]}
            status="Longitudinal archive · chapter only"
          />
        </details>
      </section>
      {phase === 'surface' && (
        <>
          <section className="m-observation" aria-label="Historical physiological records">
            <h2>Earlier physiological observations · historical</h2>
            <dl className="m-surface-history">
              {records
                .filter(
                  (r) => r.comparisonRole === 'followup' || r.measurement === 'leg-press-force',
                )
                .map((r) => (
                  <div key={r.id}>
                    <dt>
                      {r.measurement === 'leg-press-force'
                        ? 'Preflight leg-press force'
                        : r.measurement === 'exercise-hr'
                          ? 'Exercise HR at 100 W'
                          : r.measurement === 'vo2peak'
                            ? 'Recorded peak oxygen uptake'
                            : 'Reported sleep'}
                    </dt>
                    <dd>
                      <strong>
                        {formatNumber(r.value)} {r.unit}
                      </strong>{' '}
                      · {r.timestamp.slice(0, 10)} · {r.gravity} · historical
                    </dd>
                  </div>
                ))}
            </dl>
            <p>
              These earlier records establish no current Mars force, balance or mobility result.
            </p>
          </section>
          <section className="m-observation">
            <h2>Recorded surface crew report</h2>
            <p>{surfaceDiary.text}</p>
            <p className="m-fine">
              {surfaceDiary.timestamp} · {surfaceDiary.sourceId} · self-report; no validated
              mobility performance.
            </p>
          </section>

          <section className="m-observation">
            <h2>Surface assessment requirements</h2>
            <button
              id="surface-plan"
              className="s-button"
              onClick={() => {
                const el = document.getElementById('surface-requirements') as HTMLDetailsElement;
                el.open = true;
                el.scrollIntoView({ block: 'start' });
                el.querySelector('summary')?.focus();
              }}
            >
              Plan the next mobility assessment
            </button>
            <details
              id="surface-requirements"
              onToggle={(event) => {
                if (event.currentTarget.open)
                  window.dispatchEvent(
                    new CustomEvent('parallax:chapter-inspected', { detail: 'surface' }),
                  );
              }}
            >
              <summary id="surface-requirements-title">
                Inspect mobility planning requirements
              </summary>
              <p>
                The lander-to-habitat task needs applicable walking, balance and transfer evidence.
                Select an authorised task-specific method; its Mars validity is not established
                here. Confirm suitable instrumentation, gravity applicability, qualified assistance,
                fall protection and medical oversight before any physical assessment. Historical
                physiological records cannot supply these outcomes.
              </p>
            </details>
            <p>
              Document the task question, approved method, equipment, qualified assistance and
              medical oversight. The applicable Mars mobility protocol remains unestablished.
            </p>
            <ul>
              <li>Define the lander-to-habitat task and required evidence.</li>
              <li>Review gravity and equipment applicability.</li>
              <li>Establish qualified assistance and oversight.</li>
              <li>Retain the missing compatible current strength result.</li>
            </ul>
            <PlanningRequest need="surface-mobility" />
            <a href="https://humanresearchroadmap.nasa.gov/Gaps/gap.aspx?i=695">
              NASA SM-204 research gap
            </a>
          </section>
        </>
      )}
      <section className="m-next-action">
        <div>
          <h2>
            {phase === 'preflight'
              ? 'Continue to Transit'
              : phase === 'transit'
                ? 'Enter the active Approach review'
                : 'Return to the active Approach review'}
          </h2>
          <p>
            {phase === 'transit'
              ? 'Use explicit archive retrieval, interpretation, monitoring designation and synthetic replay in the active review.'
              : 'Chapter exploration supplies context; active human review remains separate.'}
          </p>
        </div>
        <a
          className="s-button"
          href={phase === 'preflight' ? '#mission/transit' : '#mission/health'}
        >
          {phase === 'preflight' ? 'Explore Transit' : 'Open Approach review'}
        </a>
        {phase === 'transit' && (
          <a className="s-link" href="#mission/monitoring">
            Explore actual monitoring workflow
          </a>
        )}
      </section>
    </div>
  );
}
