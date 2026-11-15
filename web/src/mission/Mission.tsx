import { revealTarget } from './navigation';
import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, RotateCcw } from 'lucide-react';
import { demoMode } from './demoProfile';
import { EditingContext } from './EditingNotice';
const MissionGuide = lazy(() => import('./MissionGuide'));
const Chapters = lazy(() => import('./MissionChapters'));
import { useMissionWriter } from './writer';
import type { MissionState } from './state';
const MonitoringConsole = lazy(() => import('../monitoring/MonitoringConsole'));
const MissionHealth = lazy(() => import('./MissionHealth'));
import './mission.css';

const date = (value: string) =>
  new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value));

export type MissionSection =
  'overview' | 'assessments' | 'watchlist' | 'review' | 'designation' | 'saved' | 'actions';
const sectionIds: readonly string[] = [
  'overview',
  'assessments',
  'watchlist',
  'review',
  'designation',
  'saved',
  'actions',
];
export interface SectionRequest {
  section: MissionSection;
  n: number;
}

const phaseLabels = {
  preflight: 'Earth preflight',
  transit: 'Microgravity transit',
  approach: 'Approach to Mars',
  surface: 'Mars surface',
} as const;

export default function Mission({
  navigation,
  chapter,
  health,
  monitoring = false,
  section,
  onNavigate,
}: {
  navigation: object;
  chapter?: 'preflight' | 'transit' | 'surface';
  health: boolean;
  monitoring?: boolean;
  section?: string;
  onNavigate: (hash: string) => void;
}) {
  const { state, dispatch, notice, setNotice, storageFailed, editable, isOwner } =
    useMissionWriter(health);
  useEffect(() => {
    if (demoMode && health && !state.entered) dispatch({ type: 'begin' });
  }, [health, state.entered, dispatch]);
  const restartDialog = useRef<HTMLDialogElement>(null);
  const { context } = state;
  const surface = context.phase === 'surface';
  const phaseLabel = phaseLabels[context.phase];
  const routeSection = (
    sectionIds.includes(section ?? '') ? section : 'overview'
  ) as MissionSection;
  const [request, setRequest] = useState<SectionRequest>({ section: routeSection, n: 0 });
  const [lastRoute, setLastRoute] = useState(navigation);
  if (lastRoute !== navigation) {
    // A deep link such as #mission/health/assessments asks the overview to reveal that section.
    setLastRoute(navigation);
    setRequest((r) => ({ section: routeSection, n: r.n + 1 }));
  }

  useEffect(() => {
    if (monitoring)
      return revealTarget(
        location.hash.includes('/history')
          ? 'monitor-events-title'
          : location.hash.includes('/interruption') || location.hash.includes('/observation')
            ? 'mc-observation'
            : 'monitor-console-title',
      );
    if (!health && !chapter && request.n > 0) return revealTarget('mission-title');
  }, [health, monitoring, chapter, navigation, request.n]);

  const begin = () => {
    dispatch({ type: 'begin' });
    onNavigate('mission/health');
  };

  return (
    <div
      className={`m-experience ${health ? 'm-health' : 'm-landing'}`}
      onClick={(event) => {
        // Section links inside the health route reveal sections in place, including links whose
        // target equals the current hash (which would not fire hashchange).
        if (
          !health ||
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        const link = (event.target as HTMLElement).closest('a');
        if (monitoring) {
          if (link?.getAttribute('href') === '#mission/monitoring') {
            event.preventDefault();
            onNavigate('mission/monitoring');
          }
          return;
        }
        const match = link?.getAttribute('href')?.match(/^#mission\/health(?:\/(\w+))?(?:\/\w+)?$/);
        if (!match) return;
        const s = (match[1] ?? 'overview') as MissionSection;
        if (!sectionIds.includes(s)) return;
        event.preventDefault();
        // Changed hashes follow the router. Repeated selection still reveals and focuses.
        const hash = link!.getAttribute('href')!;
        if (location.hash !== hash) onNavigate(hash.slice(1));
        else setRequest((r) => ({ section: s, n: r.n + 1 }));
      }}
    >
      <EditingContext.Provider value={notice}>
        {demoMode && (
          <Suspense fallback={<p role="status">Opening mission guide…</p>}>
            <MissionGuide
              state={state}
              editable={editable}
              storageFailed={storageFailed}
              navigation={navigation}
              onNavigate={onNavigate}
            />
          </Suspense>
        )}
        {notice && (
          <div className="m-notice" role="status">
            {notice}
          </div>
        )}
        {storageFailed && (
          <div className="m-notice m-notice-alert" role="alert">
            Changes cannot be saved in this browser. This mission continues in memory; reload may
            lose your progress.
          </div>
        )}
        {chapter ? (
          <Suspense fallback={<p role="status">Opening chapter…</p>}>
            <Chapters phase={chapter} navigation={navigation} />
          </Suspense>
        ) : !health ? (
          <Landing
            state={state}
            surface={surface}
            phaseLabel={phaseLabel}
            onBegin={() => dispatch({ type: 'begin' })}
            onOpen={begin}
          />
        ) : (
          <MissionShell
            state={state}
            active={monitoring ? 'monitoring' : request.section}
            storageFailed={storageFailed}
            editable={editable}
            onSection={(s) =>
              monitoring
                ? onNavigate(s === 'overview' ? 'mission/health' : `mission/health/${s}`)
                : setRequest((r) => ({ section: s, n: r.n + 1 }))
            }
            onRestart={() => restartDialog.current?.showModal()}
          >
            <Suspense
              fallback={
                <p className="m-loading" role="status">
                  Opening health overview…
                </p>
              }
            >
              {monitoring ? (
                <MonitoringConsole
                  state={state}
                  editable={editable && !storageFailed}
                  isOwner={isOwner}
                />
              ) : (
                <MissionHealth
                  state={state}
                  dispatch={dispatch}
                  storageFailed={storageFailed}
                  editable={editable}
                  request={request}
                  onSectionChange={(s) => setRequest((r) => ({ section: s, n: r.n }))}
                />
              )}
            </Suspense>
          </MissionShell>
        )}
      </EditingContext.Provider>
      <dialog className="s-dialog" ref={restartDialog} aria-labelledby="m-restart-title">
        <h2 id="m-restart-title">Restart this fictional mission?</h2>
        <p>
          This starts a new session with the follow-up in the archive only. Bounded historical
          reviews and monitoring designations are retained and become stale. Guided scenarios and
          the advanced workspace keep their own progress.
        </p>
        <div className="s-dialog-actions">
          <button className="s-button s-secondary" onClick={() => restartDialog.current?.close()}>
            Keep this mission
          </button>
          <button
            className="s-button"
            onClick={() => {
              dispatch({ type: 'restart' });
              restartDialog.current?.close();
              setNotice('Mission restarted. The 28 June record is in the archive only.');
              onNavigate('mission');
            }}
          >
            Restart mission review
          </button>
        </div>
      </dialog>
    </div>
  );
}

function Landing({
  state,
  surface,
  phaseLabel,
  onBegin,
  onOpen,
}: {
  state: MissionState;
  surface: boolean;
  phaseLabel: string;
  onBegin: () => void;
  onOpen: () => void;
}) {
  const { context } = state;
  const delay = context.earthCommunications.oneWayDelaySeconds / 60;
  return (
    <>
      <section className="m-hero" aria-labelledby="mission-title">
        <img
          className="m-mars"
          src="/images/mars-original.svg"
          width="1600"
          height="1000"
          alt="Original illustration of the sunlit rust-coloured rim of Mars against space"
          fetchPriority="high"
        />
        <p className="m-hero-note m-image-credit">AI-assisted illustration</p>
        <div className="m-hero-inner">
          <p className="m-hero-kicker">
            {context.missionName.split(' / ')[0]} · a fictional crewed mission to Mars
          </p>
          <h1 id="mission-title" tabIndex={-1}>
            {surface ? (
              <>
                You’ve landed.
                <br />
                What comes next?
              </>
            ) : (
              <>
                Tomorrow,
                <br />
                you land on Mars.
              </>
            )}
          </h1>
          <p className="m-premise">
            {surface
              ? 'A new world of gravity. A new set of unanswered questions.'
              : 'Nearly six months in microgravity. A new world of gravity ahead.'}
          </p>
          <p className="m-product">
            PARALLAX is a health companion for that transition. Review what your records show,
            retrieve the information that can still be obtained, and see when a heart-rate signal
            stops being usable, with Earth {delay} minutes away.
          </p>
          <div className="m-hero-actions">
            {!new URLSearchParams(location.search).has('legacy') && (
              <>
                <a className="m-primary" href="?demo=full#mission/preflight">
                  Start guided mission demo <ArrowRight size={18} aria-hidden="true" />
                </a>
                <a className="m-text-action" href="#mission/health" onClick={onBegin}>
                  Explore PARALLAX
                </a>
                <a className="m-text-action" href="?demo=short#mission/health">
                  Short judging path
                </a>
                <a className="m-text-action" href="?demo=full#mission/resume">
                  Resume guided demo
                </a>
              </>
            )}
            {new URLSearchParams(location.search).has('legacy') && (
              <a className="m-primary" href="#mission/health" onClick={onBegin}>
                {state.entered ? 'Resume mission review' : 'Begin mission review'}
                <ArrowRight size={18} aria-hidden="true" />
              </a>
            )}
            <p className="m-hero-note">Fictional crew and records. Human review decides.</p>
            <a className="m-text-action" href="/?legacy=1#mission/health">
              Original missing-evidence walkthrough
            </a>
          </div>
        </div>
        <dl className="m-orbit-label" aria-label="Fictional mission context">
          <div>
            <dt>Phase</dt>
            <dd>{phaseLabel}</dd>
          </div>
          <div>
            <dt>Mission date</dt>
            <dd>{date(context.fictionalNow)}</dd>
          </div>
          <div>
            <dt>Crew member</dt>
            <dd>{context.astronaut.name}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>Fictional scenario</dd>
          </div>
        </dl>
      </section>

      <nav className="m-chapter-nav" aria-label="Mission chapters">
        {['preflight', 'transit', 'approach', 'surface'].map((p) => (
          <a
            key={p}
            className="s-button s-secondary"
            href={p === 'approach' ? '#mission/health' : `#mission/${p}`}
          >
            {p[0].toUpperCase() + p.slice(1)}
          </a>
        ))}
      </nav>
      <section className="m-chapters" aria-labelledby="m-intro-title">
        <div className="m-chapters-head">
          <h2 id="m-intro-title">What do your health observations tell you about the landing?</h2>
          <p>
            An exercise record can show a change in heart rate. It cannot say whether balance and
            mobility will manage the transfer from lander to habitat.
          </p>
        </div>
        <ol className="m-chapter-list">
          <li>
            <h3>Understand your observations</h3>
            <p>
              Review separate gas-analysis and sleep-diary observations. Retrieve the second 100 W
              cycling record to describe exercise HR change.
            </p>
          </li>
          <li>
            <h3>Find information that can be obtained</h3>
            <p>
              Retrieve an archived record; see which assessments need equipment, a protocol or Mars
              gravity.
            </p>
          </li>
          <li>
            <h3>Monitor and communicate events</h3>
            <p>
              When the synthetic source reports a disconnected garment, the reading becomes
              unavailable though the number stays 72.
            </p>
          </li>
          <li>
            <h3>Preserve human review</h3>
            <p>A fictional medical officer saves a snapshot that never changes afterwards.</p>
          </li>
        </ol>
        <button className="m-text-action" onClick={onOpen}>
          Open the health overview <ArrowRight size={17} aria-hidden="true" />
        </button>
      </section>
    </>
  );
}

function MissionShell({
  state,
  active,
  storageFailed,
  editable,
  onSection,
  onRestart,
  children,
}: {
  state: MissionState;
  active: MissionSection | 'monitoring';
  storageFailed: boolean;
  editable: boolean;
  onSection: (section: MissionSection) => void;
  onRestart: () => void;
  children: ReactNode;
}) {
  const { context } = state;
  const surface = context.phase === 'surface';
  const time = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(context.fictionalNow));
  const items: [MissionSection | 'monitoring', string][] = [
    ['overview', 'Overview'],
    ['assessments', 'Assessments'],
    ['watchlist', 'Health watchlist'],
    ['monitoring', 'Monitoring'],
    ['review', 'Review'],
  ];
  const stages = [
    ['preflight', 'Preflight', '15 Dec 2039', 'Force reference'],
    ['transit', 'Transit', '15 & 28 Jun', 'Exercise records'],
    ['approach', 'Approach', '29 Jun 2040', 'Review before landing'],
    ['surface', 'Surface', '30 Jun onward', 'No surface results'],
  ] as const;
  const stageIndex = stages.findIndex(([id]) => id === context.phase);
  return (
    <div className="m-app">
      <aside className="m-sidebar">
        <div className="m-side-mission">
          <strong>{context.missionName}</strong>
          <span>{context.astronaut.name} · fictional crew</span>
        </div>
        <nav aria-label="Mission sections">
          <ul>
            {items.map(([id, label]) => (
              <li key={id}>
                <a
                  href={
                    id === 'monitoring'
                      ? '#mission/monitoring'
                      : id === 'overview'
                        ? '#mission/health'
                        : `#mission/health/${id}`
                  }
                  aria-current={active === id ? 'page' : undefined}
                  onClick={(e) => {
                    if (id === 'monitoring' || active !== 'monitoring') return;
                    e.preventDefault();
                    onSection(id);
                  }}
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <p className="m-local">
          Local fictional review ·{' '}
          {storageFailed ? 'memory only' : editable ? 'saved in this browser' : 'read-only view'}
        </p>
      </aside>
      <div className="m-main">
        <section className="m-missionbar" aria-label="Fictional mission context">
          <div className="m-missionbar-id">
            <strong>
              {date(context.fictionalNow)} · {time} UTC
            </strong>
            <span>
              {surface ? 'On the surface' : 'Landing tomorrow'} · {context.gravity} · fictional
              mission
            </span>
          </div>
          <ol className="m-stages" aria-label="Fictional mission timeline">
            {stages.map(([id, label, when, note], i) => (
              <li
                key={id}
                aria-current={id === context.phase ? 'step' : undefined}
                className={i < stageIndex ? 'm-stage-done' : i > stageIndex ? 'm-stage-next' : ''}
              >
                <a
                  className="m-stage-label"
                  href={id === 'approach' ? '#mission/health' : `#mission/${id}`}
                >
                  {label}
                </a>
                <span className="m-stage-when">
                  {when}
                  {id === context.phase ? ' · now' : ''}
                </span>
                <span className="sr-only">{note}</span>
              </li>
            ))}
          </ol>
          <div className="m-missionbar-earth">
            <span>Earth link</span>
            <strong>
              {context.earthCommunications.oneWayDelaySeconds / 60} min one-way ·{' '}
              {context.earthCommunications.status === 'outage' ? 'scenario outage' : 'illustrative'}
            </strong>
          </div>
          <button className="m-restart" disabled={!editable} onClick={onRestart}>
            <RotateCcw size={15} aria-hidden="true" /> Restart mission
          </button>
        </section>
        {children}
      </div>
    </div>
  );
}
