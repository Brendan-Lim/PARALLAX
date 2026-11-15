import type { ReactNode } from 'react';
import { Check, CircleDashed, CircleSlash, Ban } from 'lucide-react';
import { comparisonSummary, formatNumber, signed } from '../core/engine';
import {
  measures,
  type CasePacket,
  type EvidenceStatus,
  type Finding,
  type Measure,
  type Observation,
  type Phase,
} from '../core/model';

/** The unique available direct record for a phase, exactly as the engine would select it. */
export function phaseRecord(
  packet: CasePacket,
  unavailable: readonly string[],
  measure: Measure,
  phase: Phase,
): Observation | undefined {
  const found = packet.observations.filter(
    (r) =>
      r.measurement === measure &&
      r.phase === phase &&
      r.form === 'direct' &&
      !unavailable.includes(r.id),
  );
  return found.length === 1 ? found[0] : undefined;
}

/** Plain names for the guided experience; the workspace keeps the technical labels. */
export const plainName: Record<Measure, string> = {
  force: 'Leg-press force',
  cardio: 'Heart-rate response to standing',
  tandem: 'Tandem walk, correct steps',
  task: 'Stand-and-walk task time',
  hr: 'Exercise heart rate',
  map: 'Mean arterial pressure',
};

export const plainStatus: Record<EvidenceStatus, string> = {
  supported: 'Supported',
  insufficient: 'Record missing',
  unresolved: 'Records not comparable',
  outside: 'Outside scope',
};
const statusIcon = {
  supported: Check,
  insufficient: CircleDashed,
  unresolved: Ban,
  outside: CircleSlash,
};

export function Status({ status }: { status: EvidenceStatus }) {
  const Icon = statusIcon[status];
  return (
    <span className={`s-status s-${status}`}>
      <Icon size={14} strokeWidth={2.25} aria-hidden="true" />
      {plainStatus[status]}
    </span>
  );
}

/** What the engine allows us to say about the change. Never a number without support. */
export function changeText(finding: Finding): string {
  const c = finding.comparison;
  if (!c) return finding.status === 'unresolved' ? 'Comparison withheld' : 'Change unknown';
  const absolute = `${signed(c.absolute)} ${c.changeUnit}`;
  return c.relative !== null
    ? `${absolute} · ${comparisonSummary(finding)}`
    : comparisonSummary(finding);
}

const nice = (n: number) => {
  const step = 10 ** Math.floor(Math.log10(n));
  for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * step >= n) return m * step;
  return 10 * step;
};

export interface BarRow {
  label: string;
  detail?: string;
  value: number | null;
  tone: 'before' | 'after' | 'copy';
  tag?: string;
}
/**
 * Horizontal bars on one zero-based scale. A null value is drawn as an outlined, labelled gap:
 * never as a zero-length bar.
 */
export function PairedBars({
  title,
  unit,
  rows,
  max,
  caption,
  id,
}: {
  title: string;
  unit: string;
  rows: BarRow[];
  max?: number;
  caption?: ReactNode;
  id?: string;
}) {
  const values = rows.map((r) => r.value).filter((v): v is number => v !== null);
  const top = nice(max ?? Math.max(...values, 1) * 1.08);
  return (
    <figure className="c-bars" data-testid={id}>
      <figcaption className="c-title">
        {title} <span>({unit})</span>
      </figcaption>
      <div className="c-plot" aria-hidden="true">
        {rows.map((r) => (
          <div className={`c-row c-${r.tone}`} key={r.label}>
            <span className="c-label">
              {r.label}
              {r.detail && <small>{r.detail}</small>}
            </span>
            <span className="c-track">
              {r.value === null ? (
                <span className="c-missing">Not recorded · no value</span>
              ) : (
                <>
                  <i style={{ width: `${(Math.max(r.value, 0) / top) * 100}%` }} />
                  <b>
                    {formatNumber(r.value)} <small>{unit}</small>
                    {r.tag && <em>{r.tag}</em>}
                  </b>
                </>
              )}
            </span>
          </div>
        ))}
        <div className="c-axis">
          <span />
          <span className="c-ticks">
            <span>0</span>
            <span>{formatNumber(top / 2)}</span>
            <span>
              {formatNumber(top)} {unit}
            </span>
          </span>
        </div>
      </div>
      <div className="sr-only">
        <table>
          <caption>
            {title}, {unit}
          </caption>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <th scope="row">
                  {r.label}
                  {r.detail ? `, ${r.detail}` : ''}
                </th>
                <td>
                  {r.value === null
                    ? 'Not recorded; no value'
                    : `${formatNumber(r.value)} ${unit}${r.tag ? `, ${r.tag}` : ''}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {caption && <p className="c-caption">{caption}</p>}
    </figure>
  );
}

/** Before/after bars for one measure, read from the packet's available direct records. */
export function MeasureBars({
  packet,
  unavailable,
  measure,
  title,
  labels = ['Before', 'After'],
  caption,
  extra = [],
  max,
}: {
  packet: CasePacket;
  unavailable: readonly string[];
  measure: Measure;
  title?: string;
  labels?: [string, string];
  caption?: ReactNode;
  extra?: BarRow[];
  max?: number;
}) {
  const before = phaseRecord(packet, unavailable, measure, 'baseline');
  const after = phaseRecord(packet, unavailable, measure, 'followup');
  return (
    <PairedBars
      id={`bars-${measure}`}
      title={title ?? measures[measure].detail}
      unit={measures[measure].unit}
      max={max}
      caption={caption}
      rows={[
        { label: labels[0], value: before?.value ?? null, tone: 'before' },
        { label: labels[1], value: after?.value ?? null, tone: 'after' },
        ...extra,
      ]}
    />
  );
}

/** The one result line under a chart: engine status plus the change it allows. */
export function Result({ finding, label }: { finding: Finding; label: string }) {
  return (
    <p className={`c-result r-${finding.status}`} data-testid={`result-${finding.id}`}>
      <span className="c-result-label">{label}</span>
      <strong>{changeText(finding)}</strong>
      <Status status={finding.status} />
    </p>
  );
}

/** Measurement and its acquisition condition side by side, each on its own zero-based scale. */
export function ConditionRows({ packet }: { packet: CasePacket }) {
  const rows = (['baseline', 'followup'] as const).map((phase) => {
    const r = packet.observations.find(
      (o) => o.measurement === 'hr' && o.phase === phase && o.form === 'direct',
    );
    return { phase, r };
  });
  const watts = rows.map((x) => x.r?.acquisition?.workloadWatts);
  const same = watts[0] !== undefined && watts[0] === watts[1];
  return (
    <figure className="c-conditions" data-testid="conditions">
      <div className="c-cond-head" aria-hidden="true">
        <span />
        <span>Heart rate (bpm)</span>
        <span>Recorded workload (W)</span>
      </div>
      {rows.map(({ phase, r }, i) => (
        <div className="c-cond-row" key={phase} aria-hidden="true">
          <span className="c-label">Session {i + 1}</span>
          <span className="c-track">
            <i className="c-hr" style={{ width: `${((r?.value ?? 0) / 160) * 100}%` }} />
            <b>{r ? formatNumber(r.value) : '—'}</b>
          </span>
          <span className={`c-track ${same ? '' : 'c-differs'}`}>
            <i className="c-watts" style={{ width: `${((watts[i] ?? 0) / 140) * 100}%` }} />
            <b>{watts[i] ?? '—'} W</b>
          </span>
        </div>
      ))}
      <p className={`c-cond-verdict ${same ? 'is-same' : 'is-different'}`}>
        {same
          ? `Both readings recorded at ${watts[0]} W`
          : `Recorded workloads differ: ${watts[0]} W and ${watts[1]} W`}
      </p>
      <div className="sr-only">
        <table>
          <caption>Heart rate and recorded workload for each cycling session</caption>
          <thead>
            <tr>
              <th>Session</th>
              <th>Heart rate</th>
              <th>Recorded workload</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ phase, r }, i) => (
              <tr key={phase}>
                <th scope="row">Session {i + 1}</th>
                <td>{r ? `${formatNumber(r.value)} bpm` : 'Not recorded'}</td>
                <td>{watts[i] !== undefined ? `${watts[i]} W` : 'Not recorded'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <figcaption className="c-caption">
        Separate scales: heart rate 0–160 bpm, workload 0–140 W. Fictional records.
      </figcaption>
    </figure>
  );
}

/** Original record → copied display, drawn from the copy's declared `derivedFrom` reference. */
export function SourceCopy({
  source,
  copy,
  excluded,
}: {
  source?: Observation;
  copy?: Observation;
  excluded: boolean;
}) {
  const linked = !!source && !!copy && copy.derivedFrom.includes(source.id);
  return (
    <div
      className={`c-source ${excluded ? 'is-excluded' : ''}`}
      role="group"
      aria-label="Original force record and its copied display"
      data-testid="source-copy"
    >
      <div className="c-doc c-doc-source">
        <span className="c-doc-role">Original assessment record</span>
        <strong>{source ? `${formatNumber(source.value)} N` : 'Not on file'}</strong>
        <span className="c-doc-state">
          {excluded ? 'Excluded for this exploration · kept on file' : 'Direct measurement'}
        </span>
      </div>
      <div className="c-link" aria-hidden="true">
        <span>{linked ? 'copied from' : 'no declared link'}</span>
        <svg viewBox="0 0 120 16" preserveAspectRatio="none">
          <path d="M2 8H112" />
          <path d="M106 3l8 5-8 5" />
        </svg>
      </div>
      <div className="c-doc c-doc-copy">
        <span className="c-doc-role">Copied display</span>
        <strong>{copy ? `${formatNumber(copy.value)} N` : 'Not on file'}</strong>
        <span className="c-doc-state">
          {linked ? 'Depends on the original · not an independent measurement' : ''}
        </span>
      </div>
    </div>
  );
}

/** Small multiples on a common 0–80% axis. Exact published values are labelled directly. */
export function CohortBars({
  title,
  metric,
  values,
  groups,
}: {
  title: string;
  metric: string;
  values: Record<string, number>;
  groups: readonly { id: string; label: string; n: number }[];
}) {
  return (
    <figure className="c-bars c-cohort">
      <figcaption className="c-title">
        {title}
        <span>{metric}</span>
      </figcaption>
      <div className="c-plot" aria-hidden="true">
        {groups.map((g) => (
          <div className={`c-row c-group-${g.id}`} key={g.id}>
            <span className="c-label">
              {g.label}
              <small>n = {g.n}</small>
            </span>
            <span className="c-track">
              <i style={{ width: `${(values[g.id] / 80) * 100}%` }} />
              <b>+{values[g.id]}%</b>
            </span>
          </div>
        ))}
        <div className="c-axis">
          <span />
          <span className="c-ticks">
            <span>0%</span>
            <span>+40%</span>
            <span>+80%</span>
          </span>
        </div>
      </div>
      <div className="sr-only">
        <table>
          <caption>
            {title}: {metric}
          </caption>
          <tbody>
            {groups.map((g) => (
              <tr key={g.id}>
                <th scope="row">
                  {g.label} (n = {g.n})
                </th>
                <td>+{values[g.id]}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

/** Signed association on a zero-centred −1 to +1 scale. Not a probability or a weight. */
export function AssociationBars({
  rows,
}: {
  rows: readonly { measure: string; label: string; domain: string; d: number }[];
}) {
  const domains = ['Muscular', 'Sensorimotor', 'Cardiovascular'];
  const fmt = (d: number) => `${d < 0 ? '−' : '+'}${Math.abs(d).toFixed(3)}`;
  return (
    <figure className="c-assoc" data-testid="associations">
      <div className="c-assoc-axis" aria-hidden="true">
        <span />
        <span className="c-ticks">
          <span>−1</span>
          <span>−0.5</span>
          <span>0</span>
          <span>+0.5</span>
          <span>+1</span>
        </span>
      </div>
      {domains.map((domain) => (
        <div className="c-assoc-group" key={domain} aria-hidden="true">
          <span className="c-assoc-domain">{domain}</span>
          {rows
            .filter((r) => r.domain === domain)
            .map((r) => (
              <div className="c-assoc-row" key={r.measure}>
                <span className="c-label">{r.label}</span>
                <span className="c-assoc-track">
                  <span className="c-zero" />
                  <i
                    className={r.d < 0 ? 'neg' : 'pos'}
                    style={{
                      left: r.d < 0 ? `${50 + r.d * 50}%` : '50%',
                      width: `${Math.abs(r.d) * 50}%`,
                    }}
                  />
                  <b
                    style={r.d < 0 ? { right: `${51 - r.d * 50}%` } : { left: `${51 + r.d * 50}%` }}
                  >
                    {fmt(r.d)}
                  </b>
                </span>
              </div>
            ))}
        </div>
      ))}
      <div className="sr-only">
        <table>
          <caption>
            Somers’ D between each physiological change and task completion-time change
          </caption>
          <thead>
            <tr>
              <th>Measure</th>
              <th>System</th>
              <th>Somers’ D</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.measure}>
                <th scope="row">{r.label}</th>
                <td>{r.domain}</td>
                <td>{fmt(r.d)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
