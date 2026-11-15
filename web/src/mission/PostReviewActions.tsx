import { companionLink } from './navigation';
import type { MissionState } from './state';
import type { MonitoringSnapshot } from '../monitoring/snapshot';
import { bindingMatches, needsReview } from '../monitoring/model';
import { monitoringNextAction } from '../monitoring/nextAction';
import { planCurrency } from './review';
import { usePlanningRequests } from './PlanningRequest';

export function PostReviewActions({
  state,
  monitoring,
  reviewNotice,
  durable,
}: {
  state: MissionState;
  monitoring?: MonitoringSnapshot;
  reviewNotice: string;
  durable: boolean;
}) {
  const requests = usePlanningRequests();
  const run = monitoring?.run;
  const associated = !!run && bindingMatches(run, state) && run.status !== 'stale';
  const outstanding =
    associated &&
    monitoring?.events.find(
      (e) => needsReview(e) && !monitoring.acknowledgments.some((a) => a.eventId === e.id),
    );
  const action = monitoringNextAction({
    plan: state.monitoringPlans.some((p) => planCurrency(p, state) === 'current'),
    error: monitoring?.availability === 'unavailable' ? 'Monitoring storage unavailable' : '',
    run: !!run,
    associated,
    status: run?.status ?? '',
    usability: monitoring?.samples.at(-1)?.usability,
    unacknowledged: !!outstanding,
  });
  function status(need: string) {
    const request = requests.find((r) => r.need === need);
    return request ? (
      <p>
        <strong>Planning request recorded locally for qualified review.</strong>{' '}
        {request.recordedAt}.
      </p>
    ) : (
      <p>Information needed. No local planning request recorded.</p>
    );
  }
  return (
    <section
      className="m-health-actions"
      aria-labelledby="m-health-actions-title"
      data-testid="post-review-actions"
    >
      <h3 id="m-health-actions-title" tabIndex={-1}>
        Your next health actions
      </h3>
      <a className="s-button" href="#mission/surface/requirements">
        Plan surface assessment
      </a>
      <p>
        {durable ? 'Your findings are preserved.' : 'This snapshot is held in memory only.'}{' '}
        Continue investigating the remaining health-information requirements.
      </p>
      <p className="m-fine">
        Current follow-up status, separate from the immutable selected snapshot. {reviewNotice}
      </p>
      <article>
        <h4>Surface functional capability · information needed</h4>
        <p>
          Historical and transit measurements do not establish mobility in a new gravity
          environment.
        </p>
        {status('surface-mobility')}
      </article>
      <article>
        <h4>Musculoskeletal performance · information needed</h4>
        <p>
          Historical preflight force reference: 1,000 N on Earth at 1 g. Current comparable strength
          information is unavailable.
        </p>
        {status('compatible-strength')}
        <a className="m-text-action" href="#mission/health/assessments/force">
          Review strength requirements
        </a>
      </article>
      <article>
        <h4>
          Monitoring follow-up ·{' '}
          {run && !associated
            ? 'historical monitoring record'
            : outstanding
              ? 'acknowledgment required'
              : monitoring?.acknowledgments.length
                ? 'acknowledgment recorded'
                : run
                  ? 'monitoring history available'
                  : 'information needed'}
        </h4>
        <p>
          {action.why} Historical interruptions remain recorded; signal recovery does not establish
          physiological recovery. Acknowledgment records receipt, not clinical resolution.
        </p>
        <a
          className="m-text-action"
          href={
            outstanding
              ? companionLink(state.sessionId, run?.id ?? '', outstanding.id)
              : action.id === 'designation'
                ? '#mission/health/designation'
                : action.id === 'review' || action.id === 'history'
                  ? '#mission/monitoring/history'
                  : action.id === 'conditions' || action.id === 'resume'
                    ? '#mission/monitoring/observation'
                    : '#mission/monitoring'
          }
          target={outstanding ? '_blank' : undefined}
          rel={outstanding ? 'noreferrer' : undefined}
        >
          {outstanding ? 'Open companion and acknowledge' : action.title}
        </a>
      </article>
      <p>
        Reassess when additional observations or qualified feedback become available. PARALLAX
        preserves earlier reviews and distinguishes them from findings based on newer evidence.
      </p>
      <a className="m-text-action" href="#mission/health">
        Return to health overview
      </a>{' '}
      ·{' '}
      <a className="m-text-action" href="#mission/health/watchlist">
        Review outstanding information requirements
      </a>
      {requests.some((r) => r.need === 'surface-mobility') && (
        <p>
          <a className="m-text-action" href="#mission/surface/requests">
            Inspect saved surface request
          </a>
        </p>
      )}
      {requests.length > 0 && (
        <p className="m-fine">
          Existing local requests are not bound to a review or evidence generation. No transmission,
          scheduling or assessment completion is established. Inspect them in the surface or
          strength planning controls.
        </p>
      )}
    </section>
  );
}
