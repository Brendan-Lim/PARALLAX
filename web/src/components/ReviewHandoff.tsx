import { Download } from 'lucide-react';
export interface HandoffItem {
  label: string;
  value: string;
  tone?: 'issue' | 'neutral';
}
export function ReviewHandoff({
  note,
  onNote,
  report,
  onDownload,
  contents = [],
  compact = false,
}: {
  note: string;
  onNote: (value: string) => void;
  report: string;
  onDownload: () => void;
  contents?: HandoffItem[];
  /** Guided variant: question, download and on-demand contents only. */
  compact?: boolean;
}) {
  if (compact)
    return (
      <section className="g-handoff" aria-label="Review handoff">
        <label htmlFor="review-question">Question for the reviewer</label>
        <textarea
          id="review-question"
          value={note}
          maxLength={1000}
          onChange={(e) => onNote(e.target.value)}
          placeholder="Which record should be located or verified?"
        />
        <p className="g-fine">
          Fictional questions only. Do not enter personal medical information.
        </p>
        <button className="s-button" onClick={onDownload}>
          <Download size={17} aria-hidden="true" /> Download the review
        </button>
        {contents.length > 0 && (
          <details className="g-disclosure">
            <summary>What the file opens with</summary>
            <dl className="g-handoff-list">
              {contents.map((item) => (
                <div key={item.label} className={item.tone === 'issue' ? 'is-issue' : ''}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
            <p className="g-fine">
              Then every record’s source, protocol and session. The file stays on this device.
            </p>
          </details>
        )}
        <details className="g-disclosure">
          <summary>Preview the full report</summary>
          <pre>{report}</pre>
        </details>
      </section>
    );
  return (
    <section className="review-handoff" aria-label="Current review handoff">
      <div className="eyebrow mono">REVIEW HANDOFF</div>
      <h3>Keep the question with its evidence.</h3>
      <div className="handoff-layout">
        <div className="handoff-compose">
          <label htmlFor="review-question">Question for qualified review</label>
          <textarea
            id="review-question"
            value={note}
            maxLength={1000}
            onChange={(e) => onNote(e.target.value)}
            placeholder="Which original observation needs to be located or verified?"
          />
          <p className="footnote">
            Fictional questions only. Do not enter personal medical information.
          </p>
          <button className="button primary" onClick={onDownload}>
            <Download size={16} /> Download review
          </button>
        </div>
        {contents.length > 0 && (
          <div className="handoff-contents">
            <h4>The review file opens with</h4>
            <dl>
              {contents.map((item) => (
                <div key={item.label} className={item.tone === 'issue' ? 'handoff-issue' : ''}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
            <p className="handoff-appendix">
              Then every record’s source, protocol, session and interpretation limits.
            </p>
          </div>
        )}
      </div>
      <p className="footnote">
        Markdown provides a readable handoff with current findings and complete source details. It
        does not restore an editable session. The file stays on this device; nothing is transmitted.
      </p>
      <details>
        <summary>Preview full report</summary>
        <pre>{report}</pre>
      </details>
    </section>
  );
}
