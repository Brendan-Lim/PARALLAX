import { ingestAstroskin } from '../devices/astroskin';
import { canonical, evidenceIdentity } from '../mission/identity';
import type { MissionState } from '../mission/state';
import { requireValid } from '../mission/validation';
import { replayAcquisition, replayFrames, replayRecencyMs } from './fixture';
import {
  acceptBatch,
  bindingMatches,
  externalEvent,
  newRun,
  pauseRun,
  retainForNewRun,
  type Ledger,
  type Run,
} from './model';
import { ledgerTransaction, persistedMission } from './store';
export class ReplayController {
  private token = 0;
  private disposed = false;
  private recoveredActiveId: string | null = null;
  busy = false;
  private halted = false;
  private waiters: (() => void)[] = [];
  private async idle() {
    if (this.busy) await new Promise<void>((resolve) => this.waiters.push(resolve));
  }
  state: MissionState;
  editable: boolean;
  data: Ledger | null = null;
  runId: string | null = null;
  constructor(
    state: MissionState,
    editable: boolean,
    private changed: (data: Ledger) => void,
    private failed: (error: unknown) => void,
    private isOwner: () => boolean = () => true,
  ) {
    this.state = state;
    this.editable = editable;
  }
  private guard = () => {
    requireValid(
      !this.disposed && !this.halted && this.editable && this.isOwner(),
      'Monitoring owner unavailable or replay suspended after an error. Reload to reconcile.',
    );
    const saved = persistedMission();
    requireValid(
      canonical(evidenceIdentity(this.state)) === canonical(evidenceIdentity(saved)) &&
        canonical(this.state.monitoringPlans) === canonical(saved.monitoringPlans),
      'Saved mission identity or designation changed; pending ingestion rejected.',
    );
  };
  private run(data: Ledger): Run {
    const run = data.runs.find((r) => r.id === this.runId);
    requireValid(
      run && bindingMatches(run, this.state) && bindingMatches(run, persistedMission()),
      'Monitoring plan stale. Designate a new requirement and start a new replay.',
    );
    return run;
  }
  private async operation(action: () => Promise<Ledger>) {
    if (this.busy || this.disposed) return;
    this.busy = true;
    try {
      const data = await action();
      if (!this.disposed) {
        this.data = data;
        this.changed(data);
      }
    } catch (error) {
      if (!(error instanceof Error && error.message === 'Replay operation superseded.')) {
        this.token++;
        this.halted = true;
        this.failed(error);
      }
    } finally {
      this.busy = false;
      this.waiters.splice(0).forEach((resolve) => resolve());
    }
  }
  async recover() {
    await this.operation(async () => {
      let data = await ledgerTransaction();
      const latest = data.runs.filter((r) => r.basis.sessionId === this.state.sessionId).at(-1);
      this.runId = latest?.id ?? null;
      this.recoveredActiveId = latest?.status === 'active' ? latest.id : null;
      if (latest && this.editable)
        data = await ledgerTransaction((d) => {
          const run = d.runs.find((r) => r.id === latest.id)!;
          if (!bindingMatches(run, this.state)) {
            run.status = 'stale';
            run.pauseReason =
              'Evidence, session or designation changed. New designation and replay required.';
          } else
            pauseRun(
              d,
              run,
              'Reload or return to console. Resume explicitly; no samples were generated while absent.',
              new Date().toISOString(),
            );
        }, this.guard);
      if (this.editable) this.recoveredActiveId = null;
      return data;
    });
  }
  update(state: MissionState, editable: boolean) {
    this.state = state;
    this.editable = editable;
    const run = this.data?.runs.find((r) => r.id === this.runId);
    if (run && (!bindingMatches(run, state) || !editable)) {
      this.token++;
      if (this.busy) {
        void this.idle().then(() => {
          if (!this.disposed) this.update(this.state, this.editable);
        });
        return;
      }
      if (editable && run.status !== 'stale')
        void this.operation(() =>
          ledgerTransaction((data) => {
            const r = data.runs.find((r) => r.id === run.id)!;
            r.status = 'stale';
            r.pauseReason =
              'Evidence or designation changed. Earlier observations remain historical; new designation required.';
          }, this.guard),
        );
    }
    if (run && editable && bindingMatches(run, state) && this.recoveredActiveId === run.id) {
      this.recoveredActiveId = null;
      void this.control(
        'pause',
        'Reload or return to console. Resume explicitly; no samples were generated while absent.',
      );
    }
  }
  async start() {
    ++this.token;
    await this.operation(() =>
      ledgerTransaction((data) => {
        for (const run of data.runs)
          if (['active', 'paused'].includes(run.status)) {
            run.status = 'stopped';
            run.pauseReason = 'Another replay started. Historical association retained.';
          }
        retainForNewRun(
          data,
          new Set(
            this.state.reviews.flatMap(
              (review) => review.monitoring?.events.map((event) => event.id) ?? [],
            ),
          ),
        );
        const run = newRun(this.state, new Date().toISOString());
        run.sequence = Math.max(0, ...data.runs.map((r) => r.sequence)) + 1;
        data.runs.push(run);
        this.runId = run.id;
      }, this.guard),
    );
    if (!this.disposed && !this.halted && this.runId) await this.next();
  }
  async next() {
    const token = this.token;
    const id = this.runId;
    await this.operation(async () => {
      this.guard();
      const run = this.data && this.run(this.data);
      requireValid(
        run && ['active', 'paused'].includes(run.status),
        'Start or resume a replay first.',
      );
      const frame = run.cursor;
      const result = await ingestAstroskin(
        replayFrames[frame],
        replayAcquisition,
        new Date().toISOString(),
      );
      requireValid(result.ok, result.ok ? '' : result.error);
      const check = () => {
        requireValid(
          token === this.token && id === this.runId && !this.disposed,
          'Replay operation superseded.',
        );
        this.guard();
      };
      check();
      return ledgerTransaction((data) => {
        check();
        acceptBatch(data, this.run(data), result.batch, frame, new Date().toISOString());
      }, check);
    });
  }
  async control(
    action: 'pause' | 'resume' | 'stop',
    reason = 'Paused by the demonstration operator.',
    delayed = false,
  ) {
    ++this.token;
    await this.idle();
    await this.operation(() =>
      ledgerTransaction((data) => {
        const run = this.run(data);
        const at = new Date().toISOString();
        if (action === 'pause') pauseRun(data, run, reason, at, delayed);
        else if (action === 'resume') {
          requireValid(
            run.status === 'paused' && document.visibilityState === 'visible',
            'Resume needs a visible paused replay.',
          );
          run.status = 'active';
          run.pauseReason = '';
          run.updatedAt = at;
        } else {
          run.status = 'stopped';
          run.pauseReason = 'Replay stopped. Observations are historical.';
          run.updatedAt = at;
        }
      }, this.guard),
    );
  }
  async tick() {
    if (this.busy || this.disposed || this.halted || !this.editable) return;
    const run = this.data?.runs.find((r) => r.id === this.runId);
    if (!run || run.status !== 'active') return;
    if (document.visibilityState !== 'visible') {
      await this.control('pause', 'Page hidden. Resume explicitly in the foreground.');
      return;
    }
    const elapsed = Date.now() - Date.parse(run.updatedAt);
    if (elapsed < 0 || elapsed > replayRecencyMs) {
      await this.control(
        'pause',
        'Local execution delayed or clock changed. Replay recency expired; resume explicitly.',
        true,
      );
      return;
    }
    await this.next();
  }
  async simulateExternal() {
    await this.operation(() =>
      ledgerTransaction((data) => {
        externalEvent(data, this.run(data), new Date().toISOString());
      }, this.guard),
    );
  }
  dispose() {
    this.disposed = true;
    ++this.token;
    const id = this.runId;
    const updatedAt = this.data?.runs.find((run) => run.id === id)?.updatedAt;
    if (id && this.editable)
      void ledgerTransaction((data) => {
        const run = data.runs.find((r) => r.id === id);
        if (run && run.updatedAt === updatedAt)
          pauseRun(
            data,
            run,
            'Console closed. Resume explicitly; no background monitoring.',
            new Date().toISOString(),
          );
      }).catch(() => {
        /* A later owner recovers an active run as paused. */
      });
  }
}
