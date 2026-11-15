import { expect, test, type Page } from '@playwright/test';
import { retrieveMissionRecord } from './missionHelpers';
import type { Ledger } from '../../src/monitoring/model';

async function ledger(page: Page): Promise<Ledger> {
  return JSON.parse((await page.getByTestId('monitor-ledger-json').textContent())!);
}

test('mission sidebar and section deep links reveal the same real sections', async ({ page }) => {
  await page.goto('/?legacy=1#mission/health');
  const nav = page.getByRole('navigation', { name: 'Mission sections' });
  await expect(nav.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
  await nav.getByRole('link', { name: 'Assessments' }).click();
  await expect(page.locator('#m-planner-title')).toBeFocused();
  await expect(nav.getByRole('link', { name: 'Assessments' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page).toHaveURL(/#mission\/health\/assessments$/);
  await page.goto('/?legacy=1#mission/health/watchlist');
  await expect(page.locator('#m-interpretation-title')).toBeFocused();
  await page.goto('/?legacy=1#mission/monitoring');
  await expect(nav.getByRole('link', { name: 'Monitoring' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await nav.getByRole('link', { name: 'Review' }).click();
  await expect(page.locator('#m-fictional-review-title')).toBeFocused();
});

test('a freshly loaded or reloaded assessments link opens and focuses the planner', async ({
  page,
}) => {
  // The first session write can remount the planner; focus must survive it.
  const settled = async () => {
    await expect(page.locator('#m-planner-title')).toBeFocused();
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('m-planner-title');
    await expect(page.locator('#m-planner-title')).toBeInViewport();
  };
  await page.goto('/?legacy=1#mission/health/assessments');
  await settled();
  await page.reload();
  await settled();
});

test('planner is a list-detail tablist driven by evaluator reasons', async ({ page }) => {
  await page.goto('/?legacy=1#mission/health');
  await page.getByRole('button', { name: 'Plan missing assessments', exact: true }).click();
  const planner = page.getByTestId('mission-planner');
  const exerciseTab = planner.getByRole('tab', { name: /Recorded exercise response/ });
  await expect(exerciseTab).toHaveAttribute('aria-selected', 'true');
  await expect(exerciseTab).toContainText('Record retrievable');
  await expect(page.getByTestId('assessment-exercise')).toBeVisible();
  await expect(page.getByTestId('assessment-aerobic')).toBeHidden();
  await exerciseTab.focus();
  await page.keyboard.press('ArrowDown');
  const aerobicTab = planner.getByRole('tab', { name: /Aerobic capacity/ });
  await expect(aerobicTab).toBeFocused();
  await expect(aerobicTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('assessment-aerobic')).toBeVisible();
  await expect(page.getByTestId('assessment-exercise')).toBeHidden();
  await exerciseTab.click();
  await retrieveMissionRecord(page);
  await expect(exerciseTab).toContainText('Information available');
  await expect(planner.getByRole('tab', { name: /Post-landing balance/ })).toContainText(
    'Future phase',
  );
});

test('paired chart draws one point and no difference until the evaluator supports two', async ({
  page,
}) => {
  await page.goto('/?legacy=1#mission/health');
  const before = page.getByTestId('mission-no-comparison');
  await expect(before.getByRole('img')).toHaveAccessibleName(
    'One recorded exercise observation in this review',
  );
  await expect(before).toContainText('125 bpm');
  await expect(before).toContainText('28 June: in archive, not in this review');
  await expect(page.locator('.m-pair .p-late')).toHaveCount(0);
  await expect(page.locator('.m-pair .p-bar')).toHaveCount(0);
  await retrieveMissionRecord(page);
  const chart = page.getByTestId('mission-chart');
  await expect(chart.locator('.p-bar')).toHaveCount(1);
  await expect(chart).toContainText('125 bpm');
  await expect(chart).toContainText('140 bpm');
});

test('console readout separates withheld raw value from last usable value and breaks the line', async ({
  page,
}) => {
  await page.goto('/?legacy=1#mission/health');
  await page.getByRole('button', { name: 'Interpret health and open watchlist' }).click();
  await page
    .getByRole('button', { name: 'Designate fictional HR monitoring requirement', exact: true })
    .click();
  await page.getByRole('link', { name: 'Open monitoring console', exact: true }).click();
  await expect(page.locator('.mc-tracker .is-pending')).toHaveCount(8);
  await page.getByRole('button', { name: 'Start replay', exact: true }).click();
  await expect.poll(async () => (await ledger(page)).samples.length).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Pause replay', exact: true }).click();
  while ((await ledger(page)).runs.at(-1)!.cursor < 4) {
    const n = (await ledger(page)).runs.at(-1)!.cursor;
    await page.getByRole('button', { name: 'Next sample', exact: true }).click();
    await expect.poll(async () => (await ledger(page)).runs.at(-1)!.cursor).toBe(n + 1);
  }
  const readout = page.locator('.mc-readout');
  await expect(page.getByTestId('monitor-current')).toContainText('unavailable');
  await expect(readout).toContainText('Withheld raw reading');
  await expect(readout).toContainText('72 bpm at 3 s');
  await expect(readout).toContainText('quality code 2');
  await expect(readout).toContainText('Last usable observation');
  await expect(readout).toContainText('72 bpm at 2 s');
  await expect(page.locator('.mc-tracker .is-usable')).toHaveCount(3);
  await expect(page.locator('.mc-tracker .is-withheld')).toHaveCount(1);
  await expect(page.locator('.mc-tracker .is-pending')).toHaveCount(4);
  // Only 0→1 s and 1→2 s are joined; nothing crosses the withheld 3 s sample.
  await expect(page.locator('.mc-figure .mc-line')).toHaveCount(2);
  await expect(page.locator('.mc-figure .mc-pt-w')).toHaveCount(1);
  await expect(page.locator('.mc-attention')).toContainText('HR signal interrupted');
});

test('review shows a check-answers summary and an honest saved confirmation', async ({ page }) => {
  await page.goto('/?legacy=1#mission/health');
  await retrieveMissionRecord(page);
  await page.getByRole('button', { name: 'Interpret health and open watchlist' }).click();
  const summary = page
    .getByRole('definition')
    .filter({ hasText: '+15 bpm between 15 and 28 June' });
  await expect(summary).toBeVisible();
  await expect(page.locator('.m-summary-list')).toContainText('No synthetic replay recorded');
  await page.getByLabel('Exercise records and limitations reviewed').check();
  await page.getByRole('button', { name: 'Save fictional review', exact: true }).click();
  const handoff = page.getByTestId('mission-handoff');
  await expect(handoff.getByRole('heading', { name: 'Review saved' })).toBeVisible();
  await expect(handoff).toContainText('None. This records a review, not a medical decision.');
  await expect(page.locator('.m-experience')).not.toContainText(
    /cleared|safe to land|readiness achieved/i,
  );
  await expect(page.getByTestId('review-currency')).toContainText('Current review');
  const stored = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem('parallax.mission.v1')!).reviews);
  const before = await stored();
  expect(before).toHaveLength(1);
  // Removing the retrieved evidence makes the saved review stale under the existing policy.
  await page.getByRole('button', { name: 'Plan missing assessments', exact: true }).click();
  await page.getByRole('button', { name: 'Undo retrieval' }).click();
  await expect(page.getByTestId('mission-no-comparison')).toBeVisible();
  await expect(page.getByTestId('review-currency')).toContainText('Stale review');
  await expect(handoff.getByRole('heading', { name: 'Review saved', exact: true })).toHaveCount(0);
  await expect(
    handoff.getByRole('heading', { name: 'Saved review snapshot · historical', exact: true }),
  ).toBeVisible();
  await expect(handoff).toContainText(before[0].id);
  expect(await stored()).toEqual(before);
  await page.reload();
  await page.getByRole('button', { name: 'Interpret health and open watchlist' }).click();
  await expect(page.getByTestId('review-currency')).toContainText('Stale review');
  await expect(
    page
      .getByTestId('mission-handoff')
      .getByRole('heading', { name: 'Saved review snapshot · historical', exact: true }),
  ).toBeVisible();
  expect(await stored()).toEqual(before);
});

test('research chart flips between a supported and a withheld comparison', async ({ page }) => {
  await page.goto('/#research');
  const demo = page.getByTestId('aggregate-demo');
  await expect(demo.locator('.r-agg-bar-b')).toHaveCount(1);
  await expect(page.getByTestId('aggregate-result')).toContainText('-21.3');
  // Whiskers inside 0–100% carry no clip marker.
  await expect(demo.locator('.r-agg-clip')).toHaveCount(0);
  await page.getByLabel('After bed rest', { exact: true }).selectOption('eyes-open');
  await expect(demo.locator('.r-agg-bar-x')).toHaveCount(1);
  await expect(demo.locator('.r-agg-bar-b')).toHaveCount(0);
  await expect(page.getByTestId('aggregate-result')).toContainText('Supported comparison withheld');
  await expect(demo.getByRole('img')).toHaveAccessibleName(
    /Conditions differ: no supported difference/,
  );
  await page.getByLabel('Before bed rest', { exact: true }).selectOption('eyes-open');
  await expect(page.getByTestId('aggregate-result')).toContainText('-10.6');
  // 98.5 ± 2.8 passes 100%: the cut whisker is marked and the table keeps the full SD.
  await expect(demo.locator('.r-agg-clip')).toHaveCount(1);
  await expect(demo).toContainText('98.5 ± 2.8');
});

test('changing the device fixture clears the earlier fixture output', async ({ page }) => {
  await page.goto('/?legacy=1#mission/health');
  await page.getByRole('button', { name: 'Interpret health and open watchlist' }).click();
  await page.getByRole('button', { name: 'Open documented-format source' }).click();
  const demo = page.getByTestId('device-demo');
  await page.getByRole('button', { name: 'Process synthetic payload', exact: true }).click();
  await expect(page.getByTestId('device-current')).toContainText('72 bpm');
  await page.getByLabel('Bundled synthetic input').selectOption('retained');
  await expect(page.getByTestId('device-current')).toHaveCount(0);
  await expect(demo.locator('.m-pipeline')).toContainText('Not yet processed');
  await expect(demo).toContainText('Fixture changed. Process it to inspect its adapter output.');
  await page.getByRole('button', { name: 'Process synthetic payload', exact: true }).click();
  await expect(page.getByTestId('device-current')).toContainText(
    'Current usable observation unavailable',
  );
});
