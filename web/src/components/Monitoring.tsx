import { ArrowRight, BookOpen, Focus } from 'lucide-react';
import type { CasePacket, Finding, Measure } from '../core/model';
import { measures, statusLabels } from '../core/model';
import {
  missionContext,
  missionPhases,
  feasibility,
  actionApplicability,
  type MissionPhase,
} from '../core/context';
import { education, sourceById } from '../data/science';
import {
  actionStates,
  currentActionState,
  type HealthAction,
  type ActionReceipt,
  type ActionState,
} from '../core/actions';

export function ContextBar({
  packet,
  phase,
  onChange,
}: {
  packet: CasePacket;
  phase: MissionPhase;
  onChange: (phase: MissionPhase) => void;
}) {
  const context = missionContext(packet, phase);
  return (
    <section className="context-bar" aria-label="Mission context">
      <div>
        <label htmlFor="mission-phase" className="eyebrow mono">
          MISSION REVIEW CONTEXT
        </label>
        <select
          id="mission-phase"
          value={phase}
          onChange={(e) => onChange(e.target.value as MissionPhase)}
        >
          {Object.entries(missionPhases).map(([key, value]) => (
            <option value={key} key={key}>
              {value.label}
            </option>
          ))}
        </select>
        <strong>{context.identity}</strong>
      </div>
      <div>
        <p>{context.explanation}</p>
        <details>
          <summary>Acquisition setting & limits</summary>
          <p>{context.acquisition}</p>
          <p>{context.boundary}</p>
        </details>
      </div>
    </section>
  );
}
export function Assessment({
  packet,
  finding,
  phase,
  onEvidence,
  onAction,
}: {
  packet: CasePacket;
  finding: Finding;
  phase: MissionPhase;
  onEvidence: () => void;
  onAction: () => void;
}) {
  const key = finding.id as Measure;
  const info = education[key];
  if (!info) return null;
  return (
    <section tabIndex={-1} className="panel assessment" aria-label="Selected health assessment">
      <div className="eyebrow mono">ASSESS · {measures[key].domain.toUpperCase()}</div>
      <h2>{measures[key].detail}</h2>
      <span className={`evidence-state state-${finding.status}`}>
        <span />
        {statusLabels[finding.status]}
      </span>
      <p>{info.meaning}</p>
      {!actionApplicability(packet, phase, key).actionable && (
        <p className="entry-feasibility">
          {actionApplicability(packet, phase, key).state}:{' '}
          {actionApplicability(packet, phase, key).explanation}
        </p>
      )}
      <div className="assessment-finding">
        <span className="mono">RECORDED OBSERVATION</span>
        <h3>{finding.explanation}</h3>
        {finding.issues.map((issue) => (
          <p key={issue}>{issue}</p>
        ))}
      </div>
      <details className="assessment-rule">
        <summary>Applicable evidence requirement & source records</summary>
        <p>
          A direct baseline and follow-up for this measurement with compatible units, source,
          protocol and comparison window, distinct sessions and valid timing.
        </p>
        {finding.requirements.map((r) => (
          <p key={r}>{r}</p>
        ))}
        {finding.evidence.map((r) => (
          <p key={r.id}>
            {r.phase}: {r.value} {r.unit} · {r.protocol} · {r.session}
            {r.acquisition && (
              <span className="table-sub">
                {r.acquisition.setting} · {r.acquisition.activity} · recorded{' '}
                {r.acquisition.workloadWatts} W · {r.acquisition.timing} · {r.acquisition.device}
              </span>
            )}
          </p>
        ))}
        {finding.excluded.map((r) => (
          <p key={r.id}>
            Derived: {r.id} depends on {r.derivedFrom.join(', ')}; not independent evidence.
          </p>
        ))}
      </details>
      <div className="assessment-columns">
        <div>
          <h3>Why it matters in spaceflight</h3>
          <p>{info.context}</p>
          <div className="education-links">
            {info.sources.map((id) => {
              const source = sourceById(id);
              return (
                <a href={source.url} target="_blank" rel="noreferrer" key={id}>
                  <BookOpen size={13} />
                  {source.title}
                </a>
              );
            })}
          </div>
        </div>
        <div>
          <h3>What remains unsupported</h3>
          <p>{info.boundary}</p>
          <p className="footnote">{feasibility(packet, phase, key)}</p>
        </div>
      </div>
      <div className="assessment-buttons">
        <button className="button primary" onClick={onEvidence}>
          <Focus size={16} /> Trace this finding in Evidence Lens
        </button>
        <button className="text-link" onClick={onAction}>
          Review applicable actions <ArrowRight size={14} />
        </button>
      </div>
      <p className="footnote">
        NASA education and published associations are separate from individual observations.
        Individual medical interpretation belongs to qualified personnel.
      </p>
    </section>
  );
}
export function ActionCard({
  action,
  receipts,
  onState,
  onOpen,
}: {
  action: HealthAction;
  receipts: Record<string, ActionReceipt>;
  onState: (action: HealthAction, state: ActionState) => void;
  onOpen: (action: HealthAction) => void;
}) {
  const state = currentActionState(action, receipts);
  return (
    <article className="panel action-card" data-testid={`action-${action.id}`}>
      <div className="action-top">
        <span className="eyebrow mono">{action.category}</span>
        <span className="pill">{state}</span>
      </div>
      <h3>{action.title.replace(/\bhr\b/g, 'heart-rate')}</h3>
      <p className="footnote">{action.applicability}</p>
      <p>{action.reason}</p>
      <details>
        <summary>Finding, sources & supervision</summary>
        <p>
          Triggered by:{' '}
          {action.findingIds.map((id) => (id === 'task' ? 'functional task' : id)).join(' + ')}{' '}
          evidence.
        </p>
        <p>{action.limitation}</p>
        <div className="education-links">
          {action.sourceIds.map((id) => {
            const s = sourceById(id);
            return (
              <a key={id} href={s.url} target="_blank" rel="noreferrer">
                {s.title}
              </a>
            );
          })}
        </div>
      </details>
      <div className="action-controls">
        <button className="text-link" onClick={() => onOpen(action)}>
          {action.target === 'entry'
            ? 'Review / add existing result'
            : action.target === 'plan'
              ? 'Open existing plan'
              : 'Inspect finding'}{' '}
          <ArrowRight size={14} />
        </button>
        <label>
          Review state
          <select
            aria-label={`Review state: ${action.title}`}
            value={state}
            onChange={(e) => onState(action, e.target.value as ActionState)}
          >
            {actionStates.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>
      {receipts[action.id] && receipts[action.id].signature !== action.signature && (
        <p className="footnote">
          Evidence or context changed. Review acknowledgement reset; the earlier acknowledgement
          does not cover this finding.
        </p>
      )}
    </article>
  );
}
export function ExistingPlan({
  completed,
  onChange,
}: {
  completed: boolean;
  onChange: (completed: boolean) => void;
}) {
  return (
    <section
      className="panel existing-plan"
      id="existing-plan"
      tabIndex={-1}
      aria-label="Existing synthetic countermeasure plan"
    >
      <div className="eyebrow mono">EXISTING PLAN · FICTIONAL TRAINING EXAMPLE</div>
      <h2>A prescribed plan is a separate record.</h2>
      <p>
        Example PLAN-DEMO-01: a fictional qualified team has already assigned an
        exercise-countermeasure activity. Its prescription is deliberately not reproduced here.
        Consult the existing authorised plan for all instructions.
      </p>
      <label className="checkbox-row">
        <input type="checkbox" checked={completed} onChange={(e) => onChange(e.target.checked)} />
        Record demonstration activity as completed
      </label>
      <p className="footnote">
        {completed ? 'Activity recorded. ' : ''}A plan is not an observation. Completion does not
        change evidence support, certify readiness or guarantee preserved function. No new
        prescription or treatment change is generated.
      </p>
      <a className="text-link" href={sourceById('exercise').url} target="_blank" rel="noreferrer">
        NASA countermeasure education <ArrowRight size={14} />
      </a>
    </section>
  );
}
