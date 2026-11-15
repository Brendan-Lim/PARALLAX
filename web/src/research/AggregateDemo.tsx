import { useState } from 'react';
import {
  compareAggregate,
  tandemRegister as source,
  type EyesCondition,
  type StudyGroup,
} from './aggregate';
const number = (value: number) =>
  value.toLocaleString('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
const signed = (value: number) => (value > 0 ? '+' : '') + number(value);
export default function AggregateDemo() {
  const [group, setGroup] = useState<StudyGroup>('Exercise');
  const [before, setBefore] = useState<EyesCondition>('eyes-closed');
  const [after, setAfter] = useState<EyesCondition>('eyes-closed');
  const result = compareAggregate(group, before, after);
  return (
    <section
      className="r-section s-wrap"
      aria-labelledby="aggregate-title"
      data-testid="aggregate-demo"
    >
      <p className="r-agg-kicker">Interactive · published group data</p>
      <h2 id="aggregate-title">An available number still needs matching conditions</h2>
      <p className="r-agg-question">
        When can the same data tell a misleading story? Change the eyes condition before or after
        bed rest and watch the comparison.
      </p>
      <p>
        Clément et al. (2024) · published scientific aggregate. {source.population} Four groups:
        Control, Exercise, LBNP and Seated. These are ground-study group means.
      </p>
      <p>
        The mission's heart-rate observations cannot answer how the crew will walk after landing.
        This tandem-walking example shows why even the same functional endpoint needs matching
        acquisition conditions. It supplies no individual or Mars prediction.
      </p>
      <div className="r-aggregate-controls">
        <div>
          <label htmlFor="aggregate-group">Study group</label>
          <select
            id="aggregate-group"
            value={group}
            onChange={(event) => setGroup(event.target.value as StudyGroup)}
          >
            {source.groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.id} (cohort n={g.n})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="aggregate-before">Before bed rest</label>
          <select
            id="aggregate-before"
            value={before}
            onChange={(event) => setBefore(event.target.value as EyesCondition)}
          >
            <option value="eyes-closed">Eyes closed</option>
            <option value="eyes-open">Eyes open</option>
          </select>
        </div>
        <div>
          <label htmlFor="aggregate-after">After bed rest</label>
          <select
            id="aggregate-after"
            value={after}
            onChange={(event) => setAfter(event.target.value as EyesCondition)}
          >
            <option value="eyes-closed">Eyes closed</option>
            <option value="eyes-open">Eyes open</option>
          </select>
        </div>
      </div>
      <AggregateChart result={result} before={before} after={after} />
      <div
        className="r-table-scroll"
        tabIndex={0}
        role="region"
        aria-label="Published tandem comparison values"
      >
        <table className="r-table">
          <caption>
            {group} group · tandem walking · percentage of correct steps; published mean ± SD
          </caption>
          <thead>
            <tr>
              <th scope="col">Time</th>
              <th scope="col">Eyes condition</th>
              <th scope="col">Mean ± SD (%)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Before 30-day bed rest</th>
              <td>{before.replace('-', ' ')}</td>
              <td>
                {number(result.before.beforeMean)} ± {number(result.before.beforeSD)}
              </td>
            </tr>
            <tr>
              <th scope="row">After 30-day bed rest</th>
              <td>{after.replace('-', ' ')}</td>
              <td>
                {number(result.after.afterMean)} ± {number(result.after.afterSD)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid="aggregate-result"
        className={
          result.supportedDifference !== null ? 'r-agg-result is-ok' : 'r-agg-result is-off'
        }
      >
        <p>
          <strong>
            {result.supportedDifference !== null
              ? 'Matched difference: ' + signed(result.supportedDifference) + ' percentage points.'
              : 'Supported comparison withheld.'}
          </strong>
        </p>
        <p>{result.reason}</p>
      </div>
      {result.illustrativeArithmetic !== null && (
        <aside data-testid="aggregate-counterexample">
          <p>
            Misleading arithmetic only: {signed(result.illustrativeArithmetic)} percentage points.
            This constructed cross-condition pairing is not a supported pre/post result.
          </p>
        </aside>
      )}
      <details className="g-disclosure">
        <summary>Inspect published source values, method and licence</summary>
        <p>
          {source.endpoint}. {source.measurement}
        </p>
        <p>
          {source.groups.find((g) => g.id === group)?.context}. {source.uncertainty}
        </p>
        <p>
          Endpoint-specific paired n remains unknown here. {source.transformation} No new confidence
          interval, significance test or causal effectiveness estimate is calculated.
        </p>
        <p>
          Group labels follow the publisher's Table 3 header. The 83.9→62.6 and 98.5→87.9 values are
          Exercise; Seated is 85.6→76.8 and 95.8→88.2.
        </p>
        <ul>
          {source.limitations.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p>
          {source.authors}. <cite>{source.title}</cite>. Frontiers in Physiology 15:1442239.{' '}
          <a href={source.url} target="_blank" rel="noreferrer">
            Publisher Table 3
          </a>
          {' · '}
          <a href={source.licenseUrl} target="_blank" rel="noreferrer">
            {source.license}
          </a>
          . Extracted {source.extractedOn}. Numerical transcription and arithmetic by PARALLAX.
        </p>
        <pre tabIndex={0} className="r-aggregate-data" data-testid="aggregate-source-record">
          {JSON.stringify(result, null, 2)}
        </pre>
      </details>
      <a href="#mission/health">Return to the fictional mission's unresolved mobility question</a>
    </section>
  );
}

const cond = (c: EyesCondition) => (c === 'eyes-closed' ? 'eyes closed' : 'eyes open');
/** Published group means on a common 0–100% axis. Whiskers show the published ±SD. The
 * difference is drawn only when compareAggregate() reports matched conditions. */
function AggregateChart({
  result,
  before,
  after,
}: {
  result: ReturnType<typeof compareAggregate>;
  before: EyesCondition;
  after: EyesCondition;
}) {
  const x = (v: number) => 150 + (Math.max(0, Math.min(100, v)) / 100) * 450;
  const rows = [
    {
      label: 'Before bed rest',
      condition: cond(before),
      mean: result.before.beforeMean,
      sd: result.before.beforeSD,
      y: 40,
    },
    {
      label: 'After bed rest',
      condition: cond(after),
      mean: result.after.afterMean,
      sd: result.after.afterSD,
      y: 104,
    },
  ];
  const matched = result.supportedDifference !== null;
  return (
    <figure className={`r-agg-chart ${matched ? 'is-ok' : 'is-off'}`}>
      <svg
        viewBox="0 0 670 180"
        role="img"
        aria-label={`${result.group} group tandem walking, percentage of correct steps. Before bed rest, ${cond(before)}: ${number(result.before.beforeMean)}%. After bed rest, ${cond(after)}: ${number(result.after.afterMean)}%. ${matched ? 'Matched conditions: difference ' + signed(result.supportedDifference!) + ' percentage points.' : 'Conditions differ: no supported difference.'}`}
      >
        {[0, 25, 50, 75, 100].map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1="14" y2="140" className="r-agg-grid" />
            <text x={x(t)} y="160" textAnchor="middle" className="r-agg-tick">
              {t}%
            </text>
          </g>
        ))}
        {rows.map((r, i) => (
          <g key={r.label}>
            <text x="0" y={r.y + 4} className="r-agg-row">
              {r.label}
            </text>
            <text
              x="0"
              y={r.y + 22}
              className={!matched && i === 1 ? 'r-agg-cond is-diff' : 'r-agg-cond'}
            >
              {r.condition}
            </text>
            <rect
              x={x(0)}
              y={r.y - 12}
              width={x(r.mean) - x(0)}
              height="28"
              rx="3"
              className={i === 0 ? 'r-agg-bar-a' : matched ? 'r-agg-bar-b' : 'r-agg-bar-x'}
            />
            <line
              x1={x(r.mean - r.sd)}
              x2={x(r.mean + r.sd)}
              y1={r.y + 2}
              y2={r.y + 2}
              className="r-agg-sd"
            />
            {r.mean + r.sd > 100 && (
              <path
                d={`M${x(100) - 6} ${r.y - 4}l6 6-6 6`}
                fill="none"
                className="r-agg-sd r-agg-clip"
              />
            )}
            <text x={x(Math.min(100, r.mean + r.sd)) + 8} y={r.y + 7} className="r-agg-val">
              {number(r.mean)}%
            </text>
          </g>
        ))}
      </svg>
      <figcaption>
        Published group means with ±SD whiskers (Clément et al. 2024, Table 3). An arrowhead marks a
        whisker cut at 100%; the table gives the full SD. Ground bed-rest study; not astronaut or
        Mars data.
      </figcaption>
    </figure>
  );
}
