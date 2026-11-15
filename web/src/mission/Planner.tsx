import { revealTarget } from './navigation';
import { ActionRegion, PlanningRequest } from './PlanningRequest';
import { useState, type Dispatch, type KeyboardEvent } from 'react';
import { ArrowLeft } from 'lucide-react';
import { formatNumber, signed } from '../core/engine';
import { archiveRecords, followupRecordId, validateArchiveRecord } from './archive';
import { applicabilityLabels, assessmentPlanner, type ApplicabilityReason } from './assessments';
import { SourceRecords } from './Records';
import type { MissionCommand, MissionState } from './state';
import type { missionOverview } from './overview';

export const focusPlannerHeading = () => revealTarget('m-planner-title');

/** Presentation summary of the evaluator's applicability reasons; it never changes them. */
function primaryStatus(reasons: ApplicabilityReason[]) {
  const has = (r: ApplicabilityReason) => reasons.includes(r);
  if (has('information-available'))
    return { label: 'Information available', tone: 'usable', mark: 'ok' };
  if (has('existing-record-retrievable'))
    return { label: 'Record retrievable', tone: 'usable', mark: 'archive' };
  if (has('reviewer-excluded')) return { label: 'Record excluded', tone: 'withheld', mark: 'open' };
  if (has('future-phase-requirement'))
    return { label: 'Future phase · unresolved', tone: 'historical', mark: 'later' };
  if (has('environment-incompatible') || has('phase-incompatible'))
    return { label: 'Environment incompatible', tone: 'historical', mark: 'later' };
  if (has('research-only')) return { label: 'Research only', tone: 'historical', mark: 'locked' };
  if (has('equipment-unavailable'))
    return { label: 'Equipment unavailable', tone: 'withheld', mark: 'locked' };
  if (has('additional-assessment-needed'))
    return { label: 'Additional information needed', tone: 'withheld', mark: 'open' };
  return { label: 'Unresolved', tone: 'withheld', mark: 'open' };
}
const goodReasons: readonly ApplicabilityReason[] = [
  'information-available',
  'existing-record-retrievable',
];
const historicalStatus = (id: string) =>
  id === 'force' ? { label: 'Historical reference only', tone: 'historical', mark: 'hist' } : null;

export function AssessmentPlanner({
  state,
  navigation = 0,
  model,
  dispatch,
  editable = true,
  onInterpretation,
}: {
  state: MissionState;
  navigation?: number;
  model: ReturnType<typeof missionOverview>;
  dispatch: Dispatch<MissionCommand>;
  editable?: boolean;
  onInterpretation?: () => void;
}) {
  const [inspected, setInspected] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [action, setAction] = useState<'retrieved' | 'removed' | ''>('');
  const [error, setError] = useState('');
  const requestedOption = () => {
    const id = location.hash.split('/')[3];
    return assessmentPlanner(state, model).some((item) => item.option.id === id) ? id : 'exercise';
  };
  const [selected, setSelected] = useState(requestedOption);
  const [lastNavigation, setLastNavigation] = useState(navigation);
  if (lastNavigation !== navigation) {
    setLastNavigation(navigation);
    setSelected(requestedOption());
  }
  const select = (id: string) => {
    setSelected(id);
    if (window.matchMedia('(max-width: 899px)').matches)
      requestAnimationFrame(() =>
        document
          .getElementById(`m-task-panel-${id}`)
          ?.scrollIntoView({ behavior: 'instant', block: 'start' }),
      );
  };
  const moveSelection = (event: KeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const tabs = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    const i = tabs.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? tabs.length - 1
          : (i + (event.key === 'ArrowDown' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[next]?.focus();
    setSelected(tabs[next]?.id.replace('m-task-', '') ?? selected);
  };
  const included = state.includedRecordIds.includes(followupRecordId);
  const excluded = state.excludedRecordIds.includes(followupRecordId);
  const items = assessmentPlanner(state, model);
  const comparison = model.exerciseComparison;
  return (
    <section className="m-planner" aria-labelledby="m-planner-title" data-testid="mission-planner">
      <p className="m-eyebrow">Collect evidence for this review</p>
      <h2 id="m-planner-title" tabIndex={-1}>
        Assessment planner
      </h2>
      <p>
        Start with information that already exists. Other assessments need an approved method,
        suitable resources and the right environment.
      </p>
      <p className="m-fine">
        Fictional records only. This planner starts no physical test and accepts no visitor health
        data.
      </p>
      <div role="status" aria-atomic="true" className="m-planner-result">
        {action === 'retrieved' && included && (
          <>
            Obtained: the 28 June fictional cycling record,{' '}
            {formatNumber(archiveRecords()[0].value)} bpm at 100 W.
            {comparison
              ? ` The evaluator now supports ${signed(comparison.absolute)} ${comparison.changeUnit} between the two recorded sessions.`
              : ' The current selection or environment does not support a comparison.'}{' '}
            Information available for {model.coverage.available} of {model.coverage.total}{' '}
            {state.context.phase} items. Post-landing mobility remains unestablished. Available
            oxygen-uptake and diary records retain their separate limits. {model.reviewDisposition}
          </>
        )}
        {action === 'removed' && !included && (
          <>
            Retrieval undone. The follow-up remains in the archive and is absent from this review.
            Exercise change is unestablished; information available for {model.coverage.available}{' '}
            of {model.coverage.total} {state.context.phase} items. Mobility remains unresolved.
          </>
        )}
      </div>
      {included && onInterpretation && (
        <button className="s-button" onClick={onInterpretation}>
          Interpret retrieved findings
        </button>
      )}
      {error && <p role="alert">{error}</p>}
      <div className="m-planner-grid">
        <div
          className="m-tasklist"
          id="m-assessment-list"
          role="tablist"
          aria-label="Assessment options"
          aria-orientation="vertical"
          onKeyDown={moveSelection}
        >
          {(
            [
              ['Health domains in this review', items.slice(0, 4)],
              ['Other options considered', items.slice(4)],
            ] as const
          ).map(([heading, group]) => (
            <div key={heading} role="presentation">
              <h3 aria-hidden="true">{heading}</h3>
              <div className="m-task-group" role="presentation">
                {group.map(({ option, reasons }) => {
                  const status = historicalStatus(option.id) ?? primaryStatus(reasons);
                  return (
                    <button
                      key={option.id}
                      role="tab"
                      id={`m-task-${option.id}`}
                      className="m-task"
                      aria-selected={selected === option.id}
                      aria-controls={`m-task-panel-${option.id}`}
                      tabIndex={selected === option.id ? 0 : -1}
                      onClick={() => select(option.id)}
                    >
                      <i
                        className={`m-mark is-${status.mark} tone-${status.tone}`}
                        aria-hidden="true"
                      />
                      <span className="m-task-name">{option.label}</span>
                      <span className={`m-task-status tone-${status.tone}`}>{status.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="m-task-detail">
          <a className="m-back-list" href="#mission/health/assessments">
            <ArrowLeft size={15} aria-hidden="true" /> Back to the assessment list
          </a>
          {items.map(
            ({
              option,
              reasons,
              canRetrieve,
              missingEquipment,
              missingAssistance,
              missingSupervision,
            }) => (
              <div
                key={option.id}
                className="m-assessment"
                data-testid={`assessment-${option.id}`}
                role="tabpanel"
                id={`m-task-panel-${option.id}`}
                aria-labelledby={`m-task-${option.id}`}
                hidden={selected !== option.id}
              >
                <p className="m-eyebrow">{option.domain}</p>
                <h3>{option.label}</h3>
                <ul className="m-assessment-status" aria-label={`${option.label} status`}>
                  {reasons.map((reason) => (
                    <li
                      key={reason}
                      className={goodReasons.includes(reason) ? 'is-good' : undefined}
                    >
                      {applicabilityLabels[reason]}
                    </li>
                  ))}
                </ul>
                <ActionRegion
                  title={option.label}
                  why={
                    option.id === 'exercise' && !included
                      ? 'Inspect the existing observation before changing review membership.'
                      : option.next
                  }
                >
                  {option.id === 'exercise' ? (
                    included ? (
                      <button className="s-button" onClick={onInterpretation}>
                        View updated interpretation
                      </button>
                    ) : (
                      <button
                        className="s-button"
                        onClick={() => {
                          const source = document.querySelector<HTMLDetailsElement>(
                            '[data-testid="archive-source"]',
                          );
                          if (source) {
                            source.open = true;
                            if (inspected) {
                              source
                                .querySelector<HTMLInputElement>('input[type="checkbox"]')
                                ?.focus();
                              return;
                            }
                            setInspected(true);
                            const summary = source.querySelector('summary');
                            summary?.focus();
                            source.scrollIntoView({ block: 'start' });
                          }
                        }}
                      >
                        {inspected
                          ? confirmed
                            ? 'Review confirmed acquisition conditions'
                            : 'Confirm acquisition conditions'
                          : 'Inspect archive record'}
                      </button>
                    )
                  ) : option.id === 'mobility' ? (
                    <a className="s-button" href="#mission/surface">
                      Explore surface assessment requirements
                    </a>
                  ) : model.rich && ['aerobic', 'sleep'].includes(option.id) ? (
                    <button className="s-button" onClick={onInterpretation}>
                      View interpretation
                    </button>
                  ) : (
                    <button
                      className="s-button"
                      onClick={() => {
                        const resources = document.getElementById(
                          `resources-${option.id}`,
                        ) as HTMLDetailsElement;
                        resources.open = true;
                        resources.querySelector('summary')?.focus();
                        resources.scrollIntoView({ block: 'start' });
                      }}
                    >
                      {option.id === 'sleep'
                        ? 'Review missing diary entry'
                        : 'Review required resources'}
                    </button>
                  )}
                </ActionRegion>
                <p>{option.rationale}</p>
                <p>
                  {option.id === 'exercise' && included
                    ? 'Retrieved from the fictional onboard exercise archive. The original acquisition conditions are preserved.'
                    : option.option}
                </p>
                <p className="m-assessment-limit">{option.limitation}</p>
                {option.id === 'exercise' && (
                  <>
                    <details className="m-details" data-testid="archive-source">
                      <summary>Inspect fictional exercise archive source</summary>
                      <p>
                        This observation was collected on 28 June 2040. Retrieving it adds an
                        existing source record; it does not measure heart rate again.
                      </p>
                      <SourceRecords
                        records={archiveRecords()}
                        excluded={state.excludedRecordIds}
                        status={!included ? 'Archive only · not in this review' : undefined}
                      />
                      {canRetrieve && (
                        <>
                          <label className="m-check">
                            <input
                              type="checkbox"
                              disabled={!editable}
                              checked={confirmed}
                              onChange={(event) => setConfirmed(event.target.checked)}
                            />
                            Confirm acquisition conditions: I reviewed the fictional acquisition
                            conditions
                          </label>
                          <button
                            className="s-button"
                            disabled={!editable || !confirmed}
                            onClick={() => {
                              try {
                                const record = validateArchiveRecord(
                                  archiveRecords()[0],
                                  state.context,
                                );
                                dispatch({ type: 'retrieve-record', record });
                                setAction('retrieved');
                                setError('');
                                setConfirmed(false);
                                focusPlannerHeading();
                              } catch {
                                setError(
                                  'The fictional source could not be validated. No record was added.',
                                );
                              }
                            }}
                          >
                            Add record to review
                          </button>
                        </>
                      )}
                    </details>
                    {included && (
                      <div className="m-planner-actions">
                        <p>
                          {excluded
                            ? 'The retrieved record is intentionally excluded. Restore it to let the evaluator reassess the pair.'
                            : 'The source record is included in this review.'}
                        </p>
                        <label className="m-check">
                          <input
                            type="checkbox"
                            disabled={!editable}
                            checked={!excluded}
                            onChange={(event) =>
                              dispatch({
                                type: 'record-availability',
                                recordId: followupRecordId,
                                available: event.target.checked,
                              })
                            }
                          />
                          Include retrieved record in comparison
                        </label>
                        <button
                          className="s-button s-secondary"
                          disabled={!editable}
                          onClick={() => {
                            dispatch({ type: 'remove-retrieved-record' });
                            setAction('removed');
                            setConfirmed(false);
                            focusPlannerHeading();
                          }}
                        >
                          Undo retrieval
                        </button>
                      </div>
                    )}
                  </>
                )}
                <p className="m-next">
                  <strong>Next review action: </strong>
                  {option.id === 'exercise' && included
                    ? excluded
                      ? 'Restore the excluded record or undo retrieval. The original source remains intact.'
                      : 'Review the exercise response alongside available oxygen-uptake and sleep records. Current force and surface mobility remain unresolved.'
                    : option.next}
                </p>
                <details className="m-details" id={`resources-${option.id}`}>
                  <summary>Equipment, assistance and scientific basis</summary>
                  <dl className="m-option-resources">
                    <dt>Equipment</dt>
                    <dd>
                      {option.equipment.join(', ') || 'No measurement device for a self-report.'}
                      {missingEquipment.length > 0 && ` Missing: ${missingEquipment.join(', ')}.`}
                    </dd>
                    <dt>Assistance</dt>
                    <dd>
                      {option.assistance.join(', ') ||
                        'No additional operator specified. Future collection still requires mission approval.'}
                      {missingAssistance.length > 0 &&
                        ' Required qualification is not listed among mission resources.'}
                    </dd>
                    <dt>Supervision</dt>
                    <dd>
                      {option.supervision.join(', ') ||
                        'No new exercise; previous fictional acquisition conditions are retained.'}
                      {missingSupervision.length > 0 && ' Availability is not established.'}
                    </dd>
                    <dt>Protocol</dt>
                    <dd>
                      {option.protocol
                        ? `${option.protocol}: not approved for collection in this prototype.`
                        : 'Existing fictional record only; no new acquisition protocol.'}
                    </dd>
                    <dt>Evidence maturity</dt>
                    <dd>
                      {option.maturity.replaceAll('-', ' ')}. This catalogue does not grant mission
                      approval.
                    </dd>
                  </dl>
                  {!['exercise'].includes(option.id) &&
                    !(model.rich && ['aerobic', 'sleep'].includes(option.id)) && (
                      <PlanningRequest
                        need={
                          option.id === 'force'
                            ? 'compatible-strength'
                            : option.id === 'mobility'
                              ? 'surface-mobility'
                              : option.id === 'sleep'
                                ? 'sleep-diary'
                                : option.id === 'aerobic'
                                  ? 'aerobic-resources'
                                  : 'other-resources'
                        }
                      />
                    )}
                  <a href={option.source.sourceUrl} target="_blank" rel="noreferrer">
                    {option.source.locator}
                  </a>
                  <p className="m-fine">
                    {option.source.population}. {option.source.acquisitionContext}
                  </p>
                  {option.additionalSource && (
                    <p>
                      <a href={option.additionalSource.url} target="_blank" rel="noreferrer">
                        {option.additionalSource.label}
                      </a>
                    </p>
                  )}
                </details>
              </div>
            ),
          )}
        </div>
      </div>
    </section>
  );
}
