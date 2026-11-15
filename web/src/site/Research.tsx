import { lazy, Suspense } from 'react';
const AggregateDemo = lazy(() => import('../research/AggregateDemo'));
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import {
  researchPublication as pub,
  researchGroups,
  researchOutcomes,
  researchAssociations,
  researchAssociationMethod,
} from '../data/research';
import { richSources } from '../mission/richEvidence';
import { sources, sourceById } from '../data/science';
import { AssociationBars, CohortBars } from './charts';
import { Photo } from './common';

const groups = researchGroups.map((g) => ({
  id: g.id,
  n: g.n,
  label:
    g.id === 'iss'
      ? 'ISS astronauts'
      : g.id === 'control'
        ? 'Bed rest, no exercise'
        : 'Bed rest with exercise',
}));
const walk = researchOutcomes.find((o) => o.id === 'walk')!;
const sway = researchOutcomes.find((o) => o.id === 'sway')!;

const sourceGroups = [
  { title: 'Quantitative findings and study design', ids: ['study', 'bed-rest'] },
  {
    title: 'Human performance and medical standards',
    ids: ['performance', 'exercise-overview', 'medical-operations', 'health-care', 'medical-care'],
  },
  { title: 'Exercise equipment and monitoring', ids: ['cevis', 'exercise-systems'] },
  {
    title: 'Hazards, health risks and education',
    ids: [
      'hazards',
      'cardiovascular',
      'fitness',
      'sensorimotor',
      'sensorimotor-detail',
      'aerobic',
      'egress',
      'exercise',
      'ongoing',
      'distance',
    ],
  },
  { title: 'Medical operations beyond immediate Earth support', ids: ['eimo', 'cds-conops'] },
];

/**
 * Published group research only. Fictional individual records never appear here.
 * `onScenarios` is omitted in the neutral evaluation condition.
 */
export function Research({ onScenarios }: { onScenarios?: () => void }) {
  return (
    <div className="r-page" data-testid="research">
      <section className="r-hero s-wrap" aria-labelledby="research-title">
        <div>
          <p className="r-label">Published group research · Mulavara et al., 2018</p>
          <h1 id="research-title" tabIndex={-1}>
            Why can strength hold up while everyday tasks get harder?
          </h1>
          <p>
            A NASA-associated study tested 13 ISS astronauts and 19 bed-rest volunteers before and
            after long periods of reduced loading. In one group, leg strength showed no significant
            drop while functional tasks still took longer.
          </p>
        </div>
        <Photo
          src="/images/exercise-research-original.webp"
          alt="AI-generated illustration of generic exercise research equipment in a fictional orbital laboratory"
          credit="Original AI-generated illustration · fictional equipment, not a record of a real study."
        />
      </section>

      {onScenarios && (
        <Suspense fallback={<p role="status">Opening aggregate experiment…</p>}>
          <AggregateDemo />
        </Suspense>
      )}
      {onScenarios && (
        <section
          className="r-section s-wrap m-research-map"
          aria-label="How research affects the product"
        >
          <h2>From scientific evidence to product behaviour</h2>
          <div className="m-rich-grid">
            {[
              [
                'Why health changes during spaceflight',
                'Reduced loading and gravity transitions can affect different systems. Group research supplies context for review, not an individual prediction.',
                '#mission/transit',
                'Explore Transit observations',
              ],
              [
                'Why distinct measurements answer distinct questions',
                'Force, postural HR response, exercise HR, oxygen uptake and reported sleep retain separate definitions.',
                '#scenarios/complete-health-record/1',
                'Inspect a complete health record',
              ],
              [
                'Why acquisition conditions matter',
                'Compare compatible endpoints and conditions. Try the published aggregate experiment below.',
                '#scenarios/incompatible-measurements/1',
                'Compare acquisition conditions',
              ],
              [
                'How measurement quality affects monitoring',
                'A raw 72 bpm is withheld when the source quality becomes unusable. An explicit designation precedes synthetic replay.',
                '#mission/monitoring',
                'Open the monitoring console',
              ],
              [
                'How mission context affects feasibility',
                'Microgravity cycling cannot establish post-landing mobility. Surface planning retains the unresolved method and oversight.',
                '#mission/surface',
                'Explore surface requirements',
              ],
              [
                'Sources and limitations',
                'Mulavara and Clément group findings remain separate from every fictional individual record. Primary sources and numerical alternatives follow.',
                '#research',
                'Inspect the sources below',
              ],
            ].map(([title, copy, href, label]) => (
              <article className="m-observation" key={title}>
                <h3>{title}</h3>
                <p>{copy}</p>
                {href === '#research' ? (
                  <button
                    className="s-link"
                    onClick={() => {
                      const el = document.getElementById('research-sources') as HTMLDetailsElement;
                      el.open = true;
                      el.querySelector('summary')?.focus();
                      el.scrollIntoView({ block: 'start' });
                    }}
                  >
                    {label}
                  </button>
                ) : (
                  <a className="s-link" href={href}>
                    {label}
                  </a>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="r-section s-wrap" aria-labelledby="groups-title">
        <div className="r-section-head">
          <h2 id="groups-title">Both functional tests rose in all three groups</h2>
          <p>
            Change in the estimated median from before exposure to the first test after it.
            Astronauts were tested about one day after landing. Bed-rest volunteers were tested
            right after getting up from 70 days of head-down bed rest.
          </p>
        </div>
        <div className="r-multiples">
          <CohortBars
            title={walk.label}
            metric="Completion time, % change"
            values={walk.values}
            groups={groups}
          />
          <CohortBars
            title={sway.label}
            metric="Postural sway speed, % change"
            values={sway.values}
            groups={groups}
          />
        </div>
        <p className="s-fine">
          Common axis, 0 to +80%. Rounded published estimates; uncertainty intervals were not
          transcribed, so none are drawn. n is enrolled group size. Seat Egress and Walk is a
          laboratory task, not actual spacecraft egress. Bed rest on Earth is an imperfect analog of
          spaceflight; astronauts also exercised in flight.
        </p>
      </section>

      <section className="r-section r-contrast s-wrap" aria-labelledby="exercise-title">
        <div className="r-section-head">
          <h2 id="exercise-title">
            In the exercise group, strength showed no significant drop. The task still slowed.
          </h2>
          <p>
            Bed-rest volunteers who exercised (n = 9) showed no significant decrease in lower-body
            force, power or work. Their functional results still changed.
          </p>
        </div>
        <div className="r-contrast-grid">
          <div className="r-qualitative">
            <span>Lower-body force, power and work</span>
            <strong>No significant decrease</strong>
            <p>
              Reported qualitatively. No estimate is drawn because exact values were not
              transcribed. Not significant does not prove that nothing changed.
            </p>
          </div>
          <div className="r-quantitative">
            <p>
              <strong>+{walk.values.exercise}%</strong> Seat Egress and Walk completion time
            </p>
            <p>
              <strong>+{sway.values.exercise}%</strong> Recovery from Fall/Stand sway speed
            </p>
          </div>
        </div>
      </section>

      <section className="r-section s-wrap" aria-labelledby="assoc-title">
        <div className="r-section-head">
          <h2 id="assoc-title">Seven body measurements tracked with task time</h2>
          <p>
            Somers’ D runs from −1 to +1. A negative value means the two changes tended to move in
            opposite directions: larger force losses went with larger increases in task time. These
            are group associations, not causes or predictions for one person.
          </p>
        </div>
        <AssociationBars rows={researchAssociations} />
        <p className="s-fine">
          Changes in each measure against Seat Egress and Walk completion-time change, pooled across
          the three groups. All seven meet the study’s P &lt; 0.003 threshold.
        </p>
      </section>

      <section className="r-section r-bridge s-wrap" aria-labelledby="bridge-title">
        <h2 id="bridge-title">What this means for PARALLAX</h2>
        <ol className="r-flow">
          <li>
            <strong>Group results</strong>
            <span>show which measurements can move apart</span>
          </li>
          <li>
            <strong>The review question</strong>
            <span>asks what changed for one person</span>
          </li>
          <li>
            <strong>That person’s records</strong>
            <span>are the only evidence that can answer it</span>
          </li>
        </ol>
        <p>
          PARALLAX never fills a missing personal record with a published value, and the evidence
          engine does not use these coefficients as weights.
        </p>
        {onScenarios && (
          <a className="s-button" href="#scenarios/complete-health-record/1">
            Inspect a complete health record <ArrowRight size={17} aria-hidden="true" />
          </a>
        )}
      </section>

      <section className="r-more s-wrap" aria-label="Methods, values and sources">
        <details className="g-disclosure">
          <summary>Methods and statistical limits</summary>
          <p>{pub.method}</p>
          <p>{pub.limitations}</p>
          <p>{researchAssociationMethod}</p>
          <p>
            Task demands: Activity Board and Hatch Opening showed no significant pre/post change in
            any group. Exercisers also showed no significant change on Object Translation or Jump
            Down, while Seat Egress and Walk, Recovery from Fall/Stand and Ladder Climb remained
            harder. This is a task-specific contrast, not a claim that exercise failed or protected
            every capability. Pre/post tests used an FDR 1% threshold of P &lt; 0.008.
          </p>
          <p>
            The laboratory endpoint is not equated with actual spacecraft egress or the archive
            variable <code>UpEgrFinishTime</code>.
          </p>
        </details>
        <details className="g-disclosure">
          <summary>All published values</summary>
          <table className="r-table">
            <caption>Percent change in estimated median, pre to first post exposure</caption>
            <thead>
              <tr>
                <th>Group</th>
                <th>Exposure and timepoint</th>
                <th>{walk.label}</th>
                <th>{sway.label}</th>
              </tr>
            </thead>
            <tbody>
              {researchGroups.map((g) => (
                <tr key={g.id}>
                  <th scope="row">
                    {g.label} (n = {g.n})
                  </th>
                  <td>
                    {g.exposure}. {g.timepoint}. {g.context}
                  </td>
                  <td>+{walk.values[g.id]}%</td>
                  <td>+{sway.values[g.id]}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            {walk.label}: {walk.definition} {sway.label}: {sway.definition}
          </p>
          <p>
            Locators: {walk.locator}. {sway.locator}.
          </p>
          <table className="r-table">
            <caption>Somers’ D with Seat Egress and Walk completion-time change</caption>
            <thead>
              <tr>
                <th>Measure</th>
                <th>System</th>
                <th>Original unit</th>
                <th>Somers’ D</th>
              </tr>
            </thead>
            <tbody>
              {researchAssociations.map((a) => (
                <tr key={a.measure}>
                  <th scope="row">{a.label}</th>
                  <td>{a.domain}</td>
                  <td>{a.originalUnit}</td>
                  <td>{a.d.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>{pub.reuse}</p>
          <a href={pub.url} target="_blank" rel="noreferrer">
            Read the primary publication <ArrowUpRight size={14} aria-hidden="true" />
          </a>
        </details>
        <details className="g-disclosure" id="research-sources">
          <summary>
            All {sources.length + (onScenarios ? richSources.length : 0)} scientific sources
          </summary>
          {onScenarios &&
            richSources.map((s) => (
              <article key={s.id}>
                <h3>
                  <a href={s.url}>{s.label}</a>
                </h3>
                <p>{s.boundary}</p>
              </article>
            ))}
          {sourceGroups.map((g) => (
            <section key={g.title} className="r-sources">
              <h3>{g.title}</h3>
              {g.ids.map((id) => {
                const s = sourceById(id);
                return (
                  <article key={id}>
                    <a href={s.url} target="_blank" rel="noreferrer">
                      {s.title} <ArrowUpRight size={13} aria-hidden="true" />
                    </a>
                    <span>
                      {s.publisher} · {s.locator}
                    </span>
                    <p>
                      {s.statement} {s.boundary}
                    </p>
                  </article>
                );
              })}
            </section>
          ))}
        </details>
        <details className="g-disclosure">
          <summary>Scope of PARALLAX</summary>
          <p>
            PARALLAX focuses on evidence review around altered gravity and on preparing a review
            locally when Earth support is delayed. NASA also identifies space radiation, isolation
            and confinement, and hostile closed environments; those hazards are outside the
            prototype’s scope. No clinical or operational validation is claimed.
          </p>
          <p>
            Offline use: load the production app once online and wait until the workspace shows
            “Offline cache ready”. The same browser and address can then reload without a
            connection. Source links and a first visit need one.
          </p>
          <p>
            <a href="https://www.nasa.gov/hrp/hazards/" target="_blank" rel="noreferrer">
              NASA Five Hazards
            </a>{' '}
            ·{' '}
            <a
              href="https://www.nasa.gov/hrp/hazard-distance-from-earth/"
              target="_blank"
              rel="noreferrer"
            >
              NASA distance from Earth
            </a>{' '}
            · <a href="/evaluation.txt">Software verification record</a>
          </p>
        </details>
      </section>
    </div>
  );
}
