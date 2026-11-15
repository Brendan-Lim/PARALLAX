import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { freshCase } from '../../src/data/cases';
import { mkdir } from 'node:fs/promises';
import { captures } from './helpers';
// Redesign: captures go to the candidate folder; accepted release folders are never written.
const shots = `${captures}/v4`;
test.beforeAll(async () => {
  await mkdir(shots, { recursive: true });
});
async function loadFlight(page: import('@playwright/test').Page) {
  await page.goto('/#monitor');
  await page.getByText('Additional examples for source inspection', { exact: false }).click();
  await page.getByLabel('SYNTHETIC DEMONSTRATION').selectOption('DEMO-05');
  await expect(page.getByRole('button', { name: 'Inspect heart rate comparison' })).toContainText(
    '+15 bpm',
  );
}
test('cycling review: verify conditions, reassess mismatch, restore, plan and exact local handoff', async ({
  page,
}) => {
  await loadFlight(page);
  await expect(page.locator('.assessment')).toContainText('not resting HR');
  await page.locator('.assessment-rule').evaluate((el) => el.setAttribute('open', ''));
  await expect(page.locator('.assessment-rule')).toContainText('100 W');
  await page.getByRole('button', { name: 'Add / update demo observation' }).click();
  await expect(page.getByLabel('Recorded workload (W)')).toHaveValue('100');
  await page.getByLabel('Recorded workload (W)').fill('120');
  await page.getByLabel('This is a synthetic result').check();
  await page.getByRole('button', { name: 'Validate observation & reassess' }).click();
  await expect(page.getByRole('button', { name: 'Inspect heart rate comparison' })).toContainText(
    'Comparison withheld',
  );
  await expect(page.locator('.assessment')).toContainText(
    'The recorded workloads differ: 100 W and 120 W',
  );
  await page.screenshot({ path: `${shots}/flight-incompatible-desktop.png`, fullPage: true });
  await page.getByRole('button', { name: 'Evidence Lens', exact: true }).click();
  await expect(page.getByTestId('inspector')).toContainText(
    'The recorded workloads differ: 100 W and 120 W',
  );
  await page.getByRole('button', { name: 'Observations', exact: true }).click();
  await expect(page.getByRole('table')).toContainText('120 W');
  await page.getByRole('button', { name: 'Health Actions', exact: true }).click();
  await expect(page.getByTestId('action-task-missing')).toContainText(
    'Relevant future assessment not yet available',
  );
  await expect(page.getByTestId('action-tandem-missing')).not.toContainText(
    'Review / add existing result',
  );
  await page.locator('.routine-actions').evaluate((el) => el.setAttribute('open', ''));
  await page.getByLabel('Record demonstration activity as completed').check();
  await page
    .getByLabel('Question for qualified review')
    .fill('Do the recorded workload and session phase match?');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download review' }).click();
  let body = '';
  for await (const chunk of (await (await download).createReadStream())!) body += chunk;
  expect(body).toContain('"workloadWatts":120');
  expect(body).toContain('recorded completed');
  expect(body).toContain('Do the recorded workload and session phase match?');
  expect(body).not.toContain('Change: +15 bpm');
  await page.getByRole('button', { name: 'Health Monitor', exact: true }).click();
  await page.getByRole('button', { name: 'Undo observation entry' }).click();
  await expect(page.getByRole('button', { name: 'Inspect heart rate comparison' })).toContainText(
    '+15 bpm',
  );
  await page.screenshot({ path: `${shots}/flight-monitor-desktop.png`, fullPage: true });
  // Redesign: Discover's fixed introductory comparison is unaffected by the workspace edit.
  await page.getByRole('link', { name: 'Back to the guided site' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Stronger muscles.');
  await expect(page.getByTestId('bars-force')).toContainText('1,050');
  await expect(page.getByRole('heading', { level: 2, name: /Force rose 5%/ })).toBeVisible();
});
test('cached flight monitoring survives disconnected reload, entry and local export', async ({
  page,
  context,
}) => {
  const external: string[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith('http://127.0.0.1:4173') && !r.url().startsWith('blob:'))
      external.push(r.url());
  });
  await loadFlight(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Inspect heart rate comparison' })).toContainText(
    '+15 bpm',
  );
  await page.getByRole('button', { name: 'Add / update demo observation' }).click();
  await page.getByLabel('Recorded value', { exact: true }).fill('138');
  await page.getByLabel('This is a synthetic result').check();
  await page.getByRole('button', { name: 'Validate observation & reassess' }).click();
  await expect(page.getByRole('button', { name: 'Inspect heart rate comparison' })).toContainText(
    '+13 bpm',
  );
  await page.getByRole('button', { name: 'Health Actions', exact: true }).click();
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download review' }).click();
  let body = '';
  for await (const chunk of (await (await event).createReadStream())!) body += chunk;
  expect(body).toContain('+13 bpm');
  expect(body).toContain('fictional microgravity records');
  expect(external).toEqual([]);
});
test('flight case and seven-association explorer fit narrow viewports and pass automated accessibility', async ({
  page,
}) => {
  await loadFlight(page);
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/#monitor');
    await expect(page.getByRole('button', { name: 'Inspect heart rate comparison' })).toContainText(
      '+15 bpm',
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    await page.screenshot({ path: `${shots}/flight-monitor-${width}.png`, fullPage: true });
    // Redesign: all seven associations are drawn and labelled at once; no selection is needed.
    await page.getByRole('button', { name: 'Science & sources', exact: true }).click();
    const chart = page.getByTestId('associations');
    await expect(chart).toContainText('Dynamic posturography');
    await expect(chart).toContainText('−0.456');
    await expect(chart.locator('.c-assoc-row')).toHaveCount(7);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    await page.screenshot({ path: `${shots}/science-${width}.png`, fullPage: true });
  }
});
test('zero-baseline real browser summaries retain absolute evidence and review percentage boundary', async ({
  page,
}) => {
  const p = freshCase();
  p.observations[0].value = 0;
  p.observations[1].value = 10;
  p.observations[6].value = 0;
  p.observations[7].value = 6;
  await page.goto('/#monitor');
  await page.getByRole('button', { name: 'Import fictional observations' }).click();
  await page.getByLabel('Or paste demonstration JSON').fill(JSON.stringify(p));
  await page.getByRole('button', { name: 'Validate & load' }).click();
  await page.getByRole('button', { name: 'Health Monitor', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Inspect muscular comparison' })).toContainText(
    '+10 N',
  );
  // Redesign: Discover shows its own fixture comparison; the imported workspace review persists.
  await page.goto('/#discover');
  await expect(page.getByRole('heading', { level: 2, name: /Force rose 5%/ })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: /30% longer/ })).toBeVisible();
  await page.getByRole('link', { name: 'Advanced workspace' }).click();
  await expect(page.getByRole('button', { name: 'Inspect muscular comparison' })).toContainText(
    '+10 N',
  );
  await expect(page.getByRole('button', { name: 'Inspect functional comparison' })).toContainText(
    '+6 s',
  );
});
