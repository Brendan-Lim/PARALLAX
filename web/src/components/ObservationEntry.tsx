import { useRef, useState } from 'react';
import { X } from 'lucide-react';
import {
  measures,
  type CasePacket,
  type Measure,
  type Phase,
  type Observation,
} from '../core/model';
import { applyEntry, entryDraft, type EntryDraft } from '../core/entry';
import { feasibility, type MissionPhase } from '../core/context';
export function ObservationEntry({
  packet,
  phase,
  initialMeasure,
  initialRole,
  suggestedRecord,
  sourceNote,
  onSave,
  onClose,
}: {
  packet: CasePacket;
  phase: MissionPhase;
  initialMeasure: Measure;
  initialRole: Phase;
  suggestedRecord?: Observation;
  /** A fictional source document shown beside the form, so the value is copied, never invented. */
  sourceNote?: string;
  onSave: (packet: CasePacket, measurement: Measure, role: Phase) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(() =>
    entryDraft(
      suggestedRecord
        ? { ...packet, observations: [...packet.observations, suggestedRecord] }
        : packet,
      initialMeasure,
      initialRole,
    ),
  );
  const [error, setError] = useState('');
  const [authorised, setAuthorised] = useState(false);
  const ref = useRef<HTMLDialogElement | null>(null);
  function choose(measurement: Measure, role: Phase) {
    setDraft(entryDraft(packet, measurement, role));
    setError('');
    setAuthorised(false);
  }
  function field(key: keyof EntryDraft, value: string) {
    setDraft((d) => ({ ...d, [key]: value }));
  }
  return (
    <dialog
      className="import-dialog entry-dialog"
      ref={(node) => {
        ref.current = node;
        if (node && !node.open) node.showModal();
      }}
      onCancel={onClose}
      aria-labelledby="entry-title"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            if (!authorised)
              throw new Error(
                'Confirm that this is a synthetic result from an already authorised demonstration assessment.',
              );
            const next = applyEntry(packet, draft);
            onSave(next, draft.measurement, draft.phase);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not validate observation.');
          }
        }}
      >
        <div className="dialog-heading">
          <div>
            <div className="eyebrow mono">MONITOR → REASSESS</div>
            <h2 id="entry-title">Record an existing demo result.</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close observation entry"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        <div className="review-banner">
          Synthetic observations only. Do not enter personal medical information.
        </div>
        {sourceNote && (
          <p className="entry-source-note" data-testid="entry-source-note">
            <strong>Source record</strong> {sourceNote}
          </p>
        )}
        <p className="footnote">
          This form records a result already obtained; it does not instruct a measurement. A unique
          existing direct record is updated. Multiple candidates require source inspection. Undo
          retains the previous packet.
        </p>
        <div className="entry-grid">
          <label>
            Measurement type
            <select
              value={draft.measurement}
              onChange={(e) => choose(e.target.value as Measure, draft.phase)}
            >
              {Object.entries(measures).map(([key, spec]) => (
                <option key={key} value={key}>
                  {spec.detail}
                </option>
              ))}
            </select>
          </label>
          <label>
            Session role
            <select
              value={draft.phase}
              onChange={(e) => choose(draft.measurement, e.target.value as Phase)}
            >
              <option value="baseline">Baseline</option>
              <option value="followup">Follow-up</option>
            </select>
          </label>
          <label>
            Recorded value
            <input
              autoFocus
              required
              inputMode="decimal"
              value={draft.value}
              onChange={(e) => field('value', e.target.value)}
            />
          </label>
          <label>
            Canonical unit
            <input readOnly value={draft.unit} />
          </label>
          <label>
            Session label
            <input
              required
              maxLength={100}
              value={draft.session}
              onChange={(e) => field('session', e.target.value)}
            />
          </label>
          <label>
            Timestamp (UTC, optional)
            <input
              placeholder="2026-11-14T01:00:00Z"
              value={draft.timestamp}
              onChange={(e) => field('timestamp', e.target.value)}
            />
          </label>
        </div>
        <details className="entry-provenance">
          <summary>Verify protocol & source metadata</summary>
          <p className="footnote">
            Existing metadata is shown for verification. Matching a label does not validate an
            instrument or make two protocols equivalent. Source issues are retained.
          </p>
          <div className="entry-grid">
            {(
              [
                ['protocol', 'Protocol'],
                ['window', 'Comparison window'],
                ['sourceId', 'Source identity'],
                ['sourceRecord', 'Source record reference'],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  required
                  maxLength={100}
                  value={draft[key]}
                  onChange={(e) => field(key, e.target.value)}
                />
              </label>
            ))}
          </div>
        </details>
        {draft.acquisition && (
          <fieldset className="entry-provenance">
            <legend>Recorded cycling acquisition conditions</legend>
            <p>
              Fictional microgravity cycling, already obtained. Matching labels do not validate
              physiological compatibility. Workload is recorded context, never a target.
            </p>
            <div className="entry-grid">
              <label>
                Recorded workload (W)
                <input
                  required
                  type="number"
                  min="0"
                  step="any"
                  value={draft.acquisition.workloadWatts}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      acquisition: { ...d.acquisition!, workloadWatts: Number(e.target.value) },
                    }))
                  }
                />
              </label>
              {(['timing', 'device'] as const).map((key) => (
                <label key={key}>
                  {key === 'timing' ? 'Measurement timing / exercise phase' : 'Device context'}
                  <input
                    required
                    maxLength={100}
                    value={draft.acquisition![key]}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        acquisition: { ...d.acquisition!, [key]: e.target.value },
                      }))
                    }
                  />
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <p className="entry-feasibility">{feasibility(packet, phase, draft.measurement)}</p>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={authorised}
            onChange={(e) => setAuthorised(e.target.checked)}
          />
          This is a synthetic result from an already authorised demonstration assessment.
        </label>
        {error && (
          <div className="import-error" role="alert">
            {error}
          </div>
        )}
        <button className="button primary full" type="submit">
          Validate observation & reassess
        </button>
      </form>
    </dialog>
  );
}
