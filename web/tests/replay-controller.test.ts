import { beforeEach, expect, it, vi } from 'vitest';
import type { MissionState } from '../src/mission/state';
import type { Ledger } from '../src/monitoring/model';
const shared = vi.hoisted(() => ({
  state: null as MissionState | null,
  data: null as Ledger | null,
  deny: false,
  delay: null as Promise<void> | null,
}));
vi.mock('../src/monitoring/store', () => ({
  persistedMission: () => shared.state,
  ledgerTransaction: async (mutate?: (d: Ledger) => void, guard?: () => void) => {
    if (shared.deny) throw Error('storage denied');
    guard?.();
    const copy = structuredClone(shared.data!);
    mutate?.(copy);
    guard?.();
    shared.data = copy;
    return structuredClone(copy);
  },
}));
vi.mock('../src/devices/astroskin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/devices/astroskin')>();
  return {
    ...actual,
    ingestAstroskin: async (...args: Parameters<typeof actual.ingestAstroskin>) => {
      if (shared.delay) await shared.delay;
      return actual.ingestAstroskin(...args);
    },
  };
});
import { initialMissionState, missionReducer } from '../src/mission/state';
import { emptyLedger } from '../src/monitoring/model';
import { ReplayController } from '../src/monitoring/controller';
beforeEach(() => {
  shared.state = missionReducer(
    { ...initialMissionState(), entered: true },
    { type: 'designate-monitoring' },
  );
  shared.data = emptyLedger();
  shared.deny = false;
  shared.delay = null;
  vi.stubGlobal('document', { visibilityState: 'visible' });
});
function controller() {
  const changed = vi.fn(),
    failed = vi.fn();
  const c = new ReplayController(shared.state!, true, changed, failed);
  return { c, changed, failed };
}
it('start, pause, step, resume, stop and restart preserve distinct run ids', async () => {
  const { c, failed } = controller();
  await c.recover();
  await c.start();
  const first = c.runId;
  expect(shared.data!.samples).toHaveLength(1);
  await c.control('pause');
  await c.next();
  expect(shared.data!.samples).toHaveLength(2);
  expect(shared.data!.runs[0].status).toBe('paused');
  await c.control('resume');
  await c.control('stop');
  await c.start();
  expect(c.runId).not.toBe(first);
  expect(shared.data!.runs).toHaveLength(2);
  expect(shared.data!.samples).toHaveLength(3);
  expect(failed).not.toHaveBeenCalled();
  c.dispose();
});
it('reload recovers an active run as paused without fabricating samples', async () => {
  const { c } = controller();
  await c.start();
  const next = controller();
  await next.c.recover();
  expect(shared.data!.runs[0].status).toBe('paused');
  expect(shared.data!.samples).toHaveLength(1);
  next.c.dispose();
});
it('late asynchronous adapter completion after evidence change cannot commit', async () => {
  const { c, failed } = controller();
  await c.start();
  let resolve!: () => void;
  shared.delay = new Promise<void>((done) => {
    resolve = done;
  });
  const pending = c.next();
  shared.state = missionReducer(shared.state!, {
    type: 'record-availability',
    recordId: shared.state!.includedRecordIds[0],
    available: false,
  });
  c.update(shared.state, true);
  resolve();
  await pending;
  expect(shared.data!.samples).toHaveLength(1);
  expect(failed).not.toHaveBeenCalled();
  c.dispose();
});
it('late asynchronous completion after new mission generation cannot enter it', async () => {
  const { c, failed } = controller();
  await c.start();
  let resolve!: () => void;
  shared.delay = new Promise<void>((done) => {
    resolve = done;
  });
  const pending = c.next();
  shared.state = missionReducer(shared.state!, { type: 'restart' });
  c.update(shared.state, true);
  resolve();
  await pending;
  expect(shared.data!.samples).toHaveLength(1);
  expect(shared.data!.runs[0].basis.sessionId).not.toBe(shared.state.sessionId);
  expect(failed).not.toHaveBeenCalled();
  c.dispose();
});
it('pause invalidates an in-flight parser response', async () => {
  const { c } = controller();
  await c.start();
  let resolve!: () => void;
  shared.delay = new Promise<void>((done) => {
    resolve = done;
  });
  const pending = c.next();
  const pausing = c.control('pause');
  resolve();
  await pending;
  await pausing;
  expect(shared.data!.samples).toHaveLength(1);
  c.dispose();
});
it('denied persistence reports failure, does not confirm samples or keep ticking', async () => {
  const { c, failed } = controller();
  await c.start();
  shared.deny = true;
  await c.next();
  expect(failed).toHaveBeenCalled();
  expect(shared.data!.samples).toHaveLength(1);
  shared.deny = false;
  await c.tick();
  expect(shared.data!.samples).toHaveLength(1);
  c.dispose();
});
it('hidden owner pauses and never fills the missing interval', async () => {
  const { c } = controller();
  await c.start();
  vi.stubGlobal('document', { visibilityState: 'hidden' });
  await c.tick();
  expect(shared.data!.runs[0].status).toBe('paused');
  expect(shared.data!.samples).toHaveLength(1);
  c.dispose();
});
it('delayed owner execution creates availability interruption and pauses', async () => {
  const { c } = controller();
  await c.start();
  shared.data!.runs[0].updatedAt = '2026-01-01T00:00:00.000Z';
  c.data = structuredClone(shared.data!);
  await c.tick();
  expect(shared.data!.runs[0].status).toBe('paused');
  expect(shared.data!.events[0].reason).toBe('execution-delay');
  expect(shared.data!.samples).toHaveLength(1);
  c.dispose();
});
it('a follower cannot start an authoritative run', async () => {
  const errors = vi.fn();
  const c = new ReplayController(shared.state!, false, vi.fn(), errors);
  await c.recover();
  await c.start();
  expect(shared.data!.runs).toHaveLength(0);
  expect(errors).toHaveBeenCalled();
  c.dispose();
});
it('stopping a pending adapter response before restart keeps it out of the new run', async () => {
  const { c, failed } = controller();
  await c.start();
  const first = c.runId;
  let resolve!: () => void;
  shared.delay = new Promise<void>((done) => {
    resolve = done;
  });
  const pending = c.next();
  const stopping = c.control('stop');
  resolve();
  await pending;
  await stopping;
  shared.delay = null;
  await c.start();
  expect(c.runId).not.toBe(first);
  expect(shared.data!.samples.filter((s) => s.runId === first)).toHaveLength(1);
  expect(shared.data!.samples.filter((s) => s.runId === c.runId)).toHaveLength(1);
  expect(failed).not.toHaveBeenCalled();
  c.dispose();
});
it('checks live ownership after asynchronous parsing even before the UI ownership state changes', async () => {
  let owns = true;
  const failed = vi.fn();
  const c = new ReplayController(shared.state!, true, vi.fn(), failed, () => owns);
  await c.start();
  let resolve!: () => void;
  shared.delay = new Promise<void>((done) => {
    resolve = done;
  });
  const pending = c.next();
  owns = false;
  resolve();
  await pending;
  expect(shared.data!.samples).toHaveLength(1);
  expect(failed).toHaveBeenCalled();
  c.dispose();
});
it('an active recovered run stays paused when mission ownership arrives after the database read', async () => {
  const first = controller();
  await first.c.start();
  const next = new ReplayController(shared.state!, false, vi.fn(), vi.fn());
  await next.recover();
  expect(shared.data!.runs[0].status).toBe('active');
  next.update(shared.state!, true);
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  expect(shared.data!.runs[0].status).toBe('paused');
  expect(shared.data!.samples).toHaveLength(1);
  next.dispose();
});
