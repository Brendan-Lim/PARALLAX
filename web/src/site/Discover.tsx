import { ArrowRight } from 'lucide-react';
import { evaluate, formatNumber } from '../core/engine';
import { freshCase } from '../data/cases';
import { MeasureBars } from './charts';
import { movement } from './common';
import { guidedScenarios } from './guidedState';
import { ScenarioGlyph } from './Guided';

// The introductory comparison is the fictional DEMO-01 case, evaluated by the shared engine.
const intro = freshCase('DEMO-01');
const introFindings = evaluate(intro);
const force = introFindings.find((f) => f.id === 'force')!;
const task = introFindings.find((f) => f.id === 'task')!;

const first = `#scenarios/${guidedScenarios.find((s) => s.key === 'missing')!.slug}/1`;

export function Discover() {
  return (
    <div className="d-page">
      <section className="d-hero" aria-labelledby="page-title">
        <img
          className="d-hero-img"
          src="/images/exercise-context-original.webp"
          alt="AI-generated illustration of an unoccupied exercise cycle in a fictional deep-space habitat"
          width="1536"
          height="1024"
          fetchPriority="high"
        />
        <div className="d-hero-copy s-wrap">
          <h1 id="page-title" tabIndex={-1}>
            Stronger muscles.
            <br />
            Slower movement.
          </h1>
          <p>
            An astronaut’s leg strength can rise while a simple task takes longer. PARALLAX helps
            reviewers see what each health measurement shows, and what is still unknown.
          </p>
          <a className="s-button s-on-dark" href={first}>
            Explore the first scenario <ArrowRight size={18} aria-hidden="true" />
          </a>
        </div>
        <p className="d-hero-credit s-wrap">
          Original AI-generated illustration · fictional exercise habitat, not a real mission
          photograph.
        </p>
      </section>

      <section className="d-contrast s-wrap" aria-labelledby="contrast-title">
        <div className="d-section-head">
          <h2 id="contrast-title">
            Force {movement(force)}. The task took {formatNumber(task.comparison!.relative ?? 0)}%
            longer.
          </h2>
          <p>
            One fictional crew member, measured on Earth before and after a mission. Higher force
            does not show that the task got easier, and a slower time is not a diagnosis.
          </p>
        </div>
        <div className="d-contrast-charts">
          <MeasureBars
            packet={intro}
            unavailable={[]}
            measure="force"
            title="Leg-press force"
            caption={`${formatNumber(force.comparison!.absolute)} N higher. Longer bar = more force.`}
          />
          <MeasureBars
            packet={intro}
            unavailable={[]}
            measure="task"
            title="Time to stand and walk a short course"
            caption={`${formatNumber(task.comparison!.absolute)} s slower. Longer bar = slower task.`}
          />
        </div>
        <p className="d-label">Fictional example · not a NASA participant</p>
      </section>

      <section className="d-how" aria-labelledby="how-title">
        <div className="s-wrap">
          <h2 id="how-title">How PARALLAX helps</h2>
          <ol className="d-steps">
            <li>
              <StepDiagram kind="measure" />
              <h3>Understand the measurements</h3>
              <p>See each before-and-after record on its own scale, with units and sessions.</p>
            </li>
            <li>
              <StepDiagram kind="uncertain" />
              <h3>Investigate what is uncertain</h3>
              <p>
                Find records that are missing, collected under different conditions, or copied from
                another record.
              </p>
            </li>
            <li>
              <StepDiagram kind="review" />
              <h3>Prepare the next review action</h3>
              <p>
                Keep the open question with its source records and pass it to a qualified reviewer.
              </p>
            </li>
          </ol>
        </div>
      </section>

      <section className="d-users s-wrap" aria-labelledby="users-title">
        <figure className="s-photo d-users-photo">
          <img
            src="/images/health-context-original.webp"
            alt="AI-generated illustration of an unoccupied health observation station in a fictional habitat"
            width="1536"
            height="1024"
            loading="lazy"
          />
          <figcaption>
            Original AI-generated illustration · fictional health observation station.
          </figcaption>
        </figure>
        <div>
          <h2 id="users-title">For the people who review crew health</h2>
          <dl className="d-user-list">
            <div>
              <dt>Astronauts</dt>
              <dd>checking their own records during a mission</dd>
            </div>
            <div>
              <dt>Crew medical officers</dt>
              <dd>reviewing records and how they were collected, on board</dd>
            </div>
            <div>
              <dt>Qualified ground reviewers</dt>
              <dd>receiving a clear question with its evidence when communication allows</dd>
            </div>
          </dl>
          <p className="s-fine">
            Intended users. No astronaut, medical officer or NASA reviewer has tested PARALLAX.
          </p>
        </div>
      </section>

      <section className="d-scenarios s-wrap" aria-labelledby="scenarios-title">
        <h2 id="scenarios-title">Explore the demonstration library</h2>
        <ul className="d-scenario-list">
          {guidedScenarios.map((s) => (
            <li key={s.key}>
              <a href={`#scenarios/${s.slug}/1`}>
                <ScenarioGlyph scenario={s.key} />
                <strong>{s.title}</strong>
                <span>{s.summary}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="d-close" aria-labelledby="close-title">
        <div className="s-wrap">
          <h2 id="close-title">Start with a missing result.</h2>
          <p>Five steps, fictional records, one question at a time.</p>
          <a className="s-button s-on-dark" href={first}>
            Explore the first scenario <ArrowRight size={18} aria-hidden="true" />
          </a>
        </div>
      </section>
    </div>
  );
}

/** Original step diagrams: paired bars, an interrupted record, a question attached to records. */
function StepDiagram({ kind }: { kind: 'measure' | 'uncertain' | 'review' }) {
  return (
    <svg className="d-step-diagram" viewBox="0 0 160 88" aria-hidden="true">
      {kind === 'measure' && (
        <>
          <path d="M16 12V76" className="dg-axis" />
          <rect x="16" y="22" width="92" height="14" rx="2" className="dg-before" />
          <rect x="16" y="48" width="122" height="14" rx="2" className="dg-after" />
        </>
      )}
      {kind === 'uncertain' && (
        <>
          <path d="M16 12V76" className="dg-axis" />
          <rect x="16" y="22" width="92" height="14" rx="2" className="dg-before" />
          <rect x="16.5" y="48.5" width="121" height="13" rx="2" className="dg-gap" />
          <text x="72" y="59" className="dg-text">
            ?
          </text>
        </>
      )}
      {kind === 'review' && (
        <>
          <rect x="20" y="12" width="64" height="64" rx="4" className="dg-doc" />
          <path d="M32 30H72M32 42H72M32 54H58" className="dg-axis" />
          <path d="M92 44H128" className="dg-arrow" />
          <path d="M122 38l8 6-8 6" className="dg-arrow" />
          <circle cx="142" cy="44" r="8" className="dg-person" />
        </>
      )}
    </svg>
  );
}
