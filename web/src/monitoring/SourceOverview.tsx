import type { MissionState } from '../mission/state';
import { missionOverview } from '../mission/overview';
import { signed } from '../core/engine';
export function SourceOverview({
  state,
  designated,
  status,
}: {
  state: MissionState;
  designated: boolean;
  status?: string;
}) {
  const model = missionOverview(state),
    c = model.exerciseComparison;
  const early = model.records.find(
    (r) =>
      r.measurement === 'exercise-hr' &&
      r.comparisonRole === 'baseline' &&
      !state.excludedRecordIds.includes(r.id),
  );
  const archive = model.archivedRecords.find((r) => r.measurement === 'exercise-hr');
  return (
    <section className="mc-sources" aria-label="Two simulated equipment sources">
      <article>
        <p className="m-chip is-historical">Simulated wearable source</p>
        <h2>Wearable monitor</h2>
        <p>Synthetic Astroskin-format source</p>
        <strong>
          {designated
            ? status
              ? `Synthetic replay ${status}`
              : 'Ready for simulated monitoring'
            : 'Choose a monitoring requirement to begin'}
        </strong>
        <p>
          Original synthetic commercial-format HR and aligned quality records. Spaceflight context:
          CSA Bio-Monitor; this parser implements only the commercial HR/quality subset.
        </p>
        <p className="m-fine">
          Unknown activity, workload and absolute acquisition time. No flight-system compatibility,
          physical connection, service access or clinical validation.
        </p>
        <details>
          <summary>Source capabilities and references</summary>
          <p>
            HR channel 19 and quality channel 1000 only. Quality can withhold a retained raw HR. No
            other biometric channels are processed.
          </p>
          <a href="https://www.asc-csa.gc.ca/eng/sciences/bio-monitor.asp">
            CSA Bio-Monitor context
          </a>{' '}
          ·{' '}
          <a href="https://astro.hexoskin.com/docs/resource/datatype/">
            Commercial datatype definitions
          </a>{' '}
          ·{' '}
          <a href="https://astro.hexoskin.com/docs/resource/data/">
            Commercial data representation
          </a>
        </details>
      </article>
      <article data-testid="exercise-source">
        <p className="m-chip is-historical">Stored exercise sessions · simulated</p>
        <h2>Cycle ergometer</h2>
        <p>Synthetic CEVIS-inspired exercise records</p>
        <strong className="mc-exercise-values">
          {c
            ? `${c.baseline.value} → ${c.followup.value} bpm`
            : early
              ? `${early.value} bpm · earlier record`
              : 'No usable active exercise pair'}
        </strong>
        <p>100 W cycling · final-minute acquisition · fictional microgravity sessions.</p>
        <p>
          {c
            ? `${signed(c.absolute)} bpm under matching declared conditions. This describes two stored sessions, never a continuous stream or current wearable reading.`
            : archive
              ? `${archive.value} bpm on ${archive.timestamp.slice(0, 10)} is archive-only. Inspect and retrieve it before interpreting a change in the active review.`
              : 'A compatible included follow-up is needed; excluded or incompatible records do not support a change.'}
        </p>
        <p className="m-fine">
          PARALLAX-defined validated record representation. No official CEVIS export, native
          integration, telemetry, SDK or equipment control. No disease or reduced fitness
          conclusion.
        </p>
        <details>
          <summary>Exercise source and acquisition details</summary>
          <p>
            {model.records
              .filter((r) => r.measurement === 'exercise-hr')
              .map(
                (r) =>
                  `${r.timestamp}: ${r.value} ${r.unit}; ${state.excludedRecordIds.includes(r.id) ? 'excluded' : 'active membership'}; ${r.protocol}; ${r.acquisition.device}`,
              )
              .join(' · ')}
          </p>
          <a href="https://www.nasa.gov/missions/station/iss-research/astronaut-exercise/">
            NASA astronaut exercise
          </a>{' '}
          ·{' '}
          <a href="https://www.nasa.gov/ochmo-tb-031-exercise-overview-2/">
            NASA Exercise Overview
          </a>
        </details>
      </article>
      <div className="mc-health-context">
        <strong>Other recorded health context · separate sources</strong>
        {model.descriptive.map((p) => (
          <p key={p.measurement}>
            {p.measurement === 'vo2peak'
              ? 'Gas analysis · recorded absolute VO₂peak'
              : 'Crew diary · reported sleep'}
            :{' '}
            {p.supported
              ? `${p.early!.value} → ${p.late!.value} ${p.early!.unit}; difference ${p.difference} ${p.early!.unit}`
              : 'comparison withheld'}
            . No cause, fatigue impairment or surface capability established.
          </p>
        ))}
        <p>
          Current force and surface mobility remain unresolved. Neither source supplies oxygen
          uptake or diary sleep.
        </p>
      </div>
    </section>
  );
}
