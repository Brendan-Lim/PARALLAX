import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { retrieveMissionRecord } from './missionHelpers';
import { noHorizontalScroll } from './helpers';
const key = 'parallax.mission.v1';
async function source(page: Page, designate = true) {
  await page.getByRole('button', { name: 'Interpret health and open watchlist' }).click();
  if (designate)
    await page
      .getByRole('button', { name: 'Designate fictional HR monitoring requirement' })
      .click();
  await page.getByRole('button', { name: 'Open documented-format source' }).click();
  await expect(page.getByTestId('device-demo')).toBeVisible();
}
async function process(page: Page, fixture = 'usable') {
  await page.getByLabel('Bundled synthetic input').selectOption(fixture);
  await page.getByRole('button', { name: 'Process synthetic payload', exact: true }).click();
  await expect(page.getByTestId('device-current')).toBeVisible();
}
test('actual adapter workflow preserves assessment evidence and shows retained raw value versus unavailable current', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('link', { name: 'Explore PARALLAX' }).click();
  await retrieveMissionRecord(page);
  await expect(page.getByTestId('mission-chart')).toContainText('+15 bpm');
  await source(page);
  const saved = await page.evaluate((k) => localStorage.getItem(k), key);
  await process(page);
  await expect(page.getByTestId('device-current')).toContainText('72 bpm');
  await expect(page.getByTestId('device-association')).toContainText('Current plan associated');
  await page.getByText('Inspect processed payload and canonical output', { exact: true }).click();
  const output = JSON.parse(await page.getByTestId('canonical-device-output').innerText());
  const raw = JSON.parse(await page.getByTestId('processed-source-json').innerText());
  expect(output.batch.observations[1].value).toBe(raw[0].data['19'][1][1]);
  expect(output.batch.observations[1].originalTicks).toBe(raw[0].data['19'][1][0]);
  expect(output.batch.observations[1].originalQualityCode).toBe(raw[0].data['1000'][1][1]);
  expect(output.batch.observations[1].absoluteAcquiredAt).toBeNull();
  expect(output.batch.observations[1].receivedAt).not.toMatch(/^2040/);
  expect(output.association.fictionalAt).toMatch(/^2040/);
  await process(page, 'retained');
  await expect(page.getByTestId('device-current')).toContainText(
    'Current usable observation unavailable',
  );
  await expect(page.getByTestId('device-historical')).toContainText('72 bpm at relative 0 s');
  await expect(page.getByTestId('device-observations')).toContainText(
    'Mask 2 · garment-disconnected',
  );
  await expect(page.getByTestId('device-observations')).toContainText('72 bpm → 72 bpm');
  await expect(page.getByTestId('device-demo')).toContainText('Device not connected');
  await expect(page.getByTestId('device-demo')).toContainText('Monitoring has not started');
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBe(saved);
  await expect(page.getByTestId('mission-chart')).toContainText('+15 bpm');
  await expect(page.getByTestId('mission-mobility')).toContainText('remain unestablished');
  expect(errors).toEqual([]);
});
test('missing/misaligned quality and simultaneous conditions come from changed parser input', async ({
  page,
}) => {
  await page.goto('/?legacy=1#mission/health');
  await source(page);
  await process(page, 'missing');
  await expect(page.getByTestId('device-current')).toContainText('unavailable');
  await expect(page.getByTestId('device-observations')).toContainText('Mask missing');
  await expect(page.getByTestId('device-demo')).toContainText('Unmatched quality ticks: 512');
  await process(page, 'artifacts');
  for (const condition of [
    'electrical-interference-50-60-hz',
    'signal-saturated',
    'motion-artifacts',
    'unreliable-rr-intervals',
  ])
    await expect(page.getByTestId('device-observations')).toContainText(condition);
  await expect(page.getByTestId('device-current')).toContainText('unavailable');
});
test('no designation never inherits one; stale batch requires reprocessing for a new plan', async ({
  page,
}) => {
  await page.goto('/?legacy=1#mission/health');
  await retrieveMissionRecord(page);
  await source(page, false);
  await process(page);
  await expect(page.getByTestId('device-association')).toContainText(
    'No current designation when this batch was processed',
  );
  await page.getByRole('button', { name: 'Designate fictional HR monitoring requirement' }).click();
  await expect(page.getByTestId('device-association')).toContainText('Plan association withheld');
  await process(page);
  await expect(page.getByTestId('device-association')).toContainText('Current plan associated');
  await page.getByRole('button', { name: 'Plan missing assessments', exact: true }).click();
  await page.getByRole('button', { name: 'Undo retrieval' }).click();
  await expect(page.getByTestId('device-association')).toContainText('Association stale');
  await page.getByRole('button', { name: 'Designate fictional HR monitoring requirement' }).click();
  await expect(page.getByTestId('device-association')).toContainText('Association stale');
  await process(page);
  await expect(page.getByTestId('device-association')).toContainText('Current plan associated');
});
for (const width of [1440, 390, 320]) {
  test(
    'device/research keyboard, accessible results and mobile reflow at ' + width,
    async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/?legacy=1#mission/health');
      await source(page);
      await page.getByLabel('Bundled synthetic input').focus();
      await page.keyboard.press('r');
      await page.getByRole('button', { name: 'Process synthetic payload', exact: true }).focus();
      await page.keyboard.press('Enter');
      await expect(page.getByTestId('device-current')).toBeVisible();
      await page
        .getByText('Inspect processed payload and canonical output', { exact: true })
        .click();
      await noHorizontalScroll(page);
      expect(
        (await new AxeBuilder({ page }).include('[data-testid="device-demo"]').analyze())
          .violations,
      ).toEqual([]);
      await page.goto('/#research');
      await expect(page.getByTestId('aggregate-demo')).toBeVisible();
      await page.getByLabel('After bed rest', { exact: true }).selectOption('eyes-open');
      await expect(page.getByTestId('aggregate-result')).toContainText('withheld');
      await page
        .getByText('Inspect published source values, method and licence', { exact: true })
        .click();
      await noHorizontalScroll(page);
      expect(
        (await new AxeBuilder({ page }).include('[data-testid="aggregate-demo"]').analyze())
          .violations,
      ).toEqual([]);
    },
  );
}
test('licensed real aggregate demonstrates both valid differences, incompatible pairing and correct group attribution', async ({
  page,
}) => {
  await page.goto('/#research');
  const demo = page.getByTestId('aggregate-demo');
  await expect(demo).toContainText('30-day');
  await expect(page.getByTestId('aggregate-result')).toContainText('−21.3'.replace('−', '-'));
  await page.getByLabel('After bed rest', { exact: true }).selectOption('eyes-open');
  await expect(page.getByTestId('aggregate-result')).toContainText('Supported comparison withheld');
  await expect(page.getByTestId('aggregate-counterexample')).toContainText(
    '+4.0 percentage points',
  );
  await page.getByLabel('Before bed rest', { exact: true }).selectOption('eyes-open');
  await expect(page.getByTestId('aggregate-result')).toContainText('-10.6 percentage points');
  await expect(page.getByTestId('aggregate-counterexample')).toHaveCount(0);
  await page.getByLabel('Study group').selectOption('Seated');
  await expect(page.getByTestId('aggregate-result')).toContainText('-7.6 percentage points');
  await page
    .getByText('Inspect published source values, method and licence', { exact: true })
    .click();
  await expect(demo.getByRole('link', { name: 'CC BY 4.0' })).toHaveAttribute(
    'href',
    'https://creativecommons.org/licenses/by/4.0/',
  );
  await expect(demo).toContainText('Clément G, Moudy SC');
  await expect(demo).toContainText('83.9→62.6 and 98.5→87.9 values are Exercise');
  await demo.getByRole('link', { name: /Return to the fictional mission/ }).click();
  await expect(page.getByTestId('mission-mobility')).toContainText('remain unestablished');
});
test('installed production works offline for synthetic parsing and aggregate calculation', async ({
  page,
  context,
}) => {
  const external: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith('http://127.0.0.1:4173')) external.push(request.url());
  });
  await page.goto('/?legacy=1#mission/health');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
          once: true,
        }),
      );
  });
  await page.getByText('Project status, licences and AI assistance', { exact: true }).click();
  await expect(
    page.getByText('Offline cache ready in this browser.', { exact: true }),
  ).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await source(page);
  await process(page, 'retained');
  await expect(page.getByTestId('device-current')).toContainText('unavailable');
  await page.goto('/#research');
  await expect(page.getByTestId('aggregate-result')).toContainText('-21.3');
  await page.getByLabel('After bed rest', { exact: true }).selectOption('eyes-open');
  await expect(page.getByTestId('aggregate-counterexample')).toContainText('+4.0');
  expect(external).toEqual([]);
});
test('a follower cannot ingest into the owner and ephemeral telemetry does not persist on reload', async ({
  page,
  context,
}) => {
  await page.goto('/?legacy=1#mission/health');
  await source(page);
  await process(page);
  const follower = await context.newPage();
  await follower.goto('/?legacy=1#mission/health');
  await source(follower, false);
  await expect(
    follower.getByRole('button', { name: 'Process synthetic payload', exact: true }),
  ).toBeDisabled();
  await follower.close();
  await page.reload();
  await source(page, false);
  await expect(page.getByTestId('device-current')).toHaveCount(0);
});
test('historical evaluation routes expose no new device or aggregate teaching and create no mission data', async ({
  page,
}) => {
  for (const route of ['mission/health', 'research']) {
    await page.goto('/?evaluation=1#' + route);
    await expect(page.getByTestId('device-demo')).toHaveCount(0);
    await expect(page.getByTestId('aggregate-demo')).toHaveCount(0);
    expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBeNull();
  }
});
