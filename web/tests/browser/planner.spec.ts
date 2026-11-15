import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { retrieveMissionRecord } from './missionHelpers';
import { noHorizontalScroll } from './helpers';
const key = 'parallax.mission.v1';
const saved = (page: import('@playwright/test').Page) =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), key);

test('initial missing review reaches source retrieval, real reassessment and unresolved mobility', async ({
  page,
}) => {
  await page.goto('/?legacy=1');
  await page.getByRole('link', { name: 'Begin mission review' }).click();
  await expect(page.getByTestId('mission-no-comparison')).toBeVisible();
  await expect(page.getByTestId('mission-summary-requirements')).toContainText(
    '0 of 2 approach items',
  );
  await expect(page.getByTestId('mission-exercise')).toContainText('was collected');
  const before = await saved(page);
  expect(before.includedRecordIds).not.toContain('mars-hr-jun28');
  expect(before.excludedRecordIds).toEqual([]);
  await page.getByRole('button', { name: 'Find the missing exercise record' }).click();
  await expect(page.locator('#m-planner-title')).toBeFocused();
  const headingTop = await page
    .locator('#m-planner-title')
    .evaluate((el) => el.getBoundingClientRect().top);
  const headerBottom = await page
    .locator('.s-header')
    .evaluate((el) =>
      getComputedStyle(el).position === 'sticky' ? el.getBoundingClientRect().bottom : 0,
    );
  expect(headingTop).toBeGreaterThanOrEqual(headerBottom);

  const exercise = page.getByTestId('assessment-exercise');
  await expect(exercise).toContainText('Existing record retrievable');
  await exercise.getByText('Inspect fictional exercise archive source', { exact: true }).click();
  const source = page.getByTestId('archive-source');
  for (const text of [
    '140 bpm',
    '100 W',
    'final-minute',
    '2040-06-28T10:00:00Z',
    'fictional-hr-monitor-01',
    'fictional-cycling-hr-v1',
    'Archive only',
  ])
    await expect(source).toContainText(text);
  const add = page.getByRole('button', { name: 'Add record to review' });
  await expect(add).toBeDisabled();
  await page.getByLabel('I reviewed the fictional acquisition conditions').check();
  await add.click();
  const after = await saved(page);
  expect(after.includedRecordIds).toContain('mars-hr-jun28');
  expect(after.evidenceRevision).toBe(before.evidenceRevision + 1);
  expect(after.sessionId).toBe(before.sessionId);
  await expect(page.getByTestId('mission-chart')).toContainText('+15 bpm');
  await expect(page.getByTestId('mission-summary-observations')).toContainText('+15 bpm');
  await expect(page.getByTestId('mission-summary-requirements')).toContainText(
    '1 of 2 approach items',
  );
  await expect(page.getByTestId('mission-planner').getByRole('status')).toContainText(
    'The evaluator now supports +15 bpm',
  );
  await expect(exercise).toContainText('Information available');
  await expect(add).toHaveCount(0);
  await expect(page.getByTestId('mission-mobility')).toContainText('remain unestablished');
  await expect(page.getByTestId('mission-summary-disposition')).toContainText(
    'No human review recorded',
  );
});

test('retrieval removal and reviewer exclusion remain distinct through reload and resume', async ({
  page,
}) => {
  await page.goto('/?legacy=1#mission/health');
  await retrieveMissionRecord(page);
  await page.getByLabel('Include retrieved record in comparison').uncheck();
  const excluded = await saved(page);
  expect(excluded.includedRecordIds).toContain('mars-hr-jun28');
  expect(excluded.excludedRecordIds).toContain('mars-hr-jun28');
  await expect(page.getByTestId('assessment-exercise')).toContainText(
    'Record intentionally excluded',
  );
  await expect(page.getByTestId('mission-chart')).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: 'Plan missing assessments' }).click();
  await expect(page.getByLabel('Include retrieved record in comparison')).not.toBeChecked();
  await expect(page.getByRole('button', { name: 'Add record to review' })).toHaveCount(0);
  await page.getByLabel('Include retrieved record in comparison').check();
  await expect(page.getByTestId('mission-chart')).toContainText('+15 bpm');
  await page.getByRole('button', { name: 'Undo retrieval' }).click();
  const removed = await saved(page);
  expect(removed.includedRecordIds).not.toContain('mars-hr-jun28');
  expect(removed.excludedRecordIds).toEqual([]);
  expect(removed.evidenceRevision).toBe(excluded.evidenceRevision + 2);
  await expect(page.getByTestId('mission-planner').getByRole('status')).toContainText(
    'Retrieval undone',
  );
  await expect(page.getByTestId('mission-summary-requirements')).toContainText('0 of 2');
  await page.reload();
  await expect(page.getByTestId('mission-chart')).toHaveCount(0);
  await page.getByRole('link', { name: 'Mission', exact: true }).click();
  await page.getByRole('link', { name: 'Resume mission review' }).click();
  await retrieveMissionRecord(page);
  await expect(page.getByTestId('mission-summary-requirements')).toContainText('1 of 2');
});

test('restart changes session identity and restores a genuinely absent follow-up', async ({
  page,
}) => {
  await page.goto('/?legacy=1#mission/health');
  await retrieveMissionRecord(page);
  const before = await saved(page);
  await page.getByRole('button', { name: 'Restart mission', exact: true }).click();
  await page.getByRole('button', { name: 'Restart mission review', exact: true }).click();
  await page.getByRole('link', { name: 'Begin mission review' }).click();
  const after = await saved(page);
  expect(after.sessionId).not.toBe(before.sessionId);
  expect(after.evidenceRevision).toBe(1);
  expect(after.includedRecordIds).not.toContain('mars-hr-jun28');
  await expect(page.getByTestId('mission-no-comparison')).toBeVisible();
  await expect(page.getByTestId('mission-summary-requirements')).toContainText('0 of 2');
});

test('schema 1 reset is explicit and leaves unrelated stores byte-identical', async ({ page }) => {
  await page.goto('/?legacy=1');
  await expect(page.getByRole('link', { name: 'Begin mission review' })).toBeVisible();
  await expect.poll(() => page.evaluate((k) => localStorage.getItem(k), key)).not.toBeNull();
  await page.evaluate((k) => {
    const state = JSON.parse(localStorage.getItem(k)!);
    const { context, fixtureRevision } = state;
    localStorage.setItem(
      k,
      JSON.stringify({
        schemaVersion: 1,
        context,
        fixtureRevision,
        entered: true,
        excludedRecordIds: [],
        evidenceRevision: 9,
      }),
    );
    localStorage.setItem('parallax.guided.v1', 'unrelated guided raw state');
    localStorage.setItem('parallax.synthetic.session.v1', 'unrelated advanced raw state');
  }, key);
  await page.reload();
  await expect(page.getByRole('status').filter({ hasText: 'older record model' })).toBeVisible();
  await page.getByRole('link', { name: 'Begin mission review' }).click();
  await expect(page.getByTestId('mission-no-comparison')).toBeVisible();
  expect(
    await page.evaluate(() => [
      localStorage.getItem('parallax.guided.v1'),
      localStorage.getItem('parallax.synthetic.session.v1'),
    ]),
  ).toEqual(['unrelated guided raw state', 'unrelated advanced raw state']);
});

test('planner exposes concurrent resource blockers and offers no unsafe or browser medical assessment', async ({
  page,
}) => {
  await page.goto('/?legacy=1#mission/health');
  await page.getByRole('button', { name: 'Plan missing assessments' }).click();
  const planner = page.getByTestId('mission-planner');
  const aerobic = page.getByTestId('assessment-aerobic');
  for (const text of [
    'Appropriate equipment unavailable',
    'Qualified assistance required',
    'Qualified supervision required',
    'Protocol not established',
    'cannot establish either requirement',
    'No VO2max estimate',
  ])
    await expect(aerobic).toContainText(text);
  const mobility = page.getByTestId('assessment-mobility');
  for (const text of [
    'Future-phase requirement',
    'Environment incompatible',
    'Research-only option',
    'not validated Mars protocols',
  ])
    await expect(mobility).toContainText(text);
  // Phase 6 list-detail: the obtainable exercise record is selected first; other details are
  // reached by selecting their tab. Their text stays in the DOM for the assertions above.
  await expect(planner.getByRole('tab', { name: /Recorded exercise response/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(mobility).toBeHidden();
  await planner.getByRole('tab', { name: /Post-landing balance and mobility/ }).click();
  await expect(mobility).toBeVisible();
  await mobility.getByText('Equipment, assistance and scientific basis', { exact: true }).click();
  await expect(mobility.getByRole('link', { name: /SM-204/ })).toHaveAttribute(
    'href',
    'https://humanresearchroadmap.nasa.gov/gaps/gap.aspx?i=695',
  );
  await expect(page.getByTestId('assessment-force')).toContainText(
    'neither change nor current strength',
  );
  await expect(page.getByTestId('assessment-pulse-oximetry')).toContainText(
    'Potential equipment-assisted self-measurement',
  );
  await expect(page.getByTestId('assessment-sleep')).toContainText('Protocol not established');
  await expect(page.getByTestId('assessment-alertness')).toContainText('Research-only option');
  await expect(
    planner.locator('input:not([type="checkbox"]), textarea, canvas, video'),
  ).toHaveCount(0);
  await expect(
    planner.getByRole('link', { name: 'Explore surface assessment requirements', exact: true }),
  ).toBeVisible(); // actions review requirements; no physical collection control
  await planner.getByRole('tab', { name: /Recorded exercise response/ }).click();
  await retrieveMissionRecord(page); // open control is idempotent
  await expect(mobility).not.toContainText('Information available');
  await expect(page.getByTestId('mission-summary-requirements')).toContainText('1 of 2');
});

for (const width of [1440, 390, 320])
  test(`planner source and retrieval work by keyboard at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/?legacy=1#mission/health');
    const open = page.getByRole('button', { name: 'Plan missing assessments' });
    await open.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#m-planner-title')).toBeFocused();
    await expect
      .poll(() =>
        page.locator('#m-planner-title').evaluate((el) => {
          const header = document.querySelector('.s-header')!;
          const bottom =
            getComputedStyle(header).position === 'sticky'
              ? header.getBoundingClientRect().bottom
              : 0;
          return el.getBoundingClientRect().top >= bottom;
        }),
      )
      .toBe(true);
    const source = page.getByText('Inspect fictional exercise archive source', { exact: true });
    await source.focus();
    await page.keyboard.press('Enter');
    const ack = page.getByLabel('I reviewed the fictional acquisition conditions');
    await ack.focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Add record to review' })).toBeFocused();
    await noHorizontalScroll(page);
    const before = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(before.violations).toEqual([]);
    await page.keyboard.press('Enter');
    await expect(page.locator('#m-planner-title')).toBeFocused();
    await expect
      .poll(() =>
        page.locator('#m-planner-title').evaluate((el) => {
          const header = document.querySelector('.s-header')!;
          const bottom =
            getComputedStyle(header).position === 'sticky'
              ? header.getBoundingClientRect().bottom
              : 0;
          return el.getBoundingClientRect().top >= bottom;
        }),
      )
      .toBe(true);
    await expect(page.getByTestId('mission-planner').getByRole('status')).toContainText('+15 bpm');
    await noHorizontalScroll(page);
    const undo = page.getByRole('button', { name: 'Undo retrieval' });
    await undo.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#m-planner-title')).toBeFocused();
    await expect
      .poll(() =>
        page.locator('#m-planner-title').evaluate((el) => {
          const header = document.querySelector('.s-header')!;
          const bottom =
            getComputedStyle(header).position === 'sticky'
              ? header.getBoundingClientRect().bottom
              : 0;
          return el.getBoundingClientRect().top >= bottom;
        }),
      )
      .toBe(true);
    await expect(page.getByTestId('mission-summary-requirements')).toContainText('0 of 2');
  });

test('production cache supports source retrieval and resume while offline', async ({
  page,
  context,
}) => {
  const external: string[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith('http://127.0.0.1:4173/')) external.push(r.url());
  });
  await page.goto('/?legacy=1');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('link', { name: 'Begin mission review' }).click();
  await retrieveMissionRecord(page);
  await page.reload();
  await expect(page.getByTestId('mission-chart')).toContainText('+15 bpm');
  await page.getByRole('button', { name: 'Plan missing assessments' }).click();
  await page.getByRole('button', { name: 'Undo retrieval' }).click();
  await page.reload();
  await expect(page.getByTestId('mission-no-comparison')).toBeVisible();
  expect(external).toEqual([]);
});

test('evaluation planner deep links remain neutral and do not rewrite existing mission state', async ({
  page,
}) => {
  await page.goto('/?legacy=1#mission/health');
  await retrieveMissionRecord(page);
  const before = await page.evaluate((k) => localStorage.getItem(k), key);
  await page.goto('/?evaluation=1#mission/health/planner');
  await expect(page.locator('.app-shell')).toBeVisible();
  await expect(page.getByTestId('mission-planner')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Plan missing assessments' })).toHaveCount(0);
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBe(before);
});

test('fresh mission entry stays within the 350 KB JavaScript budget', async ({
  page,
}, testInfo) => {
  const assets = new Set<string>();
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/assets/') && url.pathname.endsWith('.js'))
      assets.add(url.pathname);
  });
  await page.goto('/?legacy=1');
  await expect(page.getByRole('link', { name: 'Begin mission review' })).toBeVisible();
  const files = await Promise.all(
    [...assets].map(async (url) => ({
      url,
      bytes: (await stat(resolve('dist', url.slice(1)))).size,
    })),
  );
  const bytes = files.reduce((sum, file) => sum + file.bytes, 0);
  expect(bytes).toBeGreaterThan(0);
  expect(bytes).toBeLessThanOrEqual(350000);
  await testInfo.attach('fresh-mission-entry-js', {
    body: JSON.stringify({ bytes, files }),
    contentType: 'application/json',
  });
});
