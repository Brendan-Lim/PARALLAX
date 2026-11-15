import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { noHorizontalScroll } from './helpers';
import { retrieveMissionRecord } from './missionHelpers';

const key = 'parallax.mission.v1';
const recordToggle = 'Use the 28 June record in this review';
const health = async (page: import('@playwright/test').Page) => {
  await page.goto('/?legacy=1#mission/health');
  await expect(page.getByTestId('mission-exercise')).toBeVisible();
};

test('primary mission entry leads to a coherent engine-backed overview', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?legacy=1');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tomorrow,you land on Mars.');
  await expect(page.getByRole('img', { name: /Original illustration/ })).toBeVisible();
  await page.getByRole('link', { name: 'Begin mission review' }).click();
  await expect(page).toHaveURL(/#mission\/health$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  await expect(page.getByTestId('mission-no-comparison')).toBeVisible();
  await retrieveMissionRecord(page);
  await expect(page.getByTestId('mission-exercise')).toContainText('increased by 15 bpm');
  await expect(page.getByTestId('mission-chart').getByRole('img')).toHaveAccessibleName(
    'Two fictional cycling heart-rate records',
  );
  await expect(page.getByRole('table', { name: /Recorded exercise heart rate/ })).toContainText(
    '125 bpm',
  );
  await expect(page.getByTestId('mission-chart')).toContainText('13 days apart');
  await expect(page.getByTestId('mission-strength')).toContainText('1,000 N');
  await expect(page.getByTestId('mission-strength')).toContainText('No supported change');
  await expect(page.getByTestId('mission-aerobic')).toContainText('No VO2max result');
  await expect(page.getByTestId('mission-mobility')).toContainText('remain unestablished');
  await expect(page.getByTestId('mission-summary-requirements')).toContainText(
    '1 of 2 approach items',
  );
  await expect(page.getByTestId('mission-summary-requirements')).toContainText(
    'outside this approach count',
  );
  await expect(page.getByTestId('mission-summary-disposition')).toContainText(
    'No human review recorded',
  );
  expect(errors).toEqual([]);
});

test('exclusion removes unsupported arithmetic everywhere and persists through resume', async ({
  page,
}) => {
  await health(page);
  await retrieveMissionRecord(page);
  await page.getByText('Inspect records and comparison', { exact: true }).click();
  await page.getByLabel(recordToggle).uncheck();
  await expect(page.getByTestId('mission-chart')).toHaveCount(0);
  await expect(page.getByTestId('mission-no-comparison')).toContainText('Change unknown');
  await expect(page.locator('.m-experience')).not.toContainText('+15');
  await expect(page.getByTestId('mission-summary-requirements')).toContainText('0 of 2');
  await expect(page.getByTestId('mission-exercise').locator('.m-records')).toContainText('140 bpm');
  await expect(page.getByTestId('mission-mobility')).toContainText('remain unestablished');
  await page.reload();
  await expect(page.getByTestId('mission-chart')).toHaveCount(0);
  await page.getByRole('link', { name: 'Mission', exact: true }).click();
  await page.getByRole('link', { name: 'Resume mission review' }).click();
  await expect(page.getByTestId('mission-no-comparison')).toBeVisible();
  await page.getByText('Inspect records and comparison', { exact: true }).click();
  await page.getByLabel(recordToggle).check();
  await expect(page.getByTestId('mission-chart')).toContainText('+15 bpm');
});

test('mission begin, reload and restart preserve existing workspace and guided state byte for byte', async ({
  page,
}) => {
  await page.goto('/#monitor');
  await page.getByRole('button', { name: 'Health Actions', exact: true }).click();
  await page
    .getByLabel('Question for qualified review')
    .fill('Preserve this independent workspace review.');
  await page.goto('/#scenarios/dependent-observations/4');
  await page.getByTestId('source-toggle').click();
  const before = await page.evaluate(() => ({
    workspace: localStorage.getItem('parallax.synthetic.session.v1'),
    guided: localStorage.getItem('parallax.guided.v1'),
  }));
  expect(before.workspace).toContain('Preserve this independent');
  expect(before.guided).toContain('DEMO-04');
  await health(page);
  await retrieveMissionRecord(page);
  await page.getByText('Inspect records and comparison', { exact: true }).click();
  await page.getByLabel(recordToggle).uncheck();
  await page.reload();
  await page.getByRole('button', { name: 'Restart mission', exact: true }).click();
  await page.getByRole('button', { name: 'Keep this mission', exact: true }).click();
  await expect(page.getByTestId('mission-chart')).toHaveCount(0);
  await page.getByRole('button', { name: 'Restart mission', exact: true }).click();
  await page.getByRole('button', { name: 'Restart mission review', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Begin mission review' })).toBeVisible();
  expect(
    await page.evaluate(() => ({
      workspace: localStorage.getItem('parallax.synthetic.session.v1'),
      guided: localStorage.getItem('parallax.guided.v1'),
    })),
  ).toEqual(before);
  await page.getByRole('link', { name: 'Begin mission review' }).click();
  await expect(page.getByTestId('mission-no-comparison')).toBeVisible();
});

test('invalid mission state recovers visibly without rewriting an unrelated invalid store', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('parallax.mission.v1', '{invalid');
    localStorage.setItem('parallax.guided.v1', 'unrelated preserved raw data');
  });
  await health(page);
  await retrieveMissionRecord(page);
  await expect(page.getByRole('status').filter({ hasText: 'could not be resumed' })).toBeVisible();
  await expect(page.getByTestId('mission-chart')).toContainText('+15 bpm');
  expect(await page.evaluate(() => localStorage.getItem('parallax.guided.v1'))).toBe(
    'unrelated preserved raw data',
  );
});

test('storage failure is visible and leaves the mission usable in memory', async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, value) {
      if (k === 'parallax.mission.v1') throw new DOMException('test quota', 'QuotaExceededError');
      original.call(this, k, value);
    };
  });
  await health(page);
  await retrieveMissionRecord(page);
  await expect(page.getByRole('alert')).toContainText('cannot be saved');
  await expect(page.locator('.m-local')).toContainText('memory only');
  await page.getByText('Inspect records and comparison', { exact: true }).click();
  await page.getByLabel(recordToggle).uncheck();
  await expect(page.getByTestId('mission-no-comparison')).toBeVisible();
});

test('secondary educational, research and five advanced workspace views remain reachable', async ({
  page,
}) => {
  await page.goto('/?legacy=1');
  await page.getByRole('link', { name: 'Scenarios', exact: true }).click();
  await expect(page.locator('.g-card')).toHaveCount(6);
  await page.getByRole('link', { name: /Missing Evidence/ }).click();
  await expect(page.locator('#step-title')).toBeVisible();
  await page.getByRole('link', { name: 'Research', exact: true }).click();
  await expect(page.getByTestId('associations')).toBeVisible();
  await page.getByRole('link', { name: 'Advanced workspace', exact: true }).click();
  for (const view of [
    'Health Monitor',
    'Observations',
    'Evidence Lens',
    'Health Actions',
    'Science & sources',
  ]) {
    await page.getByRole('button', { name: view, exact: true }).click();
    await expect(page.locator('.app-shell')).toBeVisible();
  }
});

test('locked evaluation remains neutral for mission deep links and never creates mission state', async ({
  page,
}) => {
  const loaded: string[] = [];
  page.on('request', (r) => loaded.push(r.url()));
  for (const route of ['#mission/health', '#mission', '#scenarios/missing-evidence/3']) {
    await page.goto('/?evaluation=1' + route);
    await expect(page.locator('.app-shell')).toBeVisible();
    await expect(page.locator('.m-experience')).toHaveCount(0);
    await expect(page.locator('.g-step')).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText('Tomorrow,');
    for (const name of [
      'Health Monitor',
      'Observations',
      'Evidence Lens',
      'Health Actions',
      'Science & sources',
    ])
      await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
  }
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBeNull();
  expect(loaded.some((url) => /\/Mission-.*\.js/.test(url))).toBe(false);
});

for (const width of [1440, 768, 390, 320]) {
  test(`mission works by keyboard, has accessible charts and fits ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?legacy=1');
    const begin = page.getByRole('link', { name: 'Begin mission review' });
    await expect(begin).toBeInViewport();
    await noHorizontalScroll(page);
    const hero = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(hero.violations).toEqual([]);
    expect(
      await page.locator('.m-hero h1').evaluate((el) => getComputedStyle(el).animationName),
    ).toBe('none');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
    await begin.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
    await retrieveMissionRecord(page);
    await noHorizontalScroll(page);
    const summary = page.getByText('Inspect records and comparison', { exact: true });
    await summary.focus();
    await page.keyboard.press('Enter');
    const toggle = page.getByLabel(recordToggle);
    await toggle.focus();
    await page.keyboard.press('Space');
    await expect(page.getByTestId('mission-chart')).toHaveCount(0);
    await expect(toggle).toBeFocused();
    await page.keyboard.press('Space');
    await expect(page.getByTestId('mission-chart')).toContainText('+15 bpm');
    await page.getByText('Requirements, sources and limits', { exact: true }).click();
    await expect(page.getByRole('link', { name: /NASA-STD-3001/ })).toHaveAttribute(
      'href',
      'https://www.nasa.gov/reference/4-0-human-performance/',
    );
    await noHorizontalScroll(page);
    const health = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(health.violations).toEqual([]);
    await page.getByRole('button', { name: 'Review what remains unresolved' }).click();
    await expect(page.locator('#mission-question')).toBeFocused();
    if (width < 900) {
      await expect(
        page.getByRole('region', { name: 'Persistent mission review reminder' }),
      ).toBeInViewport();
      await page.getByRole('button', { name: 'Review summary', exact: true }).click();
      await expect(page.locator('#m-summary-title')).toBeFocused();
    }
  });
}

test('production mission, lazy secondary routes and record selection work offline after installation', async ({
  page,
  context,
}) => {
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
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
  await expect(page.getByTestId('mission-chart')).toContainText('+15 bpm');
  await page.getByText('Inspect records and comparison', { exact: true }).click();
  await page.getByLabel(recordToggle).uncheck();
  await page.reload();
  await expect(page.getByTestId('mission-no-comparison')).toBeVisible();
  const other = await context.newPage();
  await other.goto('/?legacy=1#mission/health');
  await expect(other.getByTestId('mission-no-comparison')).toBeVisible();
  await other.goto('/#research');
  await expect(other.getByTestId('associations')).toBeVisible();
  await other.goto('/#scenarios');
  await expect(other.locator('.g-card')).toHaveCount(6);
  await other.goto('/#monitor');
  await expect(other.locator('.app-shell')).toBeVisible();
  expect(requests.filter((url) => !url.startsWith('http://127.0.0.1:4173/'))).toEqual([]);
});
