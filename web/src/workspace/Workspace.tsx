import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCheck,
  ChevronDown,
  CircleHelp,
  Download,
  FileCheck2,
  Fingerprint,
  FlaskConical,
  Focus,
  Layers3,
  Link2,
  ListFilter,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  Upload,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { evaluate, formatNumber, signed } from '../core/engine';
import {
  trackedMeasures,
  measures,
  statusLabels,
  type CasePacket,
  type Finding,
  type Measure,
} from '../core/model';
import { missionContext } from '../core/context';
import { parseImport } from '../core/validate';
import {
  initialSession,
  decodeSession,
  encodeSession,
  storageKey,
  type Session,
} from '../core/session';
import { reviewMarkdown } from '../core/review';
import { cases, freshCase } from '../data/cases';

import { ContextBar, Assessment, ActionCard, ExistingPlan } from '../components/Monitoring';
import { Research } from '../site/Research';
import { evaluationMode } from '../evaluation';
import { SourceRecords } from '../components/SourceRecords';
import { ReviewHandoff } from '../components/ReviewHandoff';
import { handoffSummary } from '../components/handoffSummary';
import { ObservationEntry } from '../components/ObservationEntry';
import { featuredScenarios, featuredScenarioFor, obtainedTaskSuggestion } from '../data/scenarios';
import { healthActions, type HealthAction, type ActionState } from '../core/actions';

import type { WorkspacePage } from './pages';
type Page = WorkspacePage;
const navItems: { id: Page; name: string; icon: typeof Focus }[] = [
  { id: 'monitor', name: 'Health Monitor', icon: Activity },
  { id: 'lens', name: 'Evidence Lens', icon: Focus },
  { id: 'observations', name: 'Observations', icon: Activity },
  { id: 'review', name: 'Health Actions', icon: FileCheck2 },
  { id: 'science', name: 'Science & sources', icon: BookOpen },
];
const icons = {
  force: Layers3,
  cardio: Activity,
  tandem: ScanLine,
  task: ArrowUpRight,
  hr: Activity,
  map: Activity,
};
function Badge({ status, compact = false }: { status: Finding['status']; compact?: boolean }) {
  return (
    <span className={`status status-${status}`}>
      <span className="status-dot" />
      {compact && status === 'supported' ? 'Directly supported' : statusLabels[status]}
    </span>
  );
}
function download(name: string, data: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function useLocalState() {
  const [loaded] = useState(() => {
    try {
      return decodeSession(localStorage.getItem(storageKey));
    } catch {
      return {
        ...decodeSession(null),
        notice: 'Browser storage is unavailable. This session will remain in memory.',
      };
    }
  });
  const [session, setSession] = useState<Session>(loaded.session);
  const [notice, setNotice] = useState(loaded.notice);
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, encodeSession(session));
    } catch {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Surface an external storage failure; notice is not an effect dependency.
      setNotice('This browser could not save the demonstration. Current changes remain in memory.');
    }
  }, [session]);
  return { session, setSession, notice, setNotice };
}

export function Workspace({
  page,
  onPage,
  online,
  offlineReady,
  onSite,
}: {
  page: Page;
  onPage: (page: Page) => void;
  online: boolean;
  offlineReady: boolean;
  onSite: () => void;
}) {
  const { session, setSession, notice, setNotice } = useLocalState();
  const { packet, unavailable, marked, note } = session;
  function setPage(next: Page) {
    onPage(next);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  // A featured case defaults to its scenario measure after a reload or a transfer.
  const investigationMeasure: Finding['id'] | undefined = featuredScenarios.find(
    (s) => s.id === packet.case.id,
  )?.measure;
  const [selected, setSelected] = useState<Finding['id']>(
    () => investigationMeasure ?? (packet.context?.kind === 'inflight-demo' ? 'hr' : 'task'),
  );
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const [announce, setAnnounce] = useState('');
  const [entry, setEntry] = useState<Measure | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const entryTrigger = useRef<HTMLElement | null>(null);
  const findings = useMemo(() => evaluate(packet, unavailable), [packet, unavailable]);
  const actions = useMemo(
    () => healthActions(packet, unavailable, session.missionPhase),
    [packet, unavailable, session.missionPhase],
  );
  const activeKeys =
    packet.context?.kind === 'inflight-demo'
      ? trackedMeasures(packet).filter((key) =>
          packet.observations.some((r) => r.measurement === key),
        )
      : trackedMeasures(packet);
  const finding = findings.find((f) => f.id === selected)!;
  // Health Actions and its handoff describe the deliberately selected finding.
  const report = useMemo(
    () => reviewMarkdown(packet, unavailable, marked, note, undefined, { ...session, selected }),
    [packet, unavailable, marked, note, session, selected],
  );

  function focusUpdatedFinding() {
    requestAnimationFrame(() => {
      const target =
        document.getElementById('updated-finding') ??
        document.querySelector<HTMLElement>('.assessment');
      if (!target) return;
      target.focus({ preventScroll: true });
      const bounds = target.getBoundingClientRect();
      if (bounds.top < 120 || bounds.bottom > window.innerHeight)
        target.scrollIntoView({ block: 'center', behavior: 'instant' });
    });
  }
  function undoEntry() {
    setSession((s) =>
      s.undo ? { ...s, packet: s.undo.packet, unavailable: s.undo.unavailable, undo: null } : s,
    );
    setAnnounce(
      'Previous observations restored. The finding and review handoff now use the previous evidence.',
    );
    focusUpdatedFinding();
  }
  const renderHandoff = (markdown: string) => (
    <ReviewHandoff
      note={note}
      onNote={(value) => setSession((s) => ({ ...s, note: value }))}
      report={markdown}
      onDownload={() => download(`PARALLAX-${packet.case.id}-review.md`, markdown, 'text/markdown')}
      contents={handoffSummary(markdown)}
    />
  );
  const undoControl = session.undo ? (
    <button className="button secondary" onClick={undoEntry}>
      Undo observation entry
    </button>
  ) : undefined;
  function load(p: CasePacket) {
    setSession({
      ...initialSession(),
      packet: p,
      missionPhase: p.context?.kind === 'inflight-demo' ? 'inflight' : 'transition',
    });
    setSelected(
      featuredScenarios.find((s) => s.id === p.case.id)?.measure ??
        (p.context?.kind === 'inflight-demo' ? 'hr' : 'task'),
    );
    setAnnounce('Synthetic records loaded. All records are fictional.');
  }
  function toggle(ids: string[]) {
    if (!ids.length) return;
    const hide = ids.some((id) => !unavailable.includes(id));
    setSession((s) => ({
      ...s,
      unavailable: hide
        ? [...new Set([...s.unavailable, ...ids])]
        : s.unavailable.filter((id) => !ids.includes(id)),
    }));
    setAnnounce(
      hide
        ? 'Observation availability changed. Claims have been re-evaluated; original records are retained.'
        : 'Observations restored. Claims have been re-evaluated.',
    );
  }
  function mark(id: string) {
    setSession((s) => ({
      ...s,
      marked: s.marked.includes(id) ? s.marked.filter((v) => v !== id) : [...s.marked, id],
    }));
  }
  function applyImport() {
    try {
      load(parseImport(importText));
      setImportError('');
      dialog.current?.close();
      setPage('lens');
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Could not read this demonstration.');
    }
  }
  function showImport() {
    setImportText('');
    setImportError('');
    dialog.current?.showModal();
  }
  function reviewAction(action: HealthAction, state: ActionState) {
    setSession((s) => ({
      ...s,
      receipts: { ...s.receipts, [action.id]: { signature: action.signature, state } },
    }));
    setAnnounce('Review state saved locally. Evidence support has not changed.');
  }
  function openAction(action: HealthAction) {
    if (action.target === 'entry') {
      setEntry(action.findingIds[0] as Measure);
      return;
    }
    if (action.target === 'plan') {
      setPage('review');
      setTimeout(() => document.getElementById('existing-plan')?.focus(), 0);
      return;
    }
    setSelected(action.findingIds[action.findingIds.length - 1]);
    setPage('lens');
  }

  return (
    <div
      onClickCapture={() => {
        if (!entry) entryTrigger.current = document.activeElement as HTMLElement;
      }}
      className={`app-shell ${evaluationMode ? 'evaluation-mode' : ''} mode-monitor`}
    >
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <aside className="sidebar" aria-label="Application navigation">
        <a
          href={evaluationMode ? '#monitor' : '#discover'}
          onClick={(e) => {
            e.preventDefault();
            if (evaluationMode) setPage('monitor');
            else onSite();
          }}
          className="brand"
          aria-label={evaluationMode ? 'PARALLAX workspace' : 'PARALLAX home'}
        >
          <img src="/mark.svg" alt="" />
          <span>
            PARALLAX<span className="brand-sub">SEE BEYOND THE VITALS</span>
          </span>
        </a>
        <div className="sidebar-section mono">
          WORKSPACE <span>01</span>
        </div>
        <nav>
          {navItems.map(({ id, name, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${page === id ? 'active' : ''}`}
              aria-label={name}
              onClick={() => setPage(id)}
              aria-current={page === id ? 'page' : undefined}
            >
              <Icon size={18} />
              <span>{name}</span>
              {page === id && <span className="nav-indicator" />}
              {id === 'review' && marked.length > 0 && (
                <span className="count" aria-hidden="true">
                  {marked.length}
                </span>
              )}
            </button>
          ))}
        </nav>
        {!evaluationMode && (
          <div className="sidebar-note">
            <p>Advanced workspace</p>
            <a className="text-link" href="#discover">
              Back to the guided site <ArrowRight size={14} />
            </a>
          </div>
        )}
        <div className="sidebar-bottom">
          <div>
            <span className="small-dot" /> LOCAL PROCESSING
          </div>
          <p>
            Monitoring prototype <span>v0.5.0-rc.1</span>
          </p>
          <button className="text-link muted" onClick={() => setPage('science')}>
            <CircleHelp size={14} /> Scope & limitations
          </button>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            {evaluationMode ? 'Astronaut health' : 'Advanced workspace'} <span>/</span>{' '}
            <strong>{navItems.find((n) => n.id === page)?.name}</strong>
          </div>
          <div className="topbar-right">
            <span className="connection">
              {online ? <Wifi size={14} /> : <WifiOff size={14} />}
              {online
                ? offlineReady
                  ? 'Offline cache ready'
                  : 'Local session'
                : 'Offline session'}
            </span>
            <span className="prototype-label">RESEARCH PROTOTYPE</span>
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          {notice && (
            <div className="notice" role="alert">
              {notice}
              <button aria-label="Dismiss notice" onClick={() => setNotice('')}>
                <X size={16} />
              </button>
            </div>
          )}
          {
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow mono">EVIDENCE-AWARE ASTRONAUT HEALTH MONITORING</div>
                  <h1>
                    {page === 'monitor'
                      ? 'Review the observations. Check the evidence.'
                      : page === 'lens'
                        ? 'Trace each conclusion to its evidence.'
                        : page === 'observations'
                          ? 'Start with what was measured.'
                          : page === 'review'
                            ? 'Prepare the next medical review.'
                            : 'Evidence, with its boundaries.'}
                  </h1>
                  <p>
                    {page === 'monitor'
                      ? 'Inspect recorded changes and the evidence each conclusion needs. All individual records are fictional.'
                      : page === 'lens'
                        ? 'Trace what each observation supports. See what remains unknown.'
                        : page === 'observations'
                          ? 'The same observations, with their units, provenance and quality limits.'
                          : page === 'review'
                            ? 'Keep unresolved questions, existing plan records and observations together for qualified review.'
                            : 'NASA research informs the questions. Direct observations support the findings.'}
                  </p>
                </div>
                <button className="button secondary" onClick={showImport}>
                  <Upload size={16} /> Import fictional observations
                </button>
              </div>

              {(page === 'lens' || page === 'review') && (
                <p className="active-review-name">
                  {featuredScenarioFor(packet, unavailable)?.title ?? 'Current evidence review'} ·
                  fictional observations
                </p>
              )}
              <div
                className={`workspace-configuration ${page === 'science' ? 'science-configuration' : ''}`}
              >
                <details>
                  <summary>
                    Additional examples for source inspection{' '}
                    <span>{missionContext(packet, session.missionPhase).identity}</span>
                  </summary>
                  <section className="casebar" aria-label="Demonstration case">
                    <div className="case-icon">
                      <FlaskConical size={19} />
                    </div>
                    <div className="case-select">
                      <label htmlFor="case-select" className="mono">
                        SYNTHETIC DEMONSTRATION
                      </label>
                      <div>
                        <select
                          id="case-select"
                          value={packet.case.id}
                          onChange={(e) => load(freshCase(e.target.value))}
                        >
                          {cases.map((p, i) => (
                            <option
                              value={p.case.id}
                              key={p.case.id}
                            >{`0${i + 1} — ${p.case.title}`}</option>
                          ))}
                          {!cases.some((p) => p.case.id === packet.case.id) && (
                            <option value={packet.case.id}>Imported — {packet.case.title}</option>
                          )}
                        </select>
                        <ChevronDown size={14} aria-hidden="true" />
                      </div>
                    </div>
                    <div className="case-context">
                      <span>REFERENCE → FOLLOW-UP</span>
                      <strong>Recorded session comparison</strong>
                    </div>
                    <span className="pill">Fictional observations</span>
                  </section>
                  <p className="footnote mono">Fixture identifier: {packet.case.id}</p>
                </details>
                <details className="mission-context-settings">
                  <summary>Mission review context</summary>
                  <ContextBar
                    packet={packet}
                    phase={session.missionPhase}
                    onChange={(missionPhase) => setSession((s) => ({ ...s, missionPhase }))}
                  />
                </details>
              </div>

              {page === 'monitor' && (
                <div className="monitor-toolbar">
                  <span className="mono">MONITOR → ASSESS → UNDERSTAND → ACT → REASSESS</span>
                  <div>
                    <button
                      className="button primary"
                      onClick={() =>
                        setEntry(
                          selected === 'overall' || selected === 'clearance' ? 'task' : selected,
                        )
                      }
                    >
                      Add / update demo observation
                    </button>
                    {undoControl}
                    <button
                      className="text-link"
                      onClick={() => {
                        load(freshCase(packet.case.id));
                        setAnnounce('Demonstration reset to the original fictional source case.');
                      }}
                    >
                      Reset demonstration
                    </button>
                  </div>
                </div>
              )}

              {(page === 'monitor' || page === 'observations') && (
                <details className="comparison-overview" open>
                  <summary>All recorded measurements</summary>
                  <div className="section-label">
                    <h2>What changed?</h2>
                    <span>Recorded differences · no clinical thresholds</span>
                  </div>
                  <div className={`metrics ${activeKeys.length === 1 ? 'single-measure' : ''}`}>
                    {activeKeys.map((key) => (
                      <Metric
                        key={key}
                        measure={key}
                        finding={findings.find((f) => f.id === key)!}
                        packet={packet}
                        unavailable={unavailable}
                        selected={selected === key}
                        onClick={() => {
                          setSelected(key);
                          if (page === 'monitor') {
                            document
                              .querySelector<HTMLDetailsElement>('.further-assessment')
                              ?.setAttribute('open', '');
                            setTimeout(
                              () =>
                                document
                                  .querySelector('.assessment')
                                  ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }),
                              0,
                            );
                          }
                        }}
                      />
                    ))}
                  </div>
                </details>
              )}

              {page === 'monitor' && packet.context?.kind === 'inflight-demo' && (
                <section
                  className="panel flight-workflow"
                  aria-label="In-flight monitoring workflow"
                >
                  <div className="eyebrow mono">FICTIONAL IN-FLIGHT MONITORING</div>
                  <h2>Review an existing cycling observation</h2>
                  <p>
                    125 → 140 bpm during two already authorised fictional sessions. These invented
                    readings and the recorded 100 W workload are neither exercise targets nor
                    clinical thresholds.
                  </p>
                  <details>
                    <summary>Follow the existing plan, verify and preserve a review</summary>{' '}
                    <ol>
                      <li>Review the existing fictional plan in Health Actions.</li>
                      <li>
                        Inspect heart rate and its recorded workload, timing and device below.
                      </li>
                      <li>
                        Use “Add / update” to verify an already obtained result. Change its recorded
                        workload to inspect an incompatible comparison, then undo or reset.
                      </li>
                      <li>
                        Trace the finding, read NASA education, record prescribed activity
                        completion and preserve a question for qualified review.
                      </li>
                      <li>
                        Download the current review locally, including during a cached offline
                        session. Nothing is transmitted.
                      </li>
                    </ol>{' '}
                  </details>
                  <p className="footnote">
                    Exercise HR records a specific session response. Fitness, function and readiness
                    remain unanswered. NASA equipment context and measurement limits appear below.
                  </p>
                  <button className="text-link" onClick={() => setPage('review')}>
                    Review plan, activity & handoff <ArrowRight size={14} />
                  </button>
                </section>
              )}

              {page === 'monitor' && (
                <>
                  <details className="further-assessment" open>
                    <summary>Detailed assessment and review actions</summary>
                    <div className="monitor-detail-layout">
                      <Assessment
                        packet={packet}
                        finding={finding}
                        phase={session.missionPhase}
                        onEvidence={() => setPage('lens')}
                        onAction={() => setPage('review')}
                      />
                      <aside className="monitor-next">
                        <div className="section-label">
                          <h2>Next review step</h2>
                          <button className="text-link" onClick={() => setPage('review')}>
                            All actions <ArrowRight size={14} />
                          </button>
                        </div>
                        <ActionCard
                          action={
                            actions.find((a) => a.findingIds.includes(finding.id)) ?? actions[0]
                          }
                          receipts={session.receipts}
                          onState={reviewAction}
                          onOpen={openAction}
                        />
                        <p className="footnote">
                          Action states track review only. For an actual suspected emergency, use
                          established mission emergency procedures and qualified medical support.
                        </p>
                      </aside>
                    </div>
                  </details>
                </>
              )}

              {page === 'lens' && (
                <>
                  <div className="evidence-layout">
                    <section className="lens-panel panel" aria-label="Evidence Lens">
                      <div className="panel-heading">
                        <div>
                          <div className="eyebrow mono">THE EVIDENCE LENS</div>
                          <h2>
                            How each claim
                            <br />
                            <span>gets its support.</span>
                          </h2>
                        </div>
                        <div className="lens-glyph" aria-hidden="true">
                          <Focus size={33} strokeWidth={1} />
                        </div>
                      </div>
                      <p className="panel-intro">
                        Change which follow-up observations are available. Watch the support for
                        each finding change.
                      </p>
                      <div className="experiment-note">
                        <FlaskConical size={15} />
                        <span>
                          Simulated availability experiment. Source records are preserved.
                        </span>
                      </div>
                      <div className="map-labels mono">
                        <span>AVAILABLE FOLLOW-UP</span>
                        <span>CLAIM-SPECIFIC SUPPORT</span>
                      </div>
                      <div className="evidence-map">
                        {activeKeys.map((key, i) => {
                          const f = findings.find((v) => v.id === key)!;
                          const records = packet.observations.filter(
                            (r) =>
                              r.measurement === key &&
                              r.phase === 'followup' &&
                              r.form === 'direct',
                          );
                          const enabled =
                            records.length > 0 && records.every((r) => !unavailable.includes(r.id));
                          const copies = packet.observations.filter(
                            (r) => r.measurement === key && r.form === 'derived',
                          ).length;
                          const Icon = icons[key];
                          return (
                            <div className={`map-row ${f.status}`} key={key}>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={enabled}
                                aria-label={`Use ${measures[key].short.toLowerCase()} follow-up`}
                                disabled={!records.length}
                                onClick={() => {
                                  toggle(records.map((r) => r.id));
                                  setSelected(key);
                                }}
                                className={`observation-node ${enabled ? '' : 'dimmed'}`}
                              >
                                <Icon size={17} />
                                <div>
                                  <strong>{measures[key].short}</strong>
                                  <span>
                                    {records.length
                                      ? enabled
                                        ? 'Follow-up available'
                                        : 'Simulated unavailable'
                                      : 'Follow-up not recorded'}
                                  </span>
                                  {copies > 0 && (
                                    <em className="dependent-note">
                                      {copies} dependent {copies === 1 ? 'copy' : 'copies'} · not
                                      counted
                                    </em>
                                  )}
                                </div>
                                <span className="switch" aria-hidden="true" data-checked={enabled}>
                                  <span />
                                </span>
                              </button>
                              <div className="evidence-edge" aria-hidden="true">
                                <svg viewBox="0 0 64 32">
                                  <path
                                    d="M0 16H64"
                                    strokeDasharray={f.status === 'supported' ? undefined : '3 4'}
                                  />
                                  <circle cx="32" cy="16" r="4" />
                                </svg>
                              </div>
                              <button
                                className={`claim-node ${selected === key ? 'selected' : ''}`}
                                onClick={() => setSelected(key)}
                                data-testid={`claim-${key}`}
                              >
                                <span className="claim-no mono">0{i + 1}</span>
                                <span>
                                  <strong>
                                    {key === 'task'
                                      ? 'Task completion change'
                                      : `${measures[key].short} change`}
                                  </strong>
                                  <Badge status={f.status} compact />
                                </span>
                                <ArrowUpRight size={15} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                      <div className="lens-current-finding" aria-live="polite">
                        <strong>
                          {finding.title}: {statusLabels[finding.status]}
                        </strong>
                      </div>
                      <div className="lens-action-link">
                        <button className="text-link" onClick={() => setPage('review')}>
                          Use these findings in Health Actions <ArrowRight size={15} />
                        </button>
                        <button
                          className="text-link"
                          onClick={() =>
                            setEntry(
                              selected === 'overall' || selected === 'clearance'
                                ? 'task'
                                : selected,
                            )
                          }
                        >
                          Add an existing demo result
                        </button>
                      </div>
                      <div className="scope-boundary">
                        <div>
                          <ShieldCheck size={17} />
                          <strong>A measured change has a boundary.</strong>
                        </div>
                        <p>
                          Even with all available comparisons, broader conclusions remain outside
                          scope.
                        </p>
                        {findings
                          .filter((f) => f.status === 'outside')
                          .map((f) => (
                            <button
                              key={f.id}
                              onClick={() => setSelected(f.id)}
                              className={selected === f.id ? 'selected-scope' : ''}
                            >
                              <span>{f.title}</span>
                              <span>
                                Outside scope <ArrowUpRight size={13} />
                              </span>
                            </button>
                          ))}
                      </div>
                      {unavailable.length > 0 && (
                        <button
                          className="text-link restore"
                          onClick={() => {
                            setSession((s) => ({ ...s, unavailable: [] }));
                            setAnnounce('All original observations restored.');
                          }}
                        >
                          <RotateCcw size={14} /> Restore all observations
                        </button>
                      )}
                    </section>
                    <Inspector
                      finding={finding}
                      packet={packet}
                      marked={marked.includes(finding.id)}
                      onMark={() => mark(finding.id)}
                      unavailable={unavailable}
                      onToggle={(id) => toggle([id])}
                      onSource={() => setPage('science')}
                      nextAction={actions.find((a) => a.findingIds.includes(finding.id))}
                      onAction={() => setPage('review')}
                    />
                  </div>
                  <section className="insight-strip">
                    <div className="insight-icon">
                      <Link2 size={21} />
                    </div>
                    <div>
                      <strong>Association is context. Observation is evidence.</strong>
                      <p>
                        NASA research connects physiological domains to functional tasks. A
                        published relationship cannot fill an individual measurement gap.
                      </p>
                    </div>
                    <button className="text-link" onClick={() => setPage('science')}>
                      Read the research context <ArrowRight size={15} />
                    </button>
                  </section>
                  {!evaluationMode && (
                    <details className="reasoning-examples">
                      <summary>Additional evidence examples</summary>
                      <span className="eyebrow mono">INVESTIGATE A BOUNDARY</span>
                      <button
                        onClick={() => {
                          load(freshCase('DEMO-03'));
                          setSelected('task');
                        }}
                      >
                        Two values, incompatible protocols <ArrowRight size={14} />
                      </button>
                      <button
                        onClick={() => {
                          load(freshCase('DEMO-02'));
                          setSelected('task');
                        }}
                      >
                        A publication cannot fill a gap <ArrowRight size={14} />
                      </button>
                      <button
                        onClick={() => {
                          load(freshCase('DEMO-04'));
                          setSelected('force');
                        }}
                      >
                        A derived copy is not independent <ArrowRight size={14} />
                      </button>
                      <p>
                        Loading an example resets this synthetic review session. Imported records
                        can be exported first.
                      </p>
                    </details>
                  )}
                </>
              )}

              {page === 'observations' && (
                <section className="panel observation-page">
                  <div className="panel-heading">
                    <div>
                      <div className="eyebrow mono">CONVENTIONAL MONITORING VIEW</div>
                      <h2>Observations & provenance</h2>
                    </div>
                    <ListFilter size={21} />
                  </div>
                  <p className="panel-intro">
                    This comparison view shows the same values and honest missing-data and quality
                    indicators. Open Evidence Lens for explicit claim requirements.
                  </p>
                  <p className="table-scroll-cue" id="observation-scroll-hint">
                    Scroll the table sideways to inspect source and quality details.
                  </p>
                  <div
                    className="table-wrap"
                    tabIndex={0}
                    role="region"
                    aria-label="Observation records"
                    aria-describedby="observation-scroll-hint"
                  >
                    <table>
                      <caption className="sr-only">
                        Synthetic observations, session compatibility and provenance
                      </caption>
                      <thead>
                        <tr>
                          <th>Measurement</th>
                          <th>Session</th>
                          <th>Recorded value</th>
                          <th>Availability</th>
                          <th>Source / quality</th>
                        </tr>
                      </thead>
                      <tbody>
                        {packet.observations.map((r) => (
                          <tr
                            key={r.id}
                            className={unavailable.includes(r.id) ? 'unavailable-row' : ''}
                          >
                            <th scope="row">
                              {measures[r.measurement].detail}
                              <span className="table-sub mono">{r.id}</span>
                            </th>
                            <td>
                              {r.phase === 'baseline' ? 'Baseline' : 'Follow-up'}
                              <span className="table-sub">{r.session}</span>
                            </td>
                            <td className="value-cell">
                              {formatNumber(r.value)} <small>{r.unit}</small>
                            </td>
                            <td>
                              {unavailable.includes(r.id) ? 'Simulated unavailable' : 'Available'}
                              <button className="text-link" onClick={() => toggle([r.id])}>
                                {unavailable.includes(r.id) ? 'Restore' : 'Exclude'}
                                <span className="sr-only"> {r.id}</span>
                              </button>
                            </td>
                            <td>
                              {r.form === 'derived'
                                ? 'Derived synthetic record'
                                : 'Direct synthetic record'}
                              <span className="table-sub">
                                {r.protocol} · {r.window}
                              </span>
                              {r.acquisition && (
                                <span className="table-sub">
                                  {r.acquisition.setting} · {r.acquisition.activity} · recorded{' '}
                                  {r.acquisition.workloadWatts} W · {r.acquisition.timing} ·{' '}
                                  {r.acquisition.device}
                                </span>
                              )}
                              <span className="table-sub">
                                Timestamp: {r.timestamp ?? 'unknown'}
                              </span>
                              <span className="table-sub">
                                {r.sourceId} / {r.sourceRecord}
                              </span>
                              {r.issues.map((issue) => (
                                <span key={issue} className="quality-issue">
                                  {issue}
                                </span>
                              ))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {packet.observations.length === 0 && (
                    <p className="empty-state">
                      No observations in this demonstration packet. No zero values have been
                      substituted.
                    </p>
                  )}
                  <p className="footnote">
                    Values in excluded records are retained for source inspection and are not used
                    in current comparisons. Unknown dates remain unknown.
                  </p>
                </section>
              )}

              {page === 'review' && renderHandoff(report)}
              {page === 'review' && (
                <section className="actions-section" aria-label="Evidence-aware health actions">
                  <div className="section-label">
                    <h2>Evidence → appropriate next step</h2>
                    <span>No diagnosis, prescription or urgency score</span>
                  </div>
                  <p className="panel-intro">
                    Actions come from current findings. Acknowledgement never resolves an evidence
                    gap; changed records or review context require a fresh review.
                  </p>
                  <div className="actions-grid">
                    {actions
                      .filter(
                        (action) =>
                          action.category !== 'Informational' ||
                          action.findingIds.some((id) => marked.includes(id)),
                      )
                      .map((action) => (
                        <ActionCard
                          key={action.id}
                          action={action}
                          receipts={session.receipts}
                          onState={reviewAction}
                          onOpen={openAction}
                        />
                      ))}
                  </div>
                  <details className="routine-actions">
                    <summary>Supported comparisons and existing plan</summary>
                    <div className="actions-grid">
                      {actions
                        .filter(
                          (a) =>
                            a.category === 'Informational' &&
                            !a.findingIds.some((id) => marked.includes(id)),
                        )
                        .map((action) => (
                          <ActionCard
                            key={action.id}
                            action={action}
                            receipts={session.receipts}
                            onState={reviewAction}
                            onOpen={openAction}
                          />
                        ))}
                    </div>
                    <ExistingPlan
                      completed={session.planCompleted}
                      onChange={(planCompleted) => setSession((s) => ({ ...s, planCompleted }))}
                    />
                  </details>
                  <p className="footnote">
                    For an actual suspected emergency, follow established mission emergency
                    procedures. This demonstration cannot provide clinical triage.
                  </p>
                </section>
              )}

              {page === 'review' && (
                <div className="review-layout">
                  <details className="panel review-panel">
                    <summary>All findings and review selections</summary>
                    <div className="panel-heading">
                      <div>
                        <div className="eyebrow mono">QUALIFIED REVIEW</div>
                        <h2>
                          What we know.
                          <br />
                          <span>What we still need to ask.</span>
                        </h2>
                      </div>
                      <FileCheck2 size={25} />
                    </div>
                    <div className="review-banner">
                      <FlaskConical size={18} />
                      <span>Synthetic demonstration · no actual NASA participant</span>
                    </div>
                    {findings.map((f) => (
                      <article className="review-finding" key={f.id}>
                        <div>
                          <h3>{f.title}</h3>
                          <Badge status={f.status} compact />
                        </div>
                        <p>{f.explanation}</p>
                        {f.issues.map((issue) => (
                          <p className="quality-issue" key={issue}>
                            {issue}
                          </p>
                        ))}
                        <button
                          className={`text-link ${marked.includes(f.id) ? 'marked' : ''}`}
                          onClick={() => mark(f.id)}
                        >
                          {marked.includes(f.id) ? (
                            <CheckCheck size={15} />
                          ) : (
                            <FileCheck2 size={15} />
                          )}
                          {marked.includes(f.id) ? 'Marked for review' : 'Mark for review'}
                        </button>
                      </article>
                    ))}
                  </details>
                </div>
              )}

              {page === 'science' && (
                <Research
                  onScenarios={evaluationMode ? undefined : () => (location.hash = 'scenarios')}
                />
              )}
            </>
          }
          {entry && (
            <ObservationEntry
              packet={packet}
              phase={session.missionPhase}
              initialMeasure={entry}
              suggestedRecord={
                entry === 'task' ? obtainedTaskSuggestion(packet, unavailable) : undefined
              }
              initialRole={
                findings
                  .find((f) => f.id === entry)
                  ?.requirements.includes('A direct baseline observation')
                  ? 'baseline'
                  : 'followup'
              }
              onClose={() => {
                setEntry(null);
                requestAnimationFrame(() => entryTrigger.current?.focus({ preventScroll: true }));
              }}
              onSave={(next, measurement, role) => {
                setSession((s) => ({
                  ...s,
                  undo: { packet: s.packet, unavailable: s.unavailable },
                  packet: next,
                  unavailable: s.unavailable.filter(
                    (id) =>
                      !next.observations.some(
                        (r) => r.id === id && r.measurement === measurement && r.phase === role,
                      ),
                  ),
                }));
                setSelected(measurement);
                setEntry(null);
                if (page !== 'monitor') setPage('monitor');
                focusUpdatedFinding();
                setAnnounce(
                  'Demonstration observation validated. Health findings, evidence actions and review export reassessed.',
                );
              }}
            />
          )}
          <details className="project-notices">
            <summary>Project status, licences and AI assistance</summary>
            <p>
              Local research and education prototype. NASA has not adopted, endorsed or clinically
              validated PARALLAX. Pilot N = 0; scored evaluation N = 0.
            </p>
            <p>
              AI assisted engineering, text, fictional examples and evaluation design. No AI service
              processes observations or decides findings.
            </p>
            <p>
              Original software is Apache-2.0. Published numerical facts are shown in attributed
              charts; publication figures and participant records are excluded. Third-party rights
              remain separate. <a href="/third-party-notices.txt">Licence notices</a> ·{' '}
              <a href="/evaluation.txt">Software verification record</a>
            </p>
            <p>
              Public release and submission await team authorisation. Competition timing,
              historical-work reuse, audit access and eligibility remain external decisions recorded
              in the team’s release checklist.
            </p>
          </details>
          <footer className="main-footer">
            <span>
              PARALLAX <span className="footer-slash">/</span> See beyond the vitals.
            </span>
            <span>Research & education · No medical clearance · No NASA endorsement</span>
          </footer>
        </main>
      </div>
      <div className="sr-only" role="status" aria-live="polite">
        {announce}
      </div>

      <dialog ref={dialog} aria-labelledby="import-title" className="import-dialog">
        <div className="dialog-heading">
          <div>
            <div className="eyebrow mono">LOCAL DEMONSTRATION IMPORT</div>
            <h2 id="import-title">Import fictional observations.</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Close import"
            onClick={() => dialog.current?.close()}
          >
            <X size={20} />
          </button>
        </div>
        <p>
          Import fictional observations using the validated JSON template. New values update the
          actual comparisons, claims and review summary.
        </p>
        <div className="review-banner">
          <ShieldCheck size={17} />
          <span>Synthetic demonstration data only. Do not enter real health records.</span>
        </div>
        <div className="import-actions">
          <button
            className="button secondary"
            onClick={() =>
              download(
                'parallax-synthetic-template.json',
                JSON.stringify(freshCase(), null, 2),
                'application/json',
              )
            }
          >
            <Download size={15} /> Download template
          </button>
          <label className="button secondary file-label">
            <Upload size={15} /> Choose JSON file
            <input
              aria-label="Choose demonstration JSON file"
              type="file"
              accept=".json,application/json"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  if (file.size > 250_000)
                    throw new Error('File exceeds the 250 KB demonstration import limit.');
                  setImportText(await file.text());
                  setImportError('');
                } catch (error) {
                  setImportError(
                    error instanceof Error ? error.message : 'File could not be read.',
                  );
                }
                e.target.value = '';
              }}
            />
          </label>
        </div>
        <label htmlFor="import-json">Or paste demonstration JSON</label>
        <textarea
          id="import-json"
          spellCheck={false}
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder={'{ "schemaVersion": 1, "origin": "synthetic", … }'}
          maxLength={250001}
        />
        {importError && (
          <div className="import-error" role="alert">
            {importError}
          </div>
        )}
        <div className="dialog-footer">
          <span>Maximum 200 observations · 250 KB</span>
          <button className="button primary" onClick={applyImport}>
            Validate & load <ArrowRight size={16} />
          </button>
        </div>
      </dialog>
    </div>
  );
}

function Metric({
  measure,
  finding,
  packet,
  unavailable,
  selected,
  onClick,
}: {
  measure: Measure;
  finding: Finding;
  packet: CasePacket;
  unavailable: string[];
  selected: boolean;
  onClick: () => void;
}) {
  const spec = measures[measure];
  const Icon = icons[measure];
  const c = finding.comparison;
  const read = (phase: string) => {
    const values = packet.observations.filter(
      (r) =>
        r.measurement === measure &&
        r.phase === phase &&
        r.form === 'direct' &&
        !unavailable.includes(r.id),
    );
    return values.length === 1 ? formatNumber(values[0].value) : '—';
  };
  return (
    <button
      className={`metric-card ${selected ? 'selected' : ''}`}
      onClick={onClick}
      aria-label={`Inspect ${spec.short.toLowerCase()} comparison`}
    >
      <div className="metric-heading">
        <Icon size={16} />
        <span>{spec.short}</span>
        <ArrowUpRight size={14} />
      </div>
      <p className="metric-measure">{spec.detail}</p>
      <div className="metric-values">
        <span>{read('baseline')}</span>
        <ArrowRight size={16} />
        <strong>
          {read('followup')}
          <small>{spec.unit}</small>
        </strong>
      </div>
      <span className="metric-session">
        {packet.observations
          .filter((r) => r.measurement === measure && r.form === 'direct')
          .map((r) => r.session)
          .join(' → ') || 'No session recorded'}
      </span>
      <div className="metric-bottom">
        {c ? (
          <>
            <span className="delta">
              {c.absolute >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
              {c.relative !== null
                ? `${signed(c.relative)}%`
                : `${signed(c.absolute)} ${c.changeUnit === 'percentage points' ? 'pp' : c.changeUnit}`}
            </span>
            <span>Recorded change</span>
          </>
        ) : (
          <span className="missing-text">
            {finding.status === 'unresolved' ? 'Comparison withheld' : 'Comparison unavailable'}
          </span>
        )}
      </div>
      <span className="metric-source">
        {finding.status === 'supported'
          ? 'Compatible recorded pair'
          : finding.status === 'unresolved'
            ? 'Incompatible / unresolved records'
            : 'Required observation missing'}{' '}
        · Synthetic
      </span>
      <span className="metric-source">
        Source:{' '}
        {[
          ...new Set(
            packet.observations.filter((r) => r.measurement === measure).map((r) => r.sourceId),
          ),
        ].join(', ') || 'none'}
      </span>
    </button>
  );
}

function Inspector({
  finding: f,
  packet,
  marked,
  onMark,
  unavailable,
  onToggle,
  onSource,
  nextAction,
  onAction,
}: {
  finding: Finding;
  packet: CasePacket;
  marked: boolean;
  onMark: () => void;
  unavailable: string[];
  onToggle: (id: string) => void;
  onSource: () => void;
  nextAction?: HealthAction;
  onAction: () => void;
}) {
  const c = f.comparison;
  // The inspector already states the explanation; the action keeps only what it adds.
  const lead = f.explanation.split('. ')[0] + '.';
  const actionReason =
    nextAction && nextAction.reason.startsWith(lead) && nextAction.reason.length > lead.length
      ? nextAction.reason.slice(lead.length).trim()
      : nextAction?.reason;
  const checks = [
    {
      label: 'A direct baseline observation',
      met: f.evidence.filter((r) => r.phase === 'baseline' && !r.issues.length).length === 1,
    },
    {
      label: 'A direct follow-up observation',
      met: f.evidence.filter((r) => r.phase === 'followup' && !r.issues.length).length === 1,
    },
    { label: 'Compatible source, protocol & sessions', met: f.status === 'supported' },
  ];
  return (
    <aside className="inspector panel" aria-label="Claim inspector" data-testid="inspector">
      <div className="inspector-top">
        <Fingerprint size={17} />
        <span className="eyebrow mono">CLAIM INSPECTOR</span>
        <span className="mono">
          {f.id === 'overall' || f.id === 'clearance' ? 'BOUNDARY' : 'DIRECT'}
        </span>
      </div>
      <h2>{f.title}</h2>
      <Badge status={f.status} />
      <p className="inspector-explanation">{f.explanation}</p>
      {c && (
        <div
          className={`comparison-plot ${c.baseline.value < 0 || c.followup.value < 0 ? 'signed-values' : ''}`}
          aria-label={`Baseline ${c.baseline.value} ${c.baseline.unit}, follow-up ${c.followup.value} ${c.followup.unit}`}
        >
          <div>
            <span>Baseline</span>
            <div className="plot-track">
              <i
                style={{
                  width: `${Math.max(3, (Math.abs(c.baseline.value) / Math.max(Math.abs(c.baseline.value), Math.abs(c.followup.value), 1)) * 100)}%`,
                }}
              />
            </div>
            <strong>
              {formatNumber(c.baseline.value)} <small>{c.baseline.unit}</small>
            </strong>
          </div>
          <div>
            <span>Follow-up</span>
            <div className="plot-track followup">
              <i
                style={{
                  width: `${Math.max(3, (Math.abs(c.followup.value) / Math.max(Math.abs(c.baseline.value), Math.abs(c.followup.value), 1)) * 100)}%`,
                }}
              />
            </div>
            <strong>
              {formatNumber(c.followup.value)} <small>{c.followup.unit}</small>
            </strong>
          </div>
          <p>
            {signed(c.absolute)} {c.changeUnit}
            {c.relative !== null
              ? ` · ${signed(c.relative)}% relative`
              : measures[f.id as Measure].relative && c.baseline.value === 0
                ? ' · relative % undefined: zero baseline'
                : ''}
          </p>
          {(c.baseline.value < 0 || c.followup.value < 0) && (
            <small className="signed-caption">
              Signed response values. Bars omitted; compare the labelled values.
            </small>
          )}
        </div>
      )}
      {nextAction && (
        <div className="inspector-next">
          <span className="eyebrow mono">NEXT REVIEW ACTION</span>
          <h3>{nextAction.title.replace(/\bhr\b/g, 'heart-rate')}</h3>
          <p>{actionReason}</p>
          <button className="text-link" onClick={onAction}>
            Review this action <ArrowRight size={14} />
          </button>
        </div>
      )}
      <div className="requirements">
        <h3>Evidence requirements</h3>
        {checks.map((r, i) =>
          f.status === 'outside' ? null : (
            <div
              key={r.label}
              className={!r.met && f.requirements.includes(r.label) ? 'requirement-missing' : ''}
            >
              <span className={`requirement-icon ${r.met ? 'met' : ''}`} aria-hidden="true">
                {r.met ? <Check size={12} /> : <span>{i + 1}</span>}
              </span>
              <span>
                {r.label}
                {!r.met && f.requirements.includes(r.label) && (
                  <em className="requirement-flag" aria-hidden="true">
                    Missing
                  </em>
                )}
                <span className="sr-only"> — {r.met ? 'present' : 'not established'}</span>
              </span>
            </div>
          ),
        )}
        {f.requirements
          .filter((r) => f.status === 'outside' || !checks.some((c) => c.label === r))
          .map((r) => (
            <p className="missing-requirement" key={r}>
              {r}
            </p>
          ))}
        {f.issues.map((issue) => (
          <p className="quality-issue" key={issue}>
            {issue}
          </p>
        ))}
      </div>
      <SourceRecords packet={packet} finding={f} unavailable={unavailable} onToggle={onToggle} />
      <div className="limits">
        <h3>Interpretation boundary</h3>
        {f.limitations.map((l) => (
          <p key={l}>{l}</p>
        ))}
      </div>
      <button className="context-link" onClick={onSource}>
        <BookOpen size={15} />
        <span>
          Go to Science & sources{' '}
          <small>{f.contextIds.length} linked resources · never a substitute</small>
        </span>
        <ArrowUpRight size={15} />
      </button>
      <button className={`button full ${marked ? 'marked-button' : 'secondary'}`} onClick={onMark}>
        {marked ? <CheckCheck size={16} /> : <FileCheck2 size={16} />}
        {marked ? 'Marked for qualified review' : 'Mark for qualified review'}
      </button>
    </aside>
  );
}
