import { useId } from 'react';
/** Two-point (dumbbell) view of separate observations at the same recorded workload.
 * The segment shows a difference on the value axis; it is never a trajectory over time.
 * Without a compatible later record, only the first point is drawn and no difference exists. */
export interface PairPoint {
  value: number;
  label: string;
}
export function PairedObservationChart({
  early,
  late,
  unit,
  title,
  description,
  missingLabel,
  difference,
}: {
  early: PairPoint;
  late?: PairPoint;
  unit: string;
  title: string;
  description: string;
  missingLabel?: string;
  difference?: string;
}) {
  const values = late ? [early.value, late.value] : [early.value];
  const lo = Math.floor((Math.min(...values) - 15) / 10) * 10;
  const hi = Math.ceil((Math.max(...values) + 15) / 10) * 10;
  const ticks: number[] = [];
  for (let t = lo; t <= hi; t += 10) ticks.push(t);
  const x = (v: number) => 48 + ((v - lo) / (hi - lo)) * 544;
  const y = 78;
  const titleId = useId();
  const descId = `${titleId}-desc`;
  return (
    <div className="m-pair">
      <svg viewBox="0 0 640 270" role="img" aria-labelledby={titleId} aria-describedby={descId}>
        <title id={titleId}>{title}</title>
        <desc id={descId}>{description}</desc>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1="30" y2="200" className="p-grid" />
            <text x={x(t)} y="240" textAnchor="middle" className="p-tick">
              {t}
            </text>
          </g>
        ))}
        <line x1={x(lo)} x2={x(hi)} y1="200" y2="200" className="p-axis" />
        {late && (
          <>
            <line x1={x(early.value)} x2={x(late.value)} y1={y} y2={y + 30} className="p-bar" />
          </>
        )}
        <circle cx={x(early.value)} cy={y} r="8" className="p-early" />
        <text x={x(early.value)} y={y - 20} textAnchor="middle" className="p-value">
          {early.value} {unit}
        </text>
        {late && <circle cx={x(late.value)} cy={y + 30} r="8" className="p-late" />}
        {late && (
          <text x={x(late.value)} y={y + 82} textAnchor="middle" className="p-value">
            {late.value} {unit}
          </text>
        )}
      </svg>
      {late && difference && (
        <p className="m-pair-difference">{difference} · difference on the value axis</p>
      )}
      <dl className="m-pair-labels">
        <div>
          <dt>{early.label}</dt>
          <dd>
            {early.value} {unit}
          </dd>
        </div>
        {late && (
          <div>
            <dt>{late.label}</dt>
            <dd>
              {late.value} {unit}
            </dd>
          </div>
        )}
      </dl>
      {!late && missingLabel && (
        <p className="m-pair-missing" role="note">
          {missingLabel}
        </p>
      )}
    </div>
  );
}
