import { formatNumber } from '../core/engine';
import type { FictionalObservation } from './observations';

const day = (value: string) =>
  new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value));

/** Source-record inspector: value, acquisition and applicability first; identifiers after. */
export function SourceRecords({
  records,
  excluded,
  status,
}: {
  records: FictionalObservation[];
  excluded: string[];
  status?: string;
}) {
  return (
    <div className="m-records">
      {records.map((r) => {
        const applicability =
          status ?? (excluded.includes(r.id) ? 'Excluded from this review' : 'In this review');
        const inReview = applicability === 'In this review';
        return (
          <article key={r.id}>
            <div className="m-record-head">
              <h4>
                {r.measurement === 'exercise-hr'
                  ? 'Cycling heart rate'
                  : r.measurement === 'leg-press-force'
                    ? 'Preflight leg-press force'
                    : r.measurement === 'vo2peak'
                      ? 'Measured absolute VO₂peak'
                      : r.measurement === 'reported-sleep-duration'
                        ? 'Self-reported sleep duration'
                        : 'Preflight cycling heart rate'}{' '}
                · {formatNumber(r.value)} {r.unit}
              </h4>
              <span className={`m-chip ${inReview ? 'is-supported' : 'is-withheld'}`}>
                {applicability}
              </span>
            </div>
            <span className="m-record-value" aria-hidden="true">
              {formatNumber(r.value)} {r.unit}
            </span>
            <dl className="m-record-key">
              <div>
                <dt>Acquired (fictional UTC)</dt>
                <dd>
                  {day(r.timestamp)}
                  <br />
                  <span className="m-fine">{r.timestamp}</span>
                </dd>
              </div>
              <div>
                <dt>
                  {r.measurement === 'exercise-hr' ? 'Workload / timing' : 'Acquisition context'}
                </dt>
                <dd>
                  {r.measurement === 'exercise-hr'
                    ? `${r.acquisition.workloadWatts} W / ${r.acquisition.timing}`
                    : `${r.missionPhase} · ${r.gravity}`}
                </dd>
              </div>
              <div>
                <dt>Device / activity</dt>
                <dd>
                  {r.acquisition.device} / {r.acquisition.activity}
                </dd>
              </div>
            </dl>
            <details className="m-details">
              <summary>All acquisition declarations</summary>
              <dl className="m-record-meta">
                {Object.entries(r.acquisition).map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{String(value)}</dd>
                  </div>
                ))}
              </dl>
            </details>
            <dl className="m-record-meta">
              {r.measurement === 'exercise-hr' && (
                <div>
                  <dt>Acquisition context</dt>
                  <dd>
                    {r.missionPhase} · {r.gravity}
                  </dd>
                </div>
              )}
              <div>
                <dt>Record</dt>
                <dd>
                  {r.id} · {applicability}
                </dd>
              </div>
              <div>
                <dt>Source</dt>
                <dd>
                  {r.provenance.sourceId} / {r.provenance.sourceRecord}
                </dd>
              </div>
              <div>
                <dt>Protocol / session</dt>
                <dd>
                  {r.protocol} / {r.session}
                </dd>
              </div>
              <div>
                <dt>Comparison window</dt>
                <dd>
                  {r.window} · {r.comparisonRole}
                </dd>
              </div>
              <div>
                <dt>Origin / form / quality</dt>
                <dd>
                  {r.origin} · {r.form} · {r.quality.state}. Author-declared fixture quality; device
                  accuracy is unverified.
                </dd>
              </div>
            </dl>
          </article>
        );
      })}
    </div>
  );
}
