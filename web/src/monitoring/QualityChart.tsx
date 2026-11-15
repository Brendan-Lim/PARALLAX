import { useState } from 'react';
import type { MonitoringEvent, Sample } from './model';
import { describeConditions, usabilityLabel } from './presentation';

/* Shared horizontal geometry so the tracker cells sit under their chart samples. */
const W = 720;
const X0 = 60;
const STEP = 86;
const LO = 60;
const HI = 90;
const TOP = 34;
const BOTTOM = 178;
const x = (seconds: number) => X0 + seconds * STEP;
const y = (bpm: number) => BOTTOM - ((bpm - LO) / (HI - LO)) * (BOTTOM - TOP);

/** Parsed HR by source-relative time. Exact values, no smoothing, no line across an
 * unusable sample, raw withheld/uncertain values drawn hollow and labelled. */
export function QualityChart({
  samples,
  events,
  frames,
  historical,
}: {
  samples: Sample[];
  events: MonitoringEvent[];
  frames: number;
  historical: boolean;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const selected = samples.find((s) => s.id === picked) ?? samples.at(-1);
  const slots = Array.from({ length: frames }, (_, i) => i);
  const bySecond = new Map(samples.map((s) => [s.observation.relativeSeconds, s]));
  const marks = events
    .map((e) => ({ e, s: samples.find((s) => s.id === e.observationId) }))
    .filter((m): m is { e: MonitoringEvent; s: Sample } => !!m.s);
  const usable = samples.filter((s) => s.observation.usability === 'usable').length;
  return (
    <figure className="mc-figure">
      <figcaption className="mc-figure-head">
        <span>
          Parsed heart rate, bpm · synthetic Astroskin-format replay · source-relative seconds
        </span>
        {historical && samples.length > 0 && (
          <span className="m-chip is-historical">Historical · no current observation</span>
        )}
      </figcaption>
      <svg
        viewBox={`0 0 ${W} 214`}
        role="img"
        aria-label={`Adapter-generated HR observations, bpm by relative source seconds. ${samples.length} of ${frames} processed, ${usable} usable. Lines break at unusable samples; values in the sample log.`}
      >
        {[60, 70, 80, 90].map((v) => (
          <g key={v}>
            <line x1={X0 - 24} x2={W - 16} y1={y(v)} y2={y(v)} className="mc-gridline" />
            <text x={X0 - 30} y={y(v) + 4} textAnchor="end" className="mc-tick">
              {v}
            </text>
          </g>
        ))}
        {samples
          .filter((s) => s.observation.usability !== 'usable')
          .map((s) => (
            <rect
              key={'band' + s.id}
              x={x(s.observation.relativeSeconds) - STEP / 2 + 3}
              y={TOP - 8}
              width={STEP - 6}
              height={BOTTOM - TOP + 8}
              className={s.observation.usability === 'withheld' ? 'mc-band-w' : 'mc-band-q'}
            />
          ))}
        {marks.map(({ e, s }) => (
          <g key={e.id} className={e.type === 'monitoring-recovery' ? 'mc-mark-r' : 'mc-mark-i'}>
            <line
              x1={x(s.observation.relativeSeconds) - STEP / 2 + 3}
              x2={x(s.observation.relativeSeconds) - STEP / 2 + 3}
              y1={14}
              y2={BOTTOM}
            />
            <text x={x(s.observation.relativeSeconds) - STEP / 2 + 8} y={22}>
              {e.type === 'monitoring-recovery' ? 'Recovery' : 'Interruption'}
            </text>
          </g>
        ))}
        {samples.map((s, i) => {
          const o = s.observation;
          const prev = samples[i - 1]?.observation;
          const joined =
            o.usability === 'usable' &&
            prev?.usability === 'usable' &&
            o.relativeSeconds - prev.relativeSeconds === 1;
          return (
            joined && (
              <line
                key={'seg' + s.id}
                x1={x(prev.relativeSeconds)}
                y1={y(prev.value)}
                x2={x(o.relativeSeconds)}
                y2={y(o.value)}
                className="mc-line"
              />
            )
          );
        })}
        {samples.map((s) => {
          const o = s.observation;
          const cx = x(o.relativeSeconds);
          const cy = y(o.usability === 'usable' ? o.value : o.originalValue);
          return (
            <g key={s.id}>
              {o.usability === 'usable' ? (
                <circle cx={cx} cy={cy} r="5.5" className="mc-pt" />
              ) : (
                <>
                  <circle
                    cx={cx}
                    cy={cy}
                    r="6.5"
                    className={o.usability === 'withheld' ? 'mc-pt-w' : 'mc-pt-q'}
                  />
                  <text x={cx} y={cy - 14} textAnchor="middle" className="mc-raw">
                    raw {o.originalValue}
                  </text>
                </>
              )}
            </g>
          );
        })}
        {slots.map((i) => (
          <text
            key={i}
            x={x(i)}
            y={BOTTOM + 22}
            textAnchor="middle"
            className={bySecond.has(i) ? 'mc-tick' : 'mc-tick mc-tick-dim'}
          >
            {i} s
          </text>
        ))}
      </svg>
      <div className="mc-tracker" role="group" aria-label="Reported sample quality by second">
        {slots.map((i) => {
          const s = bySecond.get(i);
          if (!s)
            return (
              <span key={i} className="mc-cell is-pending" title={`${i} s: not yet processed`}>
                <span className="sr-only">{i} s: not yet processed</span>
              </span>
            );
          const o = s.observation;
          return (
            <button
              key={i}
              type="button"
              className={`mc-cell is-${o.usability}`}
              aria-pressed={selected?.id === s.id}
              aria-label={`${i} s: ${usabilityLabel[o.usability]}, raw ${o.originalValue} bpm, quality code ${o.originalQualityCode ?? 'missing'}`}
              onClick={() => setPicked(s.id)}
            >
              <span aria-hidden="true">
                {o.usability === 'usable' ? '✓' : o.usability === 'withheld' ? '×' : '?'}
              </span>
            </button>
          );
        })}
      </div>
      <ul className="mc-legend" aria-label="Chart legend">
        <li>
          <span className="mc-key mc-key-u" aria-hidden="true" /> Usable at processing
        </li>
        <li>
          <span className="mc-key mc-key-w" aria-hidden="true" /> Withheld · raw value kept
        </li>
        <li>
          <span className="mc-key mc-key-q" aria-hidden="true" /> Uncertain · quality missing
        </li>
        <li>
          <span className="mc-key mc-key-p" aria-hidden="true" /> Not yet processed
        </li>
      </ul>
      {selected && (
        <p className="mc-sample-detail" aria-live="polite">
          <strong>{selected.observation.relativeSeconds} s</strong> · raw{' '}
          {selected.observation.originalValue} bpm · quality code{' '}
          {selected.observation.originalQualityCode ?? 'missing'} ·{' '}
          {usabilityLabel[selected.observation.usability]} ·{' '}
          {describeConditions(selected.observation.qualityConditions)}
        </p>
      )}
    </figure>
  );
}
