import { revealTarget } from './navigation';
import { demoSuffix } from './demoProfile';
import { useEffect, useState } from 'react';
const key = 'parallax.fictional-planning.v1' + demoSuffix;
export const planningNeeds = [
  'compatible-strength',
  'surface-mobility',
  'aerobic-resources',
  'sleep-diary',
  'other-resources',
] as const;
export type PlanningNeed = (typeof planningNeeds)[number];
export interface PlanningRequestRecord {
  version: 1;
  need: PlanningNeed;
  recordedAt: string;
  status: 'for-qualified-review';
}
export function readPlanning(raw: string | null): PlanningRequestRecord[] {
  try {
    const rows: unknown = JSON.parse(raw ?? '[]');
    if (!Array.isArray(rows) || rows.length > 5) return [];
    return rows
      .filter(
        (v): v is PlanningRequestRecord =>
          !!v &&
          typeof v === 'object' &&
          Object.keys(v).sort().join(',') === 'need,recordedAt,status,version' &&
          v.version === 1 &&
          planningNeeds.includes(v.need) &&
          v.status === 'for-qualified-review' &&
          typeof v.recordedAt === 'string' &&
          Number.isFinite(Date.parse(v.recordedAt)),
      )
      .filter((v, i, a) => a.findIndex((x) => x.need === v.need) === i);
  } catch {
    return [];
  }
}
export function ActionRegion({
  title,
  why,
  children,
}: {
  title: string;
  why: string;
  children: import('react').ReactNode;
}) {
  return (
    <section className="m-next-action">
      <div>
        <p className="m-next-label">Recommended next review action</p>
        <h3>{title}</h3>
        <p>{why}</p>
      </div>
      <div className="m-next-buttons">{children}</div>
    </section>
  );
}
export function usePlanningRequests() {
  const [rows, setRows] = useState(() => {
    try {
      return readPlanning(localStorage.getItem(key));
    } catch {
      return [];
    }
  });
  useEffect(() => {
    const refresh = () => {
      try {
        setRows(readPlanning(localStorage.getItem(key)));
      } catch {
        setRows([]);
      }
    };
    window.addEventListener('storage', refresh);
    window.addEventListener('parallax:planning', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('parallax:planning', refresh);
    };
  }, []);
  return rows;
}
export function PlanningRequest({ need }: { need: PlanningNeed }) {
  const rows = usePlanningRequests();
  const [feedback, setFeedback] = useState('');
  const saved = rows.some((r) => r.need === need);
  return (
    <div>
      <p>
        Fictional information planning only. This records a requirement for qualified review; it
        authorises no physical test.
      </p>
      <button
        className="s-button"
        disabled={saved}
        onClick={() => {
          try {
            const next = [
              ...readPlanning(localStorage.getItem(key)).filter((r) => r.need !== need),
              {
                version: 1 as const,
                need,
                recordedAt: new Date().toISOString(),
                status: 'for-qualified-review' as const,
              },
            ];
            localStorage.setItem(key, JSON.stringify(next));
            if (!readPlanning(localStorage.getItem(key)).some((r) => r.need === need))
              throw Error();
            window.dispatchEvent(new Event('parallax:planning'));
            setFeedback('Fictional planning request saved in this browser for qualified review.');
            revealTarget('planning-status-' + need);
          } catch {
            setFeedback('Request could not be saved. No success is recorded.');
            revealTarget('planning-status-' + need);
          }
        }}
      >
        {saved ? 'Planning request recorded' : 'Record fictional planning request'}
      </button>
      <p id={`planning-status-${need}`} tabIndex={-1} role="status">
        {feedback || (saved ? 'Saved request available for review.' : '')}
      </p>
      {saved && (
        <details id={`saved-request-${need}`}>
          <summary id={`saved-request-${need}-title`}>Review saved request</summary>
          <p>
            {rows.find((r) => r.need === need)?.need} · for qualified review ·{' '}
            {rows.find((r) => r.need === need)?.recordedAt}
          </p>
          <button
            className="s-button s-secondary"
            onClick={() => {
              try {
                const next = readPlanning(localStorage.getItem(key)).filter((r) => r.need !== need);
                localStorage.setItem(key, JSON.stringify(next));
                window.dispatchEvent(new Event('parallax:planning'));
                setFeedback('Planning request removed.');
              } catch {
                setFeedback('Removal could not be saved.');
              }
            }}
          >
            Remove request
          </button>
        </details>
      )}
    </div>
  );
}
