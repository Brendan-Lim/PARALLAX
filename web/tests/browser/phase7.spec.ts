import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
const tandemRegister = JSON.parse(
  readFileSync(new URL('../../../docs/science/CLEMENT2024_TANDEM.json', import.meta.url), 'utf8'),
) as {
  rows: {
    group: string;
    condition: string;
    beforeMean: number;
    beforeSD: number;
    afterMean: number;
    afterSD: number;
  }[];
};
import { retrieveMissionRecord } from './missionHelpers';

const activeId = (page: Page) => page.evaluate(() => document.activeElement?.id);
const ledger = async (page: Page) =>
  JSON.parse((await page.getByTestId('monitor-ledger-json').textContent())!);

for (const width of [1440, 390, 320]) {
  test(`every assessment is reachable by keyboard with stable selection at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/?legacy=1#mission/health/assessments');
    await expect(page.locator('#m-planner-title')).toBeFocused();
    await page.waitForTimeout(400);
    await page.keyboard.press('Tab');
    await expect(page.locator('#m-task-exercise')).toBeFocused();
    const ids = ['exercise', 'aerobic', 'mobility', 'force', 'spo2', 'sleep', 'alertness'];
    const actual = await page
      .getByTestId('mission-planner')
      .getByRole('tab')
      .evaluateAll((tabs) => tabs.map((t) => t.id.replace('m-task-', '')));
    expect(actual).toHaveLength(ids.length);
    const visited = [];
    for (const id of actual) {
      visited.push((await activeId(page))?.replace('m-task-', ''));
      await expect(page.locator(`#m-task-${id}`)).toBeFocused();
      await expect(page.getByTestId(`assessment-${id}`)).toBeVisible();
      await page.keyboard.press('ArrowDown');
    }
    expect(visited).toEqual(actual);
    await expect(page.locator('#m-task-exercise')).toBeFocused();
    await page.keyboard.press('End');
    await expect(page.locator(`#m-task-${actual.at(-1)}`)).toBeFocused();
    await page.keyboard.press('Home');
    await expect(page.locator('#m-task-exercise')).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(page.locator(`#m-task-${actual.at(-1)}`)).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator(`#m-task-${actual.at(-1)}`)).toBeFocused();
    await page.keyboard.press('Home');
    await retrieveMissionRecord(page);
    await expect(page.locator('#m-planner-title')).toBeFocused();
    await page.waitForTimeout(400);
    await expect(page.locator('#m-planner-title')).toBeFocused();
    const axe = await new AxeBuilder({ page }).include('[data-testid="mission-planner"]').analyze();
    expect(axe.violations).toEqual([]);
  });
}

test('manual hashes, repeated sections and browser history reveal and focus the requested content', async ({
  page,
}) => {
  await page.goto('/?legacy=1#mission/health/assessments');
  await expect(page.locator('#m-planner-title')).toBeFocused();
  const nav = page.getByRole('navigation', { name: 'Mission sections' });
  await nav.getByRole('link', { name: 'Overview', exact: true }).click();
  await page.evaluate(() => {
    location.hash = '#mission/health/assessments';
  });
  await expect(nav.getByRole('link', { name: 'Assessments', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.locator('#m-planner-title')).toBeFocused();
  for (const [name, heading] of [
    ['Health watchlist', 'm-interpretation-title'],
    ['Review', 'm-fictional-review-title'],
    ['Assessments', 'm-planner-title'],
  ]) {
    await nav.getByRole('link', { name, exact: true }).click();
    await expect(page.locator(`#${heading}`)).toBeFocused();
    await nav.getByRole('link', { name, exact: true }).click();
    await expect(page.locator(`#${heading}`)).toBeFocused();
    await page.reload();
    await expect(page.locator(`#${heading}`)).toBeFocused();
  }
  await nav.getByRole('link', { name: 'Monitoring', exact: true }).click();
  await expect(page.locator('#monitor-console-title')).toBeFocused();
  await page.goBack();
  await expect(page.locator('#m-planner-title')).toBeFocused();
  await page.goForward();
  await expect(page.locator('#monitor-console-title')).toBeFocused();
  await page.reload();
  await expect(page.locator('#monitor-console-title')).toBeFocused();
});

test('all eight published rows retain exact values, geometry and clipped SD markers', async ({
  page,
}) => {
  await page.goto('/#research');
  const demo = page.getByTestId('aggregate-demo');
  const fmt = (n: number) =>
    n.toLocaleString('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
  for (const row of tandemRegister.rows) {
    await page.getByLabel('Study group', { exact: true }).selectOption(row.group);
    await page.getByLabel('Before bed rest', { exact: true }).selectOption(row.condition);
    await page.getByLabel('After bed rest', { exact: true }).selectOption(row.condition);
    await expect(demo.locator('table')).toContainText(
      `${fmt(row.beforeMean)} ± ${fmt(row.beforeSD)}`,
    );
    await expect(demo.locator('table')).toContainText(
      `${fmt(row.afterMean)} ± ${fmt(row.afterSD)}`,
    );
    await expect(demo.locator('.r-agg-clip')).toHaveCount(
      Number(row.beforeMean + row.beforeSD > 100) + Number(row.afterMean + row.afterSD > 100),
    );
    expect(Number(await demo.locator('.r-agg-bar-a').getAttribute('width'))).toBeCloseTo(
      row.beforeMean * 4.5,
      4,
    );
    expect(Number(await demo.locator('.r-agg-bar-b').getAttribute('width'))).toBeCloseTo(
      row.afterMean * 4.5,
      4,
    );
    const whiskers = demo.locator('.r-agg-sd[x1]');
    for (const [i, mean, sd] of [
      [0, row.beforeMean, row.beforeSD],
      [1, row.afterMean, row.afterSD],
    ]) {
      expect(Number(await whiskers.nth(i).getAttribute('x1'))).toBeCloseTo(
        150 + Math.max(0, mean - sd) * 4.5,
        4,
      );
      expect(Number(await whiskers.nth(i).getAttribute('x2'))).toBeCloseTo(
        150 + Math.min(100, mean + sd) * 4.5,
        4,
      );
    }
    await expect(demo.getByRole('img')).toHaveAccessibleName(
      new RegExp(`${row.group} group tandem walking`),
    );
  }
  await page.getByLabel('Study group', { exact: true }).selectOption('Exercise');
  await page.getByLabel('Before bed rest', { exact: true }).selectOption('eyes-closed');
  await page.getByLabel('After bed rest', { exact: true }).selectOption('eyes-open');
  await expect(page.getByTestId('aggregate-result')).toContainText('Supported comparison withheld');
  await expect(page.getByTestId('aggregate-counterexample')).toContainText('+4.0');
});

test('initial action, quality chart and companion acknowledgment fit the demonstration viewports', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?legacy=1#mission/health');
  await expect(
    page.getByRole('button', { name: 'Find the missing exercise record', exact: true }),
  ).toBeInViewport({ ratio: 1 });
  await page
    .getByRole('button', { name: 'Interpret health and open watchlist', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Designate fictional HR monitoring requirement', exact: true })
    .click();
  await page.getByRole('link', { name: 'Open monitoring console', exact: true }).click();
  await page.getByRole('button', { name: 'Start replay', exact: true }).click();
  await expect
    .poll(async () => (await ledger(page)).runs.at(-1)?.cursor ?? 0, { timeout: 10000 })
    .toBeGreaterThanOrEqual(4);
  await page.getByRole('button', { name: 'Pause replay', exact: true }).click();
  await page.evaluate(() => scrollTo(0, 0));
  await expect(page.locator('.mc-current')).toBeInViewport({ ratio: 1 });
  await expect(page.locator('.mc-figure svg')).toBeInViewport({ ratio: 1 });
  await expect(page.locator('.mc-attention')).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('button', { name: 'Next sample', exact: true })).toBeInViewport({
    ratio: 1,
  });
  const popup = page.waitForEvent('popup');
  await page.getByRole('link', { name: 'Open companion in another tab', exact: true }).click();
  const c = await popup;
  await c.setViewportSize({ width: 390, height: 844 });
  await c.bringToFront();
  await expect(c.getByTestId('delivery-state').first()).toContainText('receipt persisted');
  await expect(c.getByTestId('companion')).toContainText(
    'neither viewport visibility nor human attention',
  );
  const ack = c.getByRole('button', { name: 'Acknowledge notification', exact: true }).first();
  await expect(ack).toBeInViewport({ ratio: 1 });
  await ack.click();
  await expect(c.getByTestId('ack-state').first()).toContainText('Acknowledged by');
  await c.close();
});

test('a rejected review write never promotes an earlier snapshot to a fresh saved confirmation', async ({
  page,
}) => {
  await page.goto('/?legacy=1#mission/health/review');
  await page.getByLabel('Future monitoring needs activity, time and quality context').check();
  await page.getByRole('button', { name: 'Save fictional review', exact: true }).click();
  await expect(page.locator('#m-handoff-title')).toHaveText('Review saved');
  const stored = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem('parallax.mission.v1')!).reviews);
  const before = await stored();
  await page.reload();
  await expect(page.locator('#m-handoff-title')).toHaveText('Saved review snapshot');
  await page.getByLabel('Future monitoring needs activity, time and quality context').check();
  await expect(
    page.getByRole('button', { name: 'Save fictional review', exact: true }),
  ).toBeEnabled();
  await page.evaluate(() =>
    localStorage.setItem('parallax.mission.v1', localStorage.getItem('parallax.mission.v1') + ' '),
  );
  await page.getByRole('button', { name: 'Save fictional review', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'pending action was not saved' }),
  ).toBeVisible();
  await expect(page.locator('#m-review-status')).toContainText('Review was not recorded');
  await expect(page.locator('#m-review-status')).toBeFocused();
  await expect(page.locator('#m-review-status')).toBeInViewport({ ratio: 1 });
  await expect(page.locator('#m-handoff-title')).toHaveText('Saved review snapshot');
  await expect(page.locator('.m-handoff-title .is-ok')).toHaveCount(0);
  expect(await stored()).toEqual(before);
});

test('an in-memory review has no durable-save confirmation or success mark', async ({ page }) => {
  await page.goto('/?legacy=1#mission/health/review');
  await page.getByLabel('Future monitoring needs activity, time and quality context').check();
  await expect(
    page.getByRole('button', { name: 'Save fictional review', exact: true }),
  ).toBeEnabled();
  await page.evaluate(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'parallax.mission.v1')
        throw new DOMException('review write denied', 'QuotaExceededError');
      return set.call(this, key, value);
    };
  });
  await page.getByRole('button', { name: 'Save fictional review', exact: true }).click();
  await expect(page.locator('#m-handoff-title')).toHaveText('Review recorded in memory only');
  await expect(page.locator('#m-review-status')).toContainText('recorded in memory only');
  await expect(page.locator('.m-handoff-title .is-ok')).toHaveCount(0);
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('parallax.mission.v1')!).reviews),
  ).toEqual([]);
  await page.reload();
  await expect(page.locator('#m-fictional-review-title')).toBeFocused();
  await expect(page.getByTestId('mission-handoff')).toHaveCount(0);
});

test('every mission and teaching deep link remains neutral under the historical evaluation flag', async ({
  page,
}) => {
  const routes = [
    'mission',
    'mission/health',
    'mission/health/assessments',
    'mission/health/watchlist',
    'mission/health/review',
    'mission/monitoring',
    'mission/companion',
    'discover',
    'research',
    'scenarios',
    'scenarios/missing-evidence/1',
    'monitor',
    'observations',
    'lens',
    'review',
    'science',
  ];
  for (const route of routes) {
    await page.goto(`/?evaluation=1#${route}`);
    await expect(page.locator('.app-shell')).toBeVisible();
    await expect(
      page.locator('.m-experience,.m-companion,[data-testid="aggregate-demo"]'),
    ).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('parallax.mission.v1'))).toBeNull();
    expect(
      await page.evaluate(async () =>
        (await indexedDB.databases()).some((db) => db.name === 'parallax.monitoring.v1'),
      ),
    ).toBe(false);
  }
});

test('leaving an active console disposes replay and returning requires explicit resume', async ({
  page,
}) => {
  await page.goto('/?legacy=1#mission/health/watchlist');
  await page
    .getByRole('button', { name: 'Designate fictional HR monitoring requirement', exact: true })
    .click();
  await page.getByRole('link', { name: 'Open monitoring console', exact: true }).click();
  await page.getByRole('button', { name: 'Start replay', exact: true }).click();
  await expect.poll(async () => (await ledger(page)).samples.length).toBeGreaterThan(0);
  await page.getByRole('link', { name: 'Return to health review', exact: true }).click();
  const read = () =>
    page.evaluate(async () => {
      const request = indexedDB.open('parallax.monitoring.v1', 1);
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      return new Promise<{ status: string; cursor: number }>((resolve, reject) => {
        const tx = db.transaction('runs', 'readonly');
        const get = tx.objectStore('runs').getAll();
        get.onsuccess = () => resolve(get.result.at(-1));
        get.onerror = () => reject(get.error);
        tx.oncomplete = () => db.close();
      });
    });
  await expect.poll(async () => (await read()).status).toBe('paused');
  const paused = await read();
  await page.waitForTimeout(1500);
  expect(await read()).toEqual(paused);
  await page
    .getByRole('navigation', { name: 'Mission sections' })
    .getByRole('link', { name: 'Monitoring', exact: true })
    .click();
  await expect(page.locator('#monitor-console-title')).toBeFocused();
  await expect(page.getByTestId('monitor-current')).toContainText('unavailable');
  await expect(page.getByRole('button', { name: 'Resume replay', exact: true })).toBeEnabled();
});

test('a hidden companion records no receipt; foreground render persists one receipt for the correct event', async ({
  page,
}) => {
  await page.goto('/?legacy=1#mission/health/watchlist');
  await page
    .getByRole('button', { name: 'Designate fictional HR monitoring requirement', exact: true })
    .click();
  await page.getByRole('link', { name: 'Open monitoring console', exact: true }).click();
  await page.getByRole('button', { name: 'Start replay', exact: true }).click();
  await expect
    .poll(async () => (await ledger(page)).runs.at(-1)?.cursor ?? 0, { timeout: 10000 })
    .toBeGreaterThanOrEqual(4);
  await page.getByRole('button', { name: 'Pause replay', exact: true }).click();
  const event = (await ledger(page)).events[0];
  const href = await page
    .getByRole('link', { name: 'Open companion in another tab', exact: true })
    .getAttribute('href');
  const c = await page.context().newPage();
  // Chromium automation keeps real tabs visible. Exercise the hidden-document branch explicitly;
  // this does not claim validation of native browser suspension or background delivery.
  await c.addInitScript(() =>
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }),
  );
  await c.goto('/' + href);
  await expect(c.getByTestId('event-monitoring-interruption')).toBeVisible();
  await c.waitForTimeout(1300);
  expect(
    (await ledger(page)).transitions.filter(
      (t: { kind: string }) => t.kind === 'displayed-receipt',
    ),
  ).toEqual([]);
  await expect(
    c.getByRole('button', { name: 'Acknowledge notification', exact: true }),
  ).toBeDisabled();
  await c.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(c.getByTestId('delivery-state').first()).toContainText('receipt persisted');
  await expect
    .poll(
      async () =>
        (await ledger(page)).transitions.filter(
          (t: { kind: string }) => t.kind === 'displayed-receipt',
        ).length,
    )
    .toBe(1);
  expect(
    (await ledger(page)).transitions.find((t: { kind: string }) => t.kind === 'displayed-receipt')
      .eventId,
  ).toBe(event.id);
  await c.close();
});

test('rapid Back into an already mounted console and repeated monitoring links restore heading focus', async ({
  page,
}) => {
  await page.goto('/?legacy=1#mission/health/watchlist');
  await page
    .getByRole('button', { name: 'Designate fictional HR monitoring requirement', exact: true })
    .click();
  await page.getByRole('link', { name: 'Open monitoring console', exact: true }).click();
  await expect(page.locator('#monitor-console-title')).toBeFocused();
  for (let i = 0; i < 3; i++) {
    await page.getByRole('link', { name: 'Return to health review', exact: true }).click();
    // Deliberately do not wait for the health route to finish rendering.
    await page.goBack();
    await expect(page.locator('#monitor-console-title')).toBeFocused();
    await page.waitForTimeout(400);
    await expect(page.locator('#monitor-console-title')).toBeFocused();
  }
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  await page
    .getByRole('navigation', { name: 'Mission sections' })
    .getByRole('link', { name: 'Monitoring', exact: true })
    .click();
  await expect(page.locator('#monitor-console-title')).toBeFocused();
  await expect(page.locator('#monitor-console-title')).toBeInViewport();
});
