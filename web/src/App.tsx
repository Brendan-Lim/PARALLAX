import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { demoMode } from './mission/demoProfile';
import { evaluationMode } from './evaluation';
import { workspacePages, type WorkspacePage } from './workspace/pages';
const Discover = lazy(() => import('./site/Discover').then((m) => ({ default: m.Discover })));
const Workspace = lazy(() =>
  import('./workspace/Workspace').then((m) => ({ default: m.Workspace })),
);
const Mission = lazy(() => import('./mission/Mission'));
const Chapters = lazy(() => import('./mission/MissionChapters'));
const Companion = lazy(() => import('./monitoring/Companion'));
const Research = lazy(() => import('./site/Research').then((m) => ({ default: m.Research })));
const GuidedRunner = lazy(() => import('./site/Guided').then((m) => ({ default: m.GuidedRunner })));
const ScenarioIndex = lazy(() =>
  import('./site/Guided').then((m) => ({ default: m.ScenarioIndex })),
);
import { stepCount } from './site/guidedState';
import {
  decodeGuided,
  encodeGuided,
  freshGuidedCase,
  guidedKey,
  scenarioBySlug,
  workspaceIsDefault,
  workspaceSessionFrom,
  type GuidedCase,
  type GuidedStore,
  type ScenarioKey,
} from './site/guidedState';
import { encodeSession, storageKey } from './core/session';
import './site/site.css';

type SitePage = 'mission' | 'discover' | 'scenarios' | 'research';
type Route =
  | {
      area: 'site';
      page: SitePage;
      slug?: string;
      step?: number;
      sessionId?: string;
      runId?: string;
    }
  | { area: 'workspace'; page: WorkspacePage };

function parseRoute(hash: string): Route {
  const [head, slug, step, runId] = hash.replace(/^#/, '').split('/');
  if (workspacePages.includes(head as WorkspacePage))
    return { area: 'workspace', page: head as WorkspacePage };
  // The scored evaluation condition never shows the guided site or its teaching material.
  if (evaluationMode) return { area: 'workspace', page: 'monitor' };
  if (head === 'mission')
    return {
      area: 'site',
      page: 'mission',
      slug: ['health', 'monitoring', 'companion', 'preflight', 'transit', 'surface'].includes(slug)
        ? slug
        : undefined,
      sessionId: step,
      runId,
    };
  if (head === 'discover') return { area: 'site', page: 'discover' };
  if (head === 'research') return { area: 'site', page: 'research' };
  if (head === 'scenarios') {
    const scenario = slug ? scenarioBySlug(slug) : undefined;
    if (!scenario) return { area: 'site', page: 'scenarios' };
    const n = Number(step);
    return {
      area: 'site',
      page: 'scenarios',
      slug: scenario.slug,
      step: Number.isInteger(n) && n >= 1 && n <= stepCount ? n : 1,
    };
  }
  return { area: 'site', page: 'mission' };
}

function readGuided(): { store: GuidedStore; storage: boolean } {
  try {
    return { store: decodeGuided(localStorage.getItem(guidedKey)), storage: true };
  } catch {
    return { store: decodeGuided(null), storage: false };
  }
}

export default function App() {
  const [route, setRoute] = useState<Route>(() => parseRoute(location.hash));
  const [guided, setGuided] = useState<GuidedStore>(() => readGuided().store);
  const initialGuided = useRef(guided);
  const [online, setOnline] = useState(navigator.onLine);
  const [offlineReady, setOfflineReady] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [pendingTransfer, setPendingTransfer] = useState<ScenarioKey | null>(null);
  const confirm = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const sync = () => setRoute(parseRoute(location.hash));
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  useEffect(() => {
    // Opening a mission or evaluation must not normalise or overwrite an unrelated guided store.
    if (guided === initialGuided.current) return;
    try {
      localStorage.setItem(guidedKey, encodeGuided(guided));
    } catch {
      /* Guided cases continue in memory when storage is unavailable. */
    }
  }, [guided]);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then(async (reg) => {
          await navigator.serviceWorker.ready;
          if (reg.active) setOfflineReady(true);
          const worker = reg.installing ?? reg.waiting;
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'activated') setOfflineReady(true);
          });
        })
        .catch(() => setOfflineReady(false));
    }
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  // Focus the new page heading so keyboard and screen-reader users start at the new content.
  const pageKey =
    route.area === 'site' && (!route.slug || route.page === 'mission')
      ? `${route.page}/${route.slug ?? ''}`
      : '';
  useEffect(() => {
    if (!pageKey || (route.area === 'site' && route.page === 'mission')) return;
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (document.activeElement && document.activeElement !== document.body)
      document.querySelector<HTMLElement>('main h1')?.focus({ preventScroll: true });
  }, [pageKey, route.area, route.page]);

  const go = (hash: string) => {
    if (location.hash === '#' + hash) setRoute(parseRoute('#' + hash));
    else location.hash = hash;
  };
  const announce = useCallback((message: string) => {
    setAnnouncement('');
    requestAnimationFrame(() => setAnnouncement(message));
  }, []);

  const updateCase = (key: ScenarioKey, next: GuidedCase) =>
    setGuided((g) => ({ ...g, cases: { ...g.cases, [key]: next } }));
  const restart = (key: ScenarioKey) => {
    setGuided((g) => ({
      cases: { ...g.cases, [key]: undefined },
      completed: g.completed.filter((k) => k !== key),
    }));
    announce('Scenario restarted with its original fictional records.');
  };

  function transfer(key: ScenarioKey) {
    let raw: string | null;
    try {
      raw = localStorage.getItem(storageKey);
    } catch {
      raw = null;
    }
    if (workspaceIsDefault(raw)) completeTransfer(key);
    else {
      setPendingTransfer(key);
      confirm.current?.showModal();
    }
  }
  function completeTransfer(key: ScenarioKey) {
    const c = guided.cases[key] ?? freshGuidedCase(key);
    try {
      localStorage.setItem(storageKey, encodeSession(workspaceSessionFrom(key, c)));
    } catch {
      /* The workspace reports storage failures itself. */
    }
    confirm.current?.close();
    setPendingTransfer(null);
    go('monitor');
  }

  if (route.area === 'workspace')
    return (
      <Suspense fallback={<p role="status">Opening workspace…</p>}>
        <Workspace
          key={route.area}
          page={route.page}
          onPage={(page) => {
            history.replaceState(null, '', '#' + page);
            setRoute({ area: 'workspace', page });
          }}
          online={online}
          offlineReady={offlineReady}
          onSite={() => go('discover')}
        />
      </Suspense>
    );

  const scenario =
    route.page === 'scenarios' && route.slug ? scenarioBySlug(route.slug) : undefined;
  return (
    <div className="site site-mission">
      <a
        className="s-skip"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main')?.focus();
        }}
      >
        Skip to main content
      </a>
      <header className="s-header">
        <div className="s-header-inner s-wrap">
          <a className="s-brand" href="#mission" aria-label="PARALLAX home">
            <img src="/mark.svg" alt="" width="24" height="24" />
            PARALLAX
          </a>
          <nav aria-label="Main">
            {(
              [
                ['mission', 'Mission'],
                ['scenarios', 'Scenarios'],
                ['research', 'Research'],
              ] as const
            ).map(([id, label]) => (
              <a key={id} href={`#${id}`} aria-current={route.page === id ? 'page' : undefined}>
                {label}
              </a>
            ))}
          </nav>
          {route.page !== 'scenarios' && route.page !== 'mission' && (
            <a className="s-button s-small" href="#scenarios">
              Explore scenarios
            </a>
          )}
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        <Suspense
          fallback={
            <p className="s-wrap" role="status">
              Opening review…
            </p>
          }
        >
          {route.page === 'mission' &&
            (!demoMode && ['preflight', 'transit', 'surface'].includes(route.slug ?? '') ? (
              <Chapters
                phase={route.slug as 'preflight' | 'transit' | 'surface'}
                navigation={route}
              />
            ) : route.slug === 'companion' ? (
              <Companion key={route.sessionId} sessionId={route.sessionId} runId={route.runId} />
            ) : (
              <Mission
                navigation={route}
                chapter={
                  demoMode && ['preflight', 'transit', 'surface'].includes(route.slug ?? '')
                    ? (route.slug as 'preflight' | 'transit' | 'surface')
                    : undefined
                }
                health={route.slug === 'health' || route.slug === 'monitoring'}
                monitoring={route.slug === 'monitoring'}
                section={route.slug === 'health' ? route.sessionId : undefined}
                onNavigate={go}
              />
            ))}
          {route.page === 'discover' && <Discover />}
          {route.page === 'research' && <Research onScenarios={() => go('scenarios')} />}
          {route.page === 'scenarios' && !scenario && (
            <ScenarioIndex store={guided} onRestart={restart} />
          )}
          {route.page === 'scenarios' && scenario && (
            <GuidedRunner
              key={scenario.key}
              scenario={scenario}
              state={guided.cases[scenario.key] ?? freshGuidedCase(scenario.key)}
              step={route.step ?? 1}
              completed={guided.completed.includes(scenario.key)}
              onStep={(n) => {
                const c = guided.cases[scenario.key] ?? freshGuidedCase(scenario.key);
                updateCase(scenario.key, { ...c, reached: Math.max(c.reached, n) });
                go(`scenarios/${scenario.slug}/${n}`);
              }}
              onChange={(next) => updateCase(scenario.key, next)}
              onRestart={() => {
                restart(scenario.key);
                go(`scenarios/${scenario.slug}/1`);
              }}
              onFinish={() => {
                setGuided((g) => ({
                  ...g,
                  completed: g.completed.includes(scenario.key)
                    ? g.completed
                    : [...g.completed, scenario.key],
                }));
                announce(`${scenario.title} completed.`);
                go('scenarios');
              }}
              onTransfer={() => transfer(scenario.key)}
              announce={announce}
            />
          )}
        </Suspense>
      </main>
      {scenario ? (
        <footer className="s-footer s-footer-slim">
          <div className="s-wrap">
            <p>
              Research and education prototype with fictional records. No diagnosis, treatment or
              medical clearance. Not endorsed by NASA.
            </p>
          </div>
        </footer>
      ) : (
        <footer className="s-footer">
          <div className="s-wrap s-footer-grid">
            <div>
              <p className="s-footer-brand">PARALLAX</p>
              <p>
                Research and education prototype. Individual records are fictional. No diagnosis,
                treatment or medical clearance. Not endorsed by NASA.
              </p>
              <a className="s-link s-on-dark-link" href="#monitor">
                Advanced workspace <ArrowRight size={15} aria-hidden="true" />
              </a>
              <p>
                <a href="#discover">Guided introduction</a> ·{' '}
                <a href="#scenarios">Educational scenarios</a>
              </p>
            </div>
            <div>
              <p className="s-footer-head">Challenge</p>
              <p>
                <a
                  href="https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/"
                  target="_blank"
                  rel="noreferrer"
                >
                  2026 NASA Space Apps Challenge: Create Health Monitoring Software for Astronauts
                  on Space Missions <ArrowUpRight size={13} aria-hidden="true" />
                </a>
              </p>
              <p className="s-footer-head">Science</p>
              <p>
                Mulavara et al. (2018),{' '}
                <a
                  href="https://pmc.ncbi.nlm.nih.gov/articles/PMC6133205/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Physiological and Functional Alterations after Spaceflight and Bed Rest
                </a>
                . Full source list on the Research page.
              </p>
            </div>
            <div>
              <p className="s-footer-head">Visuals</p>
              <p>
                Original AI-generated habitat and equipment illustrations; no real people or agency
                photographs are shown in this public source edition. The procedural Mars
                illustration is also original and is not an acquired planetary image.
              </p>
              <details className="s-notices">
                <summary>Project status, licences and AI assistance</summary>
                <p>
                  Local research and education prototype. NASA has not adopted, endorsed or
                  clinically validated PARALLAX. Pilot N = 0; scored evaluation N = 0.
                </p>
                <p>
                  AI assisted engineering, text, fictional examples and evaluation design. No AI
                  service processes observations or decides findings.
                </p>
                <p>
                  Original software is Apache-2.0. Third-party rights remain separate.{' '}
                  <a href="/third-party-notices.txt">Licence notices</a> ·{' '}
                  <a href="/evaluation.txt">Software verification record</a>
                </p>
                <p>
                  {online
                    ? offlineReady
                      ? 'Offline cache ready in this browser.'
                      : 'Preparing offline use.'
                    : 'Offline session.'}
                </p>
              </details>
            </div>
          </div>
        </footer>
      )}
      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>
      <dialog ref={confirm} className="s-dialog" aria-labelledby="transfer-title">
        <h2 id="transfer-title">Replace the workspace review?</h2>
        <p>
          The advanced workspace already holds a review. Continuing replaces it with this scenario’s
          records. Download that review first if you want to keep it.
        </p>
        <div className="s-dialog-actions">
          <button
            className="s-button s-secondary"
            onClick={() => {
              confirm.current?.close();
              setPendingTransfer(null);
            }}
          >
            Keep the current review
          </button>
          <button
            className="s-button"
            onClick={() => pendingTransfer && completeTransfer(pendingTransfer)}
          >
            Replace and continue
          </button>
        </div>
      </dialog>
    </div>
  );
}
