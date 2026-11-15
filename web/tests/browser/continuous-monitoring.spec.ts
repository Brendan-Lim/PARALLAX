import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { retrieveMissionRecord } from './missionHelpers';
import { downloadText, noHorizontalScroll } from './helpers';
import type { Ledger } from '../../src/monitoring/model';
const missionKey = 'parallax.mission.v1';
async function ledger(page: Page): Promise<Ledger> {
  return JSON.parse((await page.getByTestId('monitor-ledger-json').textContent())!);
}
async function consoleView(page: Page, retrieve = false, available = true) {
  await page.goto('/?legacy=1#mission/health');
  if (retrieve) await retrieveMissionRecord(page);
  await page.getByRole('button', { name: 'Interpret health and open watchlist' }).click();
  await page
    .getByRole('button', { name: 'Designate fictional HR monitoring requirement', exact: true })
    .click();
  await page.getByRole('link', { name: 'Open monitoring console', exact: true }).click();
  await expect(page.getByTestId('monitoring-console')).toBeVisible();
  if (available)
    await expect(page.getByRole('button', { name: 'Start replay', exact: true })).toBeEnabled();
}
async function startPaused(page: Page) {
  await page.bringToFront();
  await page.getByRole('button', { name: 'Start replay', exact: true }).click();
  await expect.poll(async () => (await ledger(page)).samples.length).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Pause replay', exact: true }).click();
  await expect(page.getByTestId('replay-state')).toContainText('Replay paused');
}
async function stepTo(page: Page, count: number) {
  while ((await ledger(page)).runs.at(-1)!.cursor < count) {
    const cursor = (await ledger(page)).runs.at(-1)!.cursor;
    await page.getByRole('button', { name: 'Next sample', exact: true }).click();
    await expect.poll(async () => (await ledger(page)).runs.at(-1)!.cursor).toBe(cursor + 1);
  }
}
async function companion(page: Page) {
  const popup = page.waitForEvent('popup');
  await page.getByRole('link', { name: 'Open companion in another tab', exact: true }).click();
  const c = await popup;
  await expect(c.getByTestId('companion')).toBeVisible();
  return c;
}
async function receipt(c: Page) {
  await c.bringToFront();
  await expect(c.getByTestId('delivery-state').first()).toContainText('receipt persisted');
}
async function saveReview(page: Page) {
  await page.getByRole('link', { name: 'Return to health review' }).click();
  await page.getByRole('button', { name: 'Interpret health and open watchlist' }).click();
  await page.getByLabel('Future monitoring needs activity, time and quality context').check();
  await page.getByRole('button', { name: 'Save fictional review', exact: true }).click();
  await expect(page.getByTestId('mission-handoff')).toBeVisible();
}
async function readDB(page: Page, store: string) {
  return page.evaluate(async (name) => {
    const request = indexedDB.open('parallax.monitoring.v1', 1);
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return new Promise<unknown[]>((resolve, reject) => {
      const tx = db.transaction(name, 'readonly');
      const r = tx.objectStore(name).getAll();
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      tx.oncomplete = () => db.close();
    });
  }, store);
}
test('complete production mission, genuine companion receipt/ack, recovery and canonical exports', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await consoleView(page, true);
  const c = await companion(page);
  await page.bringToFront();
  await startPaused(page);
  await stepTo(page, 4);
  await expect(page.getByTestId('monitor-current')).toContainText('unavailable');
  const data = await ledger(page);
  expect(data.samples[3].observation).toMatchObject({
    originalValue: 72,
    originalQualityCode: 2,
    usability: 'withheld',
    absoluteAcquiredAt: null,
  });
  expect(data.samples.slice(0, 3).every((s) => s.observation.usability === 'usable')).toBe(true);
  expect(data.events).toHaveLength(1);
  await receipt(c);
  await c.getByRole('button', { name: 'Acknowledge notification', exact: true }).click();
  await expect(c.getByTestId('ack-state')).toContainText('Acknowledged by Fictional crew');
  await expect(page.getByTestId('ack-state')).toContainText('Acknowledged by Fictional crew');
  await page.bringToFront();
  await stepTo(page, 6);
  await expect(page.getByTestId('event-monitoring-recovery')).toBeVisible();
  await expect(page.getByTestId('event-monitoring-interruption')).toContainText('Acknowledged');
  await page.getByRole('button', { name: 'Simulate external review alert' }).click();
  await expect(page.getByTestId('event-simulated-external-alert')).toContainText(
    'PARALLAX simulated upstream',
  );
  await c.bringToFront();
  await expect(
    c.getByTestId('event-simulated-external-alert').getByTestId('delivery-state'),
  ).toContainText('receipt persisted');
  await c
    .getByTestId('event-simulated-external-alert')
    .getByRole('button', { name: 'Acknowledge notification', exact: true })
    .click();
  await page.bringToFront();
  await saveReview(page);
  const json = await downloadText(page, 'Download review JSON');
  const html = await downloadText(page, 'Download mission review');
  const doc = JSON.parse(json.body);
  expect(doc.snapshot.monitoring.samples).toHaveLength(6);
  expect(doc.snapshot.monitoring.events).toHaveLength(3);
  expect(doc.snapshot.monitoring.acknowledgments).toHaveLength(2);
  expect(html.body).toContain(doc.snapshot.monitoring.events[0].id);
  const embedded = JSON.parse(html.body.match(/id="canonical-review">(.*?)<\/script>/s)![1]);
  expect(embedded.snapshot).toEqual(doc.snapshot);
  await page.getByText('Preview the handoff document', { exact: true }).click();
  for (const section of doc.sections)
    await expect(page.getByTestId('handoff-preview')).toContainText(section.heading);
  expect(errors).toEqual([]);
  await c.close();
});
test('foreground replay advances automatically from adapter inputs then produces an interruption', async ({
  page,
}) => {
  await consoleView(page);
  await page.getByRole('button', { name: 'Start replay', exact: true }).click();
  await expect(page.getByTestId('monitor-current')).toContainText('72 bpm');
  await expect(page.getByTestId('event-monitoring-interruption')).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'Pause replay' }).click();
  const d = await ledger(page);
  for (const sample of d.samples) {
    const raw = JSON.parse(d.payloads.find((p) => p.id === sample.payloadId)!.raw);
    expect(sample.observation.value).toBe(raw[0].data['19'][0][1]);
    expect(sample.observation.originalTicks).toBe(raw[0].data['19'][0][0]);
  }
  expect(d.events.filter((e) => e.type === 'monitoring-interruption')).toHaveLength(1);
});
test('companion opened after event reconciles missed broadcasts; receipt is never inferred from send', async ({
  page,
}) => {
  await consoleView(page);
  await startPaused(page);
  await stepTo(page, 4);
  await expect(page.getByTestId('delivery-state')).toContainText('no companion receipt');
  expect((await ledger(page)).transitions.some((t) => t.kind === 'displayed-receipt')).toBe(false);
  const c = await companion(page);
  await receipt(c);
  await c.reload();
  await receipt(c);
  expect(
    (await readDB(c, 'transitions')).filter(
      (t) => (t as { kind: string }).kind === 'displayed-receipt',
    ),
  ).toHaveLength(1);
  await c.close();
});
test('duplicate companion tabs acknowledge concurrently once and never edit mission storage', async ({
  page,
}) => {
  await consoleView(page);
  await startPaused(page);
  await stepTo(page, 4);
  const raw = await page.evaluate((k) => localStorage.getItem(k), missionKey);
  const a = await companion(page);
  await receipt(a);
  const b = await companion(page);
  await receipt(b);
  await Promise.all([
    a.getByRole('button', { name: 'Acknowledge notification', exact: true }).click(),
    b.getByRole('button', { name: 'Acknowledge notification', exact: true }).click(),
  ]);
  await expect(a.getByTestId('ack-state')).toContainText('Acknowledged by');
  await expect(b.getByTestId('ack-state')).toContainText('Acknowledged by');
  expect(await readDB(a, 'acknowledgments')).toHaveLength(1);
  expect(await a.evaluate((k) => localStorage.getItem(k), missionKey)).toBe(raw);
  await a.close();
  await b.close();
});
test('owner reload preserves history, pauses progression and reconnects companion', async ({
  page,
}) => {
  await consoleView(page);
  await startPaused(page);
  await stepTo(page, 4);
  const c = await companion(page);
  await receipt(c);
  await page.reload();
  await expect(page.getByTestId('replay-state')).toContainText('paused');
  await expect(page.getByTestId('event-monitoring-interruption')).toBeVisible();
  await expect(c.getByTestId('owner-connection')).toContainText('observed');
  await c.getByRole('button', { name: 'Acknowledge notification', exact: true }).click();
  await expect(page.getByTestId('ack-state')).toContainText('Acknowledged by');
  await c.close();
});
test('owner close is reported honestly; narrow acknowledgment still persists without mission owner', async ({
  page,
}) => {
  await consoleView(page);
  await startPaused(page);
  await stepTo(page, 4);
  const c = await companion(page);
  await receipt(c);
  await expect(c.getByTestId('owner-connection')).toContainText('observed');
  await page.close();
  await expect(c.getByTestId('owner-connection')).toContainText('No current connection', {
    timeout: 10000,
  });
  await c.getByRole('button', { name: 'Acknowledge notification', exact: true }).click();
  await expect(c.getByTestId('ack-state')).toContainText('Acknowledged by');
  await c.close();
});
test('old companion is isolated after restart; new run requires explicit reconnection', async ({
  page,
}) => {
  await consoleView(page);
  await startPaused(page);
  await stepTo(page, 4);
  const c = await companion(page);
  await receipt(c);
  await page.bringToFront();
  await page.getByRole('button', { name: 'Stop replay', exact: true }).click();
  await page.getByRole('button', { name: 'Restart replay', exact: true }).click();
  await expect(c.getByTestId('companion-binding')).toContainText('Historical or stale');
  await expect(
    c.getByRole('button', { name: 'Acknowledge notification', exact: true }),
  ).toHaveCount(0);
  await c.getByRole('button', { name: 'Connect to current replay' }).click();
  await expect(c.getByTestId('companion-binding')).toContainText('Current replay');
  await page.getByRole('link', { name: 'Return to health review' }).click();
  await page.getByRole('button', { name: 'Restart mission', exact: true }).click();
  await page.getByRole('button', { name: 'Restart mission review', exact: true }).click();
  await expect(c.getByTestId('companion-binding')).toContainText('Historical mission generation');
  await expect(c.getByRole('button', { name: 'Connect to current replay' })).toHaveCount(0);
  await c.close();
});
test('stale evidence suspends association and restoration cannot reactivate an old run', async ({
  page,
}) => {
  await consoleView(page, true);
  await startPaused(page);
  const run = (await ledger(page)).runs[0];
  await page.getByRole('link', { name: 'Return to health review' }).click();
  await page.getByText('Inspect records and comparison', { exact: true }).click();
  await page.getByLabel('Use the 28 June record in this review').uncheck();
  await page.goto('/?legacy=1#mission/monitoring');
  await expect(page.getByTestId('monitor-designation')).toContainText('No current');
  await expect(page.getByTestId('replay-state')).toContainText('plan stale');
  await expect(page.getByTestId('monitor-current')).toContainText('unavailable');
  expect((await ledger(page)).runs[0].id).toBe(run.id);
});
test('no designation permits source inspection but no active replay or owner-writing companion', async ({
  page,
}) => {
  await page.goto('/?legacy=1#mission/monitoring');
  await expect(page.getByRole('button', { name: 'Start replay', exact: true })).toBeDisabled();
  await page
    .getByText('Inspect replay source and persisted parser output', { exact: true })
    .click();
  await expect(page.getByTestId('monitor-ledger-json')).toContainText('"runs": []');
  const c = await companion(page);
  await expect(c.getByTestId('companion-binding')).toContainText('Waiting for');
  await expect(c.getByRole('button', { name: /Save|Designate|Start replay/ })).toHaveCount(0);
  await c.close();
});
test('IDB event-write failure rolls back the corresponding sample and reports no durable event', async ({
  page,
}) => {
  await consoleView(page);
  await startPaused(page);
  await stepTo(page, 3);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (...args: Parameters<IDBObjectStore['add']>) {
      if (this.name === 'events')
        throw new DOMException('event write denied', 'QuotaExceededError');
      return original.apply(this, args);
    };
  });
  await page.getByRole('button', { name: 'Next sample', exact: true }).click();
  await expect(page.getByTestId('monitor-error')).toContainText('event write denied');
  expect(await readDB(page, 'samples')).toHaveLength(3);
  expect(await readDB(page, 'events')).toHaveLength(0);
  await expect(page.getByTestId('monitor-current')).toContainText('unavailable');
});
test('storage denial and newer monitoring schema do not invent telemetry', async ({
  page,
  context,
}) => {
  await page.addInitScript(() => {
    IDBFactory.prototype.open = function () {
      throw new DOMException('storage denied', 'SecurityError');
    };
  });
  await consoleView(page, false, false);
  await expect(page.getByTestId('monitor-error')).toContainText('storage denied');
  expect((await ledger(page)).samples).toHaveLength(0);
  const second = await context.newPage();
  await second.goto('/');
  await second.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const r = indexedDB.open('parallax.monitoring.v1', 2);
      r.onsuccess = () => {
        r.result.close();
        resolve();
      };
      r.onerror = () => reject(r.error);
    });
  });
  await second.goto('/?legacy=1#mission/monitoring');
  await expect(second.getByTestId('monitor-error')).toContainText('schema unsupported');
  await second.close();
});
test('invalid persisted sample is rejected on recovery rather than displayed as an observation', async ({
  page,
}) => {
  await consoleView(page);
  await startPaused(page);
  await page.evaluate(async () => {
    const r = indexedDB.open('parallax.monitoring.v1', 1);
    const db = await new Promise<IDBDatabase>((resolve) => {
      r.onsuccess = () => resolve(r.result);
    });
    await new Promise<void>((resolve) => {
      const tx = db.transaction('samples', 'readwrite');
      const store = tx.objectStore('samples');
      const get = store.getAll();
      get.onsuccess = () => {
        const sample = get.result[0];
        sample.observation.value = 150;
        store.put(sample);
      };
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
    });
  });
  await page.reload();
  await expect(page.getByTestId('monitor-error')).toContainText(
    'Invalid persisted parser observation',
  );
  await expect(page.getByTestId('monitor-current')).toContainText('unavailable');
});
test('missing BroadcastChannel falls back to persisted reconciliation and honest connection status', async ({
  page,
  context,
}) => {
  await context.addInitScript(() => {
    Object.defineProperty(window, 'BroadcastChannel', { value: undefined, configurable: true });
  });
  await consoleView(page);
  await startPaused(page);
  await stepTo(page, 4);
  const c = await companion(page);
  await receipt(c);
  await expect(c.getByTestId('owner-connection')).toContainText('unconfirmed');
  await c.getByRole('button', { name: 'Acknowledge notification', exact: true }).click();
  await expect(page.getByTestId('ack-state')).toContainText('Acknowledged by');
  await c.close();
});
test('installed offline workflow includes replay, second page, acknowledgment, recovery and exports', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
          once: true,
        }),
      );
  });
  await context.setOffline(true);
  await consoleView(page, true);
  await startPaused(page);
  await stepTo(page, 4);
  const c = await companion(page);
  await receipt(c);
  await c.getByRole('button', { name: 'Acknowledge notification', exact: true }).click();
  await expect(page.getByTestId('ack-state')).toContainText('Acknowledged by');
  await page.bringToFront();
  await stepTo(page, 6);
  await saveReview(page);
  const json = JSON.parse((await downloadText(page, 'Download review JSON')).body);
  expect(json.snapshot.monitoring.events.map((e: { type: string }) => e.type)).toContain(
    'monitoring-recovery',
  );
  expect(json.snapshot.monitoring.acknowledgments).toHaveLength(1);
  expect((await downloadText(page, 'Download mission review')).body).toContain('Displayed receipt');
  await c.close();
});
test('new events after saved review request further monitoring review while old snapshot stays immutable', async ({
  page,
}) => {
  await consoleView(page);
  await startPaused(page);
  await saveReview(page);
  const original = JSON.parse((await downloadText(page, 'Download review JSON')).body).snapshot;
  await page.getByRole('link', { name: 'Open monitoring console', exact: true }).click();
  await page.getByRole('button', { name: 'Simulate external review alert' }).click();
  await page.getByRole('link', { name: 'Return to health review' }).click();
  await page.getByRole('button', { name: 'Interpret health and open watchlist' }).click();
  await expect(page.getByTestId('review-currency')).toContainText(
    'Further monitoring review required',
  );
  const current = JSON.parse((await downloadText(page, 'Download review JSON')).body);
  expect(current.snapshot).toEqual(original);
  expect(current.monitoringUpdate.newEventIds).toHaveLength(1);
});
test('monitoring and companion are keyboard accessible, mobile reflow and reduced-motion compatible', async ({
  page,
}) => {
  await consoleView(page);
  await startPaused(page);
  await stepTo(page, 4);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Next sample', exact: true }).focus();
  await expect(page.getByRole('button', { name: 'Next sample', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await ledger(page)).runs[0].cursor).toBe(5);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await noHorizontalScroll(page);
  const c = await companion(page);
  await c.setViewportSize({ width: 390, height: 844 });
  await receipt(c);
  await noHorizontalScroll(c);
  expect((await new AxeBuilder({ page: c }).analyze()).violations).toEqual([]);
  await c.getByRole('button', { name: 'Acknowledge notification', exact: true }).focus();
  await c.keyboard.press('Enter');
  await expect(c.getByTestId('ack-state')).toContainText('Acknowledged by');
  await c.close();
});
test('neutral evaluation routes create no mission or monitoring database and expose no monitoring answers', async ({
  page,
}) => {
  for (const route of ['mission/monitoring', 'mission/companion']) {
    await page.goto('/?evaluation=1#' + route);
    await expect(page.getByTestId('monitoring-console')).toHaveCount(0);
    await expect(page.getByTestId('companion')).toHaveCount(0);
    expect(await page.evaluate((k) => localStorage.getItem(k), missionKey)).toBeNull();
    expect(
      await page.evaluate(async () =>
        (await indexedDB.databases()).some((d) => d.name === 'parallax.monitoring.v1'),
      ),
    ).toBe(false);
  }
});
test('suspended local execution pauses with an interruption and no invented measurements', async ({
  page,
}) => {
  await page.clock.install();
  await consoleView(page);
  await startPaused(page);
  const before = (await ledger(page)).samples.length;
  await page.getByRole('button', { name: 'Resume replay', exact: true }).click();
  await expect(page.getByTestId('replay-state')).toContainText('Replay active');
  await page.clock.setSystemTime(new Date((await page.evaluate(() => Date.now())) + 7000));
  await expect(page.getByTestId('replay-state')).toContainText('paused');
  await expect(page.getByTestId('event-monitoring-interruption')).toContainText(
    'local replay execution was delayed',
  );
  expect((await ledger(page)).samples).toHaveLength(before);
  await expect(page.getByTestId('monitor-current')).toContainText('unavailable');
});
test('closing a companion before an event creates no receipt; later opening recovers it', async ({
  page,
}) => {
  await consoleView(page);
  const c = await companion(page);
  await c.close();
  await startPaused(page);
  await stepTo(page, 4);
  await expect(page.getByTestId('delivery-state')).toContainText('no companion receipt');
  const recovered = await companion(page);
  await receipt(recovered);
  await recovered.close();
});
test('acknowledgment write denial remains unacknowledged and reload permits honest retry', async ({
  page,
}) => {
  await consoleView(page);
  await startPaused(page);
  await stepTo(page, 4);
  const c = await companion(page);
  await receipt(c);
  await c.evaluate(() => {
    const original = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (...args: Parameters<IDBObjectStore['add']>) {
      if (this.name === 'acknowledgments')
        throw new DOMException('ack write denied', 'QuotaExceededError');
      return original.apply(this, args);
    };
  });
  await c.getByRole('button', { name: 'Acknowledge notification', exact: true }).click();
  await expect(c.getByRole('alert')).toContainText('ack write denied');
  expect(await readDB(c, 'acknowledgments')).toHaveLength(0);
  await expect(page.getByTestId('ack-state')).toContainText('Not acknowledged');
  await c.reload();
  await receipt(c);
  await c.getByRole('button', { name: 'Acknowledge notification', exact: true }).click();
  await expect(page.getByTestId('ack-state')).toContainText('Acknowledged by');
  await c.close();
});
test('unreviewed event retention blocks a fifth run without erasing old events', async ({
  page,
}) => {
  await consoleView(page);
  for (let i = 0; i < 4; i++) {
    await page
      .getByRole('button', { name: i ? 'Restart replay' : 'Start replay', exact: true })
      .click();
    await expect.poll(async () => (await ledger(page)).runs.length).toBe(i + 1);
    await page.getByRole('button', { name: 'Pause replay', exact: true }).click();
    await page.getByRole('button', { name: 'Simulate external review alert' }).click();
    await expect.poll(async () => (await ledger(page)).events.length).toBe(i + 1);
    await page.getByRole('button', { name: 'Stop replay', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Restart replay', exact: true }).click();
  await expect(page.getByTestId('monitor-error')).toContainText('retention is full');
  expect(await readDB(page, 'runs')).toHaveLength(4);
  expect(await readDB(page, 'events')).toHaveLength(4);
});
test('fresh mission entry preserves its JavaScript ceiling and defers monitoring modules', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Start guided mission demo' })).toBeVisible();
  const entries = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .filter((e) => new URL(e.name).pathname.endsWith('.js'))
      .map((e) => ({ name: e.name, bytes: (e as PerformanceResourceTiming).decodedBodySize })),
  );
  expect(entries.reduce((n, e) => n + e.bytes, 0)).toBeLessThan(350000);
  expect(entries.some((e) => /MonitoringConsole|Companion-|store-/.test(e.name))).toBe(false);
});
test('reloading an active replay requires explicit resume and does not acquire during the missing interval', async ({
  page,
}) => {
  await consoleView(page);
  await page.getByRole('button', { name: 'Start replay', exact: true }).click();
  await expect.poll(async () => (await ledger(page)).samples.length).toBeGreaterThan(0);
  await page.reload();
  await expect(page.getByTestId('replay-state')).toContainText('Replay paused');
  const count = (await ledger(page)).samples.length;
  await expect(page.getByTestId('monitor-current')).toContainText('unavailable');
  await page.waitForTimeout(1500);
  expect((await ledger(page)).samples).toHaveLength(count);
  await expect(page.getByRole('button', { name: 'Resume replay', exact: true })).toBeEnabled();
});
test('eligible live-history eviction preserves a saved review and retained-run inspection stays read-only', async ({
  page,
}) => {
  await consoleView(page);
  await startPaused(page);
  await saveReview(page);
  const original = JSON.parse((await downloadText(page, 'Download review JSON')).body).snapshot;
  await page.getByRole('link', { name: 'Open monitoring console', exact: true }).click();
  await page.getByRole('button', { name: 'Stop replay', exact: true }).click();
  for (let i = 0; i < 4; i++) {
    await page.getByRole('button', { name: 'Restart replay', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Pause replay', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Pause replay', exact: true }).click();
    await page.getByRole('button', { name: 'Stop replay', exact: true }).click();
  }
  const data = await ledger(page);
  expect(data.runs).toHaveLength(4);
  expect(data.runs.some((r) => r.id === original.monitoring.run.id)).toBe(false);
  await page.getByLabel('Retained replay history').selectOption(data.runs[0].id);
  await expect(page.getByTestId('replay-state')).toContainText('historical run');
  await expect(page.getByTestId('monitor-current')).toContainText('unavailable');
  await expect(page.getByRole('button', { name: 'Restart replay', exact: true })).toBeDisabled();
  await page.getByRole('link', { name: 'Return to health review' }).click();
  await page.getByRole('button', { name: 'Interpret health and open watchlist' }).click();
  expect(JSON.parse((await downloadText(page, 'Download review JSON')).body).snapshot).toEqual(
    original,
  );
});
test('finite replay completion preserves both quality episodes and never presents the final historical value as fresh', async ({
  page,
}) => {
  await consoleView(page);
  await startPaused(page);
  await stepTo(page, 7);
  await expect(page.getByTestId('monitor-current')).toContainText('mask missing');
  await expect(page.getByTestId('monitor-current')).toContainText('uncertain');
  await expect(page.getByTestId('event-monitoring-interruption')).toHaveCount(2);
  await stepTo(page, 8);
  await expect(page.getByTestId('replay-state')).toContainText('Replay completed');
  await expect(page.getByTestId('monitor-current')).toContainText('unavailable');
  await expect(page.getByTestId('event-monitoring-recovery')).toHaveCount(2);
  expect((await ledger(page)).samples).toHaveLength(8);
  await expect(page.getByRole('button', { name: 'Resume replay', exact: true })).toBeDisabled();
});
test('a newly committed recovery sample becomes usable immediately in active replay', async ({
  page,
}) => {
  await consoleView(page);
  await startPaused(page);
  await stepTo(page, 5);
  await page.getByRole('button', { name: 'Resume replay', exact: true }).click();
  await expect(page.getByTestId('monitor-current')).toContainText(
    'Latest usable replay observation: 73 bpm',
    { timeout: 4000 },
  );
  await page.getByRole('button', { name: 'Pause replay', exact: true }).click();
  await expect(page.getByTestId('event-monitoring-recovery')).toBeVisible();
  await expect(page.getByTestId('event-monitoring-interruption')).toBeVisible();
});
