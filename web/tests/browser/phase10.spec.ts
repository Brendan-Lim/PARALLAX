import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const key = 'parallax.mission.rich.v2.guided.v1';
const guide = (p: Page) => p.getByRole('complementary', { name: 'Guided mission demonstration' });
const mission = (p: Page) => p.evaluate((k) => JSON.parse(localStorage.getItem(k)!), key);
async function visibleTarget(p: Page, id: string) {
  await expect(p.locator('id=' + id)).toBeFocused();
  await expect
    .poll(() =>
      p.locator('id=' + id).evaluate((el) => {
        const box = el.getBoundingClientRect(),
          g = document.querySelector('.m-guide');
        const ceiling = Math.max(
          document.querySelector('.s-header')?.getBoundingClientRect().bottom ?? 0,
          g && getComputedStyle(g).position === 'sticky' ? g.getBoundingClientRect().bottom : 0,
        );
        return box.top >= ceiling && box.bottom <= innerHeight;
      }),
    )
    .toBe(true);
}
async function save(p: Page) {
  await p.getByLabel('Post-landing function remains unknown', { exact: true }).check();
  await p.getByRole('button', { name: 'Save fictional review', exact: true }).click();
  await expect(p.locator('#m-handoff-title')).toHaveText('Review saved');
  await visibleTarget(p, 'm-handoff-title');
  await expect(p.locator('#m-health-actions-title')).toBeInViewport({ ratio: 1 });
  await expect(
    p.getByRole('link', { name: 'Plan surface assessment', exact: true }),
  ).toBeInViewport({ ratio: 1 });
}
async function replay(p: Page, count = 8) {
  await p.goto('/?demo=full#mission/health/assessments');
  await p.getByRole('button', { name: 'Inspect archive record', exact: true }).click();
  await p.getByLabel(/Confirm acquisition conditions/).check();
  await p.getByRole('button', { name: 'Add record to review', exact: true }).click();
  await guide(p).getByRole('button', { name: 'Set up heart-rate monitoring', exact: true }).click();
  await p.locator('#m-designate').click();
  await p.getByRole('link', { name: 'Health watchlist', exact: true }).click();
  await guide(p).getByRole('button', { name: 'Set up heart-rate monitoring', exact: true }).click();
  await visibleTarget(p, 'm-designation-status');
  await guide(p)
    .getByRole('button', { name: 'Inspect the two simulated sources', exact: true })
    .click();
  await guide(p).getByRole('button', { name: 'Start synthetic replay', exact: true }).click();
  for (let i = 1; i < count; i++) {
    await expect(p.locator('#mc-next')).toBeEnabled();
    await p.locator('#mc-next').click();
  }
}
for (const [width, height] of [
  [1440, 900],
  [390, 844],
  [320, 740],
  [720, 450],
]) {
  test(`save reveals the newly persisted result and action plan at ${width}x${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/?demo=full#mission/health/review');
    await save(page);
    const review = (await mission(page)).reviews.at(-1);
    await expect(page.locator('#m-review-history')).toHaveValue(review.id);
    await expect(page.getByTestId('post-review-actions')).toContainText('1,000 N');
    await expect(page.getByTestId('post-review-actions')).toContainText(
      'Current comparable strength information is unavailable',
    );
    await page.screenshot({ path: `test-results/phase10/save-${width}x${height}.png` });
    const scroll = await page.evaluate(() => scrollY);
    await page.waitForTimeout(1700); // Observe more than one background reconciliation, never used to reveal a result.
    expect(await page.evaluate(() => scrollY)).toBe(scroll);
    await expect(page.locator('#m-handoff-title')).toBeFocused();
    await page.reload();
    expect((await mission(page)).reviews.at(-1)).toEqual(review);
    await expect(page.getByTestId('post-review-actions')).toBeAttached();
  });
}
test('completed replay without companion recovers at the actual event and requires an updated cutoff', async ({
  page,
}) => {
  test.setTimeout(60000);
  await replay(page);
  await expect(page.getByTestId('replay-state')).toContainText('completed');
  await guide(page).getByText('Actual completion and navigation', { exact: true }).click();
  await guide(page)
    .getByRole('button', { name: 'Human review · still to review', exact: true })
    .click();
  await save(page);
  const before = (await mission(page)).reviews.at(-1);
  expect(before.monitoring.samples).toHaveLength(8);
  expect(before.monitoring.acknowledgments).toHaveLength(0);
  await expect(guide(page)).toContainText('Local review and guide progress are separate');
  await page.screenshot({ path: 'test-results/phase10/prerequisite-recovery.png' });
  const popup = page.waitForEvent('popup');
  await guide(page)
    .getByRole('link', { name: 'Open companion and acknowledge', exact: true })
    .click();
  const c = await popup;
  await expect(c.getByTestId('companion')).toContainText('HR signal interrupted');
  const eventId = before.monitoring.events.find(
    (e: { type: string }) => e.type === 'monitoring-interruption',
  ).id;
  expect(new URL(c.url()).searchParams.get('event')).toBe(eventId);
  await visibleTarget(c, 'event-' + eventId);
  const interruptions = c.getByTestId('event-monitoring-interruption');
  for (let i = 0; i < (await interruptions.count()); i++) {
    await interruptions
      .nth(i)
      .getByRole('button', { name: 'Acknowledge notification', exact: true })
      .click();
    await expect(interruptions.nth(i).getByTestId('ack-state')).toContainText('Acknowledged by');
  }
  await expect(c.getByTestId('ack-state').first()).toContainText('Acknowledged by');
  await c.close();
  await page.bringToFront();
  await expect(
    guide(page).getByRole('button', { name: 'Save an updated review', exact: true }),
  ).toBeVisible();
  expect((await mission(page)).reviews.at(-1)).toEqual(before);
  await expect(page.getByTestId('post-review-actions')).toContainText('acknowledgment recorded');
  await guide(page).getByRole('button', { name: 'Save an updated review', exact: true }).click();
  await visibleTarget(page, 'm-fictional-review-title');
  await save(page);
  const after = (await mission(page)).reviews.at(-1);
  expect(after.id).not.toBe(before.id);
  expect(after.monitoring.acknowledgments.length).toBeGreaterThan(0);
  await expect(
    guide(page).getByRole('button', { name: 'Continue to surface planning', exact: true }),
  ).toBeVisible();
  await page.locator('#m-review-history').selectOption(before.id);
  expect((await mission(page)).reviews[0]).toEqual(before);
  await expect(page.getByTestId('post-review-actions')).toContainText(
    'A later saved review is available',
  );
  await expect(page.getByTestId('review-currency')).toContainText('Historical snapshot');
  await page.screenshot({ path: 'test-results/phase10/updated-cutoff.png' });
});
test('surface and strength plans use existing bounded records and survive reload without rewriting reviews', async ({
  page,
}) => {
  await page.goto('/?demo=short#mission/health/review');
  await save(page);
  const review = (await mission(page)).reviews.at(-1);
  await page.getByRole('link', { name: 'Plan surface assessment', exact: true }).click();
  await expect(page.locator('#surface-requirements')).toHaveAttribute('open', '');
  await visibleTarget(page, 'surface-requirements-title');
  await page
    .getByRole('button', { name: 'Record fictional planning request', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Planning request recorded', exact: true }),
  ).toBeDisabled();
  await page.getByRole('link', { name: 'Approach', exact: true }).first().click();
  await page.getByRole('link', { name: 'Review', exact: true }).click();
  await expect(page.getByTestId('post-review-actions')).toContainText(
    'Planning request recorded locally for qualified review',
  );
  await page.getByRole('link', { name: 'Inspect saved surface request', exact: true }).click();
  await visibleTarget(page, 'saved-request-surface-mobility-title');
  await expect(page.locator('#saved-request-surface-mobility')).toHaveAttribute('open', '');
  await page.reload();
  await expect(page.locator('#saved-request-surface-mobility')).toHaveAttribute('open', '');
  await page.getByRole('link', { name: 'Approach', exact: true }).first().click();
  await page.getByRole('link', { name: 'Review', exact: true }).click();
  await page.getByRole('link', { name: 'Review strength requirements', exact: true }).click();
  await expect(page.locator('#m-task-force')).toHaveAttribute('aria-selected', 'true');
  await page
    .getByTestId('assessment-force')
    .getByRole('button', { name: 'Review required resources', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Record fictional planning request', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Planning request recorded', exact: true }),
  ).toBeDisabled();
  await page.reload();
  await page.getByRole('link', { name: 'Review', exact: true }).click();
  const actions = page.getByTestId('post-review-actions');
  await expect(
    actions.locator('article').filter({ hasText: 'Musculoskeletal performance' }),
  ).toContainText('Planning request recorded locally');
  expect((await mission(page)).reviews.at(-1)).toEqual(review);
});
test('memory-only failure reveals the explanation, retains selections and never focuses an old review', async ({
  page,
}) => {
  await page.goto('/?demo=full#mission/health/review');
  await save(page);
  const before = (await mission(page)).reviews;
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k === 'parallax.mission.rich.v2.guided.v1') throw Error('test storage full');
      return original.call(this, k, v);
    };
  });
  await page.getByRole('button', { name: 'Save fictional review', exact: true }).click();
  await visibleTarget(page, 'm-review-status');
  await expect(page.locator('#m-review-status')).toContainText('memory only');
  await expect(
    page.getByLabel('Post-landing function remains unknown', { exact: true }),
  ).toBeChecked();
  await expect(page.locator('.m-handoff-title .is-ok')).toHaveCount(0);
  await expect(guide(page)).toContainText('cannot confirm completion');
  expect((await mission(page)).reviews).toEqual(before);
});
test('monitoring reconciliation never moves focus or scroll after an explicit inspection', async ({
  page,
}) => {
  await replay(page, 4);
  await page
    .getByText('Inspect replay source and persisted parser output', { exact: true })
    .click();
  const active = await page.evaluate(() => document.activeElement?.outerHTML);
  const scroll = await page.evaluate(() => scrollY);
  await page.waitForTimeout(1700);
  expect(await page.evaluate(() => scrollY)).toBe(scroll);
  expect(await page.evaluate(() => document.activeElement?.outerHTML)).toBe(active);
});
test('post-review presentation passes automated accessibility checks and keeps snapshot selection immutable', async ({
  page,
}) => {
  await page.goto('/?demo=full#mission/health/review');
  await save(page);
  const first = (await mission(page)).reviews[0];
  await save(page);
  await page.locator('#m-review-history').selectOption(first.id);
  expect((await mission(page)).reviews[0]).toEqual(first);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('cold chapter navigation waits for the actual lazy guide before revealing the heading', async ({
  browser,
}) => {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  let release!: () => void;
  const mounted = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(/\/assets\/MissionGuide-.*\.js$/, async (route) => {
    await mounted;
    await route.continue();
  });
  try {
    await page.goto('/');
    await page.getByRole('link', { name: 'Start guided mission demo', exact: true }).click();
    await expect(page.locator('#chapter-title')).toBeAttached();
    await expect(
      page.getByRole('status').filter({ hasText: 'Opening mission guide' }),
    ).toBeVisible();
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await expect(page.locator('#chapter-title')).not.toBeFocused();
    release();
    await visibleTarget(page, 'chapter-title');
    await page.screenshot({ path: 'test-results/phase10/cold-guide-mounted.png' });
  } finally {
    release();
    await context.close();
  }
});
