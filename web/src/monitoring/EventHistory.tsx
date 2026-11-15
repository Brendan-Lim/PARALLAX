import { eventMeaning, eventOrigin, needsReview } from './semantics';
import type { Ledger } from './model';
import type { MissionState } from '../mission/state';
import { clock, deliveryFacts, eventCondition, eventTitle } from './presentation';

/** Persisted event facts. Receipt, acknowledgment and review inclusion are independent facts,
 * shown separately and never as one ordered pipeline. Events stay in ledger order. */
export default function EventHistory({
  data,
  runId,
  state,
  acknowledge,
  pending = false,
  variant = 'console',
}: {
  data: Ledger;
  runId: string;
  state?: MissionState;
  acknowledge?: (id: string) => void;
  pending?: boolean;
  variant?: 'console' | 'companion';
}) {
  const events = data.events.filter((e) => e.runId === runId);
  const companion = variant === 'companion';
  const intro = (
    <p className="mc-events-intro">
      Notifications concern information availability or an explicitly simulated upstream request.
      Acknowledgment records notification awareness, not medical resolution. A foreground render
      receipt proves neither viewport visibility nor human attention. Human review and source
      recovery are separate.
    </p>
  );
  return (
    <section
      aria-labelledby="monitor-events-title"
      data-testid="monitor-event-history"
      className={companion ? 'mc-events is-companion' : 'mc-events'}
    >
      <h2 id="monitor-events-title" tabIndex={-1}>
        {companion ? 'Notifications for this replay' : 'Monitoring event ledger'}
      </h2>
      {!companion && intro}
      {!events.length && <p className="mc-empty">No events persisted for this run.</p>}
      <ol className="mc-timeline">
        {events.map((event) => {
          const { receipt, attempt, ack } = deliveryFacts(data, event.id);
          const sample = data.samples.find((s) => s.id === event.observationId);
          const reviews = state?.reviews.filter((r) =>
            r.monitoring?.events.some((e) => e.id === event.id),
          );
          const tone =
            event.type === 'monitoring-recovery'
              ? 'is-recovery'
              : event.type === 'simulated-external-alert'
                ? 'is-external'
                : 'is-interruption';
          const open = needsReview(event) && !ack;
          return (
            <li key={event.id}>
              <article
                className={`mc-event ${tone} ${open ? 'is-open' : ''}`}
                data-testid={`event-${event.type}`}
              >
                <span className="mc-event-marker" aria-hidden="true">
                  {event.type === 'monitoring-recovery'
                    ? '✓'
                    : event.type === 'simulated-external-alert'
                      ? '↗'
                      : '!'}
                </span>
                <div className="mc-event-body">
                  <h3 id={`event-${event.id}`} tabIndex={-1}>
                    {eventTitle(event)}
                  </h3>
                  {eventCondition(event, sample) && (
                    <p className="mc-event-condition">{eventCondition(event, sample)}</p>
                  )}
                  {event.type === 'monitoring-interruption' && (
                    <p className="mc-event-condition">Current usable observation unavailable.</p>
                  )}
                  <p className="mc-event-origin">
                    <strong>Origin: {eventOrigin(event)}</strong>
                  </p>
                  {acknowledge && (
                    <button
                      className={`s-button mc-ack ${ack ? 'is-acked' : ''}`}
                      disabled={!receipt || !!ack || pending}
                      onClick={() => acknowledge(event.id)}
                    >
                      {ack ? (
                        <>
                          <span aria-hidden="true">✓</span> Notification acknowledged
                        </>
                      ) : (
                        'Acknowledge notification'
                      )}
                    </button>
                  )}
                  <p className="mc-event-meaning">{eventMeaning(event)}</p>
                  {sample && (
                    <p className="mc-event-sample">
                      Source relative {sample.observation.relativeSeconds} s · original mask{' '}
                      {sample.observation.originalQualityCode ?? 'missing'} ·{' '}
                      {sample.observation.qualityConditions.join(', ')} · raw{' '}
                      {sample.observation.originalValue} bpm{' '}
                      {sample.observation.usability === 'usable'
                        ? '(quality usable at processing)'
                        : '(withheld as current)'}
                    </p>
                  )}
                  <ul className="mc-facts" aria-label="Recorded facts for this event">
                    <li className="is-done">Event recorded {clock(event.createdAt)}</li>
                    <li data-testid="delivery-state" className={receipt ? 'is-done' : ''}>
                      {receipt
                        ? `Foreground companion render; receipt persisted ${receipt.at}.`
                        : attempt
                          ? `Delivery attempt persisted ${attempt.at}; no companion receipt yet.`
                          : 'Available in persisted ledger; no delivery attempt recorded.'}
                    </li>
                    <li data-testid="ack-state" className={ack ? 'is-done' : open ? 'is-open' : ''}>
                      {ack ? `Acknowledged by ${ack.role} at ${ack.at}.` : 'Not acknowledged.'}
                    </li>
                    <li className={reviews?.length ? 'is-done' : ''}>
                      {reviews?.length
                        ? `Included in saved review ${reviews.map((r) => r.id).join(', ')}.`
                        : 'No saved review inclusion confirmed in this view.'}
                    </li>
                  </ul>
                  <p className="mc-event-id m-fine">Event {event.id}</p>
                </div>
              </article>
            </li>
          );
        })}
      </ol>
      {companion && intro}
    </section>
  );
}
