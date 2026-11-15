import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { noHorizontalScroll, downloadText } from './helpers';
const key = 'parallax.mission.rich.v2';
const state = (page: Page) => page.evaluate((k) => localStorage.getItem(k), key);
async function retrieve(page: Page) {
  await page.goto('/#mission/health/assessments');
  await page.getByRole('button', { name: 'Inspect archive record', exact: true }).click();
  await expect(page.getByTestId('archive-source')).toHaveAttribute('open', '');
  await expect(page.getByTestId('archive-source').locator(':scope > summary')).toBeFocused();
  await page.getByLabel(/Confirm acquisition conditions/).check();
  await page.getByRole('button', { name: 'Add record to review', exact: true }).click();
  await expect(page.getByTestId('mission-summary-requirements')).toContainText('3 of 3');
}
for (const width of [320, 390, 768, 1024, 1440]) {
  test(`Phase 8 public routes and chart geometry at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of [
      'mission',
      'mission/preflight',
      'mission/transit',
      'mission/health',
      'mission/health/assessments',
      'mission/health/watchlist',
      'mission/monitoring',
      'mission/health/review',
      'mission/surface',
      'scenarios',
      'research',
      'discover',
    ]) {
      await page.goto('/#' + route);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await noHorizontalScroll(page);
      const tokens = await page.locator('.site').evaluate((e) => ({
        paper: getComputedStyle(e).getPropertyValue('--paper').trim(),
        ink: getComputedStyle(e).getPropertyValue('--ink').trim(),
      }));
      expect(tokens).toEqual({ paper: '#10171c', ink: '#f1f0e9' });
      const collisions = await page.locator('svg').evaluateAll((svgs) =>
        svgs.flatMap((svg) => {
          const texts = [...svg.querySelectorAll('text')].filter(
            (t) => t.getBoundingClientRect().width && getComputedStyle(t).display !== 'none',
          );
          if (svg.closest('.m-pair'))
            for (const label of [...svg.querySelectorAll('.p-value')])
              for (const point of [...svg.querySelectorAll('circle')]) {
                const a = label.getBoundingClientRect(),
                  b = point.getBoundingClientRect();
                if (
                  Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 &&
                  Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5
                )
                  return [['value label collides with observation point', label.textContent]];
              }
          return texts.flatMap((a, i) =>
            texts
              .slice(i + 1)
              .filter((b) => {
                const x = a.getBoundingClientRect(),
                  y = b.getBoundingClientRect();
                return (
                  Math.min(x.right, y.right) - Math.max(x.left, y.left) > 1 &&
                  Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top) > 1
                );
              })
              .map((b) => [a.textContent, b.textContent]),
          );
        }),
      );
      expect(collisions, route).toEqual([]);
    }
    await page.goto('/#mission/health');
    const pair = page.locator('.m-pair');
    await expect(pair.locator('svg circle')).toHaveCount(1);
    await expect(pair.locator('svg')).not.toContainText('in archive');
    await expect(pair.locator('.m-pair-missing')).toContainText('in archive');
    await page.screenshot({
      path: `test-results/browser-captures/phase8/health-${width}.png`,
      fullPage: true,
    });
  });
  test(`Phase 8 every demonstration step at ${width}px`, async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width, height: 1000 });
    for (const slug of [
      'complete-health-record',
      'exercise-response',
      'missing-evidence',
      'incompatible-measurements',
      'dependent-observations',
    ])
      for (let step = 1; step <= 5; step++) {
        await page.goto(`/#scenarios/${slug}/${step}`);
        await expect(page.locator('#step-title')).toBeVisible();
        await noHorizontalScroll(page);
        await expect(page.locator('.g-step')).toHaveAttribute('data-step', String(step));
        if (slug === 'complete-health-record' && step >= 2 && step <= 4) {
          const label = ['Postural response', 'Tandem performance', 'Task duration'][step - 2];
          const endpoint = ['cardio', 'tandem', 'task'][step - 2];
          await expect(page.locator('.g-progress .is-current')).toContainText(label);
          await expect(page.getByTestId(`bars-${endpoint}`)).toBeVisible();
        }
      }
  });
}
test('rich review retrieves, reassesses, undoes and reloads actual validated membership', async ({
  page,
}) => {
  await page.goto('/#mission/health');
  await expect(page.getByTestId('rich-vo2peak')).toContainText('2.8 → 2.7 L/min');
  await expect(page.getByTestId('rich-reported-sleep-duration')).toContainText('7.5 → 6.5 h');
  await expect(page.getByTestId('mission-summary-requirements')).toContainText('2 of 3');
  await retrieve(page);
  const after = JSON.parse((await state(page))!);
  expect(after.includedRecordIds).toContain('mars-hr-jun28');
  await page.reload();
  await expect(page.getByTestId('mission-summary-requirements')).toContainText('3 of 3');
  await page.getByRole('button', { name: 'Undo retrieval', exact: true }).click();
  await expect(page.getByTestId('mission-summary-requirements')).toContainText('2 of 3');
  await expect(page.getByTestId('rich-vo2peak')).toContainText('-0.1');
  await page.reload();
  expect(JSON.parse((await state(page))!).includedRecordIds).not.toContain('mars-hr-jun28');
});
test('chapters support direct routes, keyboard, history and reload without rewriting active work', async ({
  page,
}) => {
  await page.goto('/#mission/health');
  await expect.poll(() => state(page)).not.toBeNull();
  const before = await state(page);
  await page.getByRole('link', { name: 'Preflight', exact: true }).click();
  await expect(page.locator('#chapter-title')).toBeFocused();
  await expect(page.locator('main')).not.toContainText('2040-06-');
  expect(await state(page)).toBe(before);
  await page.getByRole('link', { name: 'Explore Transit', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#mission\/transit$/);
  await expect(page.locator('main')).toContainText('2.8 and 2.7');
  await page.goBack();
  await expect(page).toHaveURL(/#mission\/preflight$/);
  await page.goForward();
  await page.reload();
  await expect(page.locator('#chapter-title')).toContainText('transit');
  expect(await state(page)).toBe(before);
  await page.goto('/#mission/surface');
  await expect(page.locator('main')).toContainText('no validated mobility performance');
  expect(await state(page)).toBe(before);
});
test('surface information planning is real persisted fixed fictional state', async ({ page }) => {
  await page.goto('/#mission/surface');
  await page
    .getByRole('button', { name: 'Record fictional planning request', exact: true })
    .click();
  await expect(page.locator('main')).toContainText('Fictional planning request saved');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Planning request recorded' })).toBeDisabled();
  await page.getByText('Review saved request', { exact: true }).click();
  await expect(page.locator('main')).toContainText('surface-mobility');
  await page.getByRole('button', { name: 'Remove request', exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Record fictional planning request', exact: true }),
  ).toBeEnabled();
});
test('complete-data scenario operates real findings with exclude, undo, restart and explicit transfer', async ({
  page,
}) => {
  await page.goto('/#scenarios/complete-health-record/4');
  await expect(page.locator('.g-ledger')).toContainText('+5%');
  await expect(page.locator('.g-ledger')).toContainText('+15 bpm');
  await expect(page.locator('.g-ledger')).toContainText('−15 percentage points');
  await expect(page.locator('.g-ledger')).toContainText('+30%');
  for (const endpoint of [
    'Leg-press force',
    'Heart-rate response to standing',
    'Tandem walk, correct steps',
    'Stand-and-walk task time',
  ])
    await expect(
      page.getByText(`Inspect ${endpoint} source records`, { exact: false }),
    ).toBeVisible();
  await page.getByRole('button', { name: 'Exclude original follow-up' }).click();
  await expect(page.getByTestId('result-task')).toBeVisible();
  await expect(page.locator('.g-ledger')).toContainText('Record missing');
  await page.getByRole('button', { name: 'Undo entry' }).click();
  await expect(page.locator('.g-ledger')).not.toContainText('Record missing');
  await page.reload();
  await expect(page.locator('.g-ledger')).toContainText('+5%');
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await expect(page).toHaveURL(/complete-health-record\/1$/);
  await page.goto('/#scenarios/complete-health-record/5');
  await page.getByRole('button', { name: /workspace/i }).click();
  await expect(page).toHaveURL(/#monitor$/);
  await page.getByRole('button', { name: 'Evidence Lens', exact: true }).click();
  await page.getByTestId('claim-force').click();
  await expect(page.getByTestId('inspector')).toContainText('+5%');
});
test('monitoring empty state focuses designation and returns to actual replay', async ({
  page,
}) => {
  await page.goto('/#mission/monitoring');
  await page
    .getByRole('link', { name: 'Designate a heart-rate monitoring requirement', exact: true })
    .click();
  const designate = page.getByRole('button', {
    name: 'Designate fictional HR monitoring requirement',
  });
  await expect(designate).toBeFocused();
  await designate.click();
  await page.getByRole('link', { name: 'Open monitoring console', exact: true }).click();
  await expect(page.getByTestId('monitor-designation')).toContainText(
    'Current fictional HR designation',
  );
  await expect(page.getByRole('button', { name: 'Start replay', exact: true })).toBeEnabled();
});
test('rich canonical review survives reload, agrees in HTML/JSON and remains immutable after undo', async ({
  page,
  context,
}) => {
  await page.goto('/#mission/health');
  await retrieve(page);
  await page.getByRole('button', { name: 'View updated interpretation', exact: true }).click();
  await expect(page.getByTestId('watch-aerobic')).toContainText('2.8 → 2.7');
  await expect(page.getByTestId('watch-sleep')).toContainText('7.5 → 6.5');
  await page.getByLabel('Exercise records and limitations reviewed', { exact: true }).check();
  await page.getByRole('button', { name: 'Save fictional review' }).click();
  await expect(page.getByTestId('review-currency')).toContainText('Current review');
  const saved = JSON.parse((await state(page))!);
  expect(saved.reviews.at(-1).schemaVersion).toBe(2);
  expect(saved.reviews.at(-1).coverage.available).toBe(3);
  await page.goto('/#mission/health/review');
  await page.reload();
  await expect(page.getByTestId('review-currency')).toContainText('Current review');
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: /Download.*JSON/ }).click();
  const dl = await event;
  const json = JSON.parse(await readFile((await dl.path())!, 'utf8'));
  expect(json.snapshot).toEqual(saved.reviews.at(-1));
  await context.setOffline(true);
  await page.goto('/#mission/surface');
  await expect(page.locator('#chapter-title')).toBeVisible();
  await page.goto('/#scenarios/complete-health-record/4');
  await expect(page.locator('.g-ledger')).toContainText('+5%');
  await page.goto('/#mission/health/assessments');
  await page.getByRole('button', { name: 'Undo retrieval', exact: true }).click();
  expect(JSON.parse((await state(page))!).reviews.at(-1)).toEqual(saved.reviews.at(-1));
  await context.setOffline(false);
});
test('new public surfaces meet automated accessibility checks at phone and desktop widths', async ({
  page,
}) => {
  test.setTimeout(60000);
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of [
      'mission/preflight',
      'mission/health',
      'mission/surface',
      'scenarios/complete-health-record/4',
      'research',
    ]) {
      await page.goto('/#' + route);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(
        (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
          .violations,
        route,
      ).toEqual([]);
    }
  }
});

test('default rich mission supports actual replay, separate companion acknowledgment and canonical monitored review offline', async ({
  page,
  context,
}) => {
  test.setTimeout(60000);
  await page.goto('/#mission/health');
  await retrieve(page);
  await page.goto('/#mission/monitoring');
  await page
    .getByRole('link', { name: 'Designate a heart-rate monitoring requirement', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Designate fictional HR monitoring requirement', exact: true })
    .click();
  await page.getByRole('link', { name: 'Open monitoring console', exact: true }).click();
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
  const popup = page.waitForEvent('popup');
  await page.getByRole('link', { name: 'Open companion in another tab', exact: true }).click();
  const c = await popup;
  await expect(c.getByTestId('companion')).toBeVisible();
  await page.bringToFront();
  await page.getByRole('button', { name: 'Start replay', exact: true }).click();
  const ledger = async () =>
    JSON.parse((await page.getByTestId('monitor-ledger-json').textContent())!);
  await expect.poll(async () => (await ledger()).samples.length).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Pause replay', exact: true }).click();
  while ((await ledger()).runs.at(-1).cursor < 4) {
    const cursor = (await ledger()).runs.at(-1).cursor;
    await page.getByRole('button', { name: 'Next sample', exact: true }).click();
    await expect.poll(async () => (await ledger()).runs.at(-1).cursor).toBe(cursor + 1);
  }
  expect((await ledger()).samples[3].observation).toMatchObject({
    originalValue: 72,
    originalQualityCode: 2,
    usability: 'withheld',
  });
  await expect(page.getByTestId('monitor-current')).toContainText('unavailable');
  await c.bringToFront();
  await expect(c.getByTestId('delivery-state').first()).toContainText('receipt persisted');
  await c.getByRole('button', { name: 'Acknowledge notification', exact: true }).click();
  await expect(c.getByTestId('ack-state')).toContainText('Acknowledged by Fictional crew');
  await c.close();
  await page.bringToFront();
  await page.getByRole('link', { name: 'Return to health review', exact: true }).click();
  await page.getByRole('button', { name: 'Interpret health and open watchlist' }).click();
  await page
    .getByLabel('Future monitoring needs activity, time and quality context', { exact: true })
    .check();
  await page.getByRole('button', { name: 'Save fictional review', exact: true }).click();
  await expect(page.getByTestId('mission-handoff')).toBeVisible();
  const json = JSON.parse((await downloadText(page, 'Download review JSON')).body);
  const html = (await downloadText(page, 'Download mission review')).body;
  expect(JSON.parse(html.match(/id="canonical-review">(.*?)<\/script>/s)![1])).toEqual(json);
  expect(json.snapshot.schemaVersion).toBe(2);
  expect(json.snapshot.coverage).toMatchObject({ available: 3, total: 3 });
  expect(json.snapshot.monitoring.samples).toHaveLength(4);
  expect(json.snapshot.monitoring.acknowledgments).toHaveLength(1);
  await page.goto('/#mission/health/review');
  await page.reload();
  await expect(page.getByTestId('review-currency')).toContainText('Current review');
  await context.setOffline(false);
});

test('edited positive scenario records cannot retain original fixture teaching by identifier', async ({
  page,
}) => {
  await page.goto('/#scenarios/complete-health-record/1');
  await page.getByRole('button', { name: /Next/ }).click();
  await page.evaluate(() => {
    const key = 'parallax.guided.v1';
    const store = JSON.parse(localStorage.getItem(key)!);
    store.cases.complete.packet.observations[0].value = 1100;
    localStorage.setItem(key, JSON.stringify(store));
  });
  await page.reload();
  await expect(page.locator('#step-title')).toHaveText('Review the edited fictional records');
  await expect(page.getByTestId('edited-records')).toBeVisible();
  await expect(page.locator('.g-lede')).toContainText(
    'original scenario narrative no longer applies',
  );
});
