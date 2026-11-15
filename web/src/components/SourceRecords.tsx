import type { CasePacket, Finding } from '../core/model';
import { formatNumber } from '../core/engine';

/** The same source surface serves the investigation and detailed Lens. */
export function SourceRecords({
  packet,
  finding,
  label,
  unavailable,
  onToggle,
}: {
  label?: string;
  packet: CasePacket;
  finding: Finding;
  unavailable: string[];
  /** Omit to show the records without availability controls. */
  onToggle?: (id: string) => void;
}) {
  const records = packet.observations.filter((r) => r.measurement === finding.id);
  return (
    <details className="record-details">
      <summary>
        {label ?? 'Inspect source records'} <span>{records.length}</span>
      </summary>
      <div className="source-record-grid">
        {records.length ? (
          records.map((r) => (
            <article className="record" key={r.id}>
              <strong>
                {unavailable.includes(r.id)
                  ? 'Excluded source record · not used as evidence: '
                  : ''}
                {r.phase === 'baseline' ? 'Baseline' : 'Follow-up'} · {formatNumber(r.value)}{' '}
                {r.unit}
              </strong>
              <p>
                {r.form === 'derived'
                  ? 'Dependent display copy · supplies no independent support'
                  : 'Direct observation · fictional'}
              </p>
              <dl>
                <dt>Record identity</dt>
                <dd>{r.id}</dd>
                <dt>Session</dt>
                <dd>{r.session}</dd>
                <dt>Timestamp</dt>
                <dd>{r.timestamp ?? 'Unknown; not inferred'}</dd>
                <dt>Protocol</dt>
                <dd>{r.protocol}</dd>
                <dt>Comparison window</dt>
                <dd>{r.window}</dd>
                <dt>Source identity</dt>
                <dd>{r.sourceId}</dd>
                <dt>Source reference</dt>
                <dd>{r.sourceRecord}</dd>
                {r.acquisition && (
                  <>
                    <dt>Recorded workload</dt>
                    <dd>{r.acquisition.workloadWatts} W</dd>
                    <dt>Acquisition conditions</dt>
                    <dd>
                      {r.acquisition.setting} · {r.acquisition.activity} · {r.acquisition.timing} ·{' '}
                      {r.acquisition.device}
                    </dd>
                  </>
                )}
                {!!r.derivedFrom.length && (
                  <>
                    <dt>Derived from</dt>
                    <dd>{r.derivedFrom.join(', ')}</dd>
                  </>
                )}
              </dl>
              {onToggle && (
                <button className="text-link" onClick={() => onToggle(r.id)}>
                  {unavailable.includes(r.id) ? 'Restore record' : 'Simulate record unavailable'}
                  <span className="sr-only"> {r.id}</span>
                </button>
              )}
            </article>
          ))
        ) : (
          <p>This broader claim has no validating observation rule in the prototype.</p>
        )}
      </div>
    </details>
  );
}
