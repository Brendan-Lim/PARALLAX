import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { freshCase } from '../../src/data/cases';

test('default case, evidence removal, restoration and scope boundaries', async ({ page }) => {
  await page.goto('/#monitor');
  await page.getByRole('button', { name: 'Evidence Lens', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Trace each conclusion to its evidence.' }),
  ).toBeVisible();
  await expect(page.getByTestId('claim-task')).toContainText('Directly supported');
  await page.getByRole('switch', { name: 'Use functional follow-up' }).click();
  await expect(page.getByTestId('claim-task')).toContainText('Insufficient evidence');
  await expect(page.getByTestId('claim-force')).toContainText('Directly supported');
  await expect(page.getByTestId('inspector')).toContainText(
    'cannot establish this missing task outcome',
  );
  await page.getByRole('button', { name: 'Overall functional capability is preserved' }).click();
  await expect(page.getByTestId('inspector')).toContainText('Outside validated scope');
  await page.getByRole('button', { name: 'Restore all observations' }).click();
  await expect(page.getByTestId('claim-task')).toContainText('Directly supported');
});

test('missing and incompatible cases remain transparent', async ({ page }) => {
  await page.goto('/#monitor');
  await page.getByRole('button', { name: 'Evidence Lens', exact: true }).click();
  await page
    .locator('.workspace-configuration > details:first-child')
    .evaluate((el) => el.setAttribute('open', ''));
  await page.getByLabel('SYNTHETIC DEMONSTRATION').selectOption('DEMO-02');
  await expect(page.getByTestId('claim-task')).toContainText('Insufficient evidence');
  await expect(page.getByRole('switch', { name: 'Use functional follow-up' })).toBeDisabled();
  await page
    .locator('.workspace-configuration > details:first-child')
    .evaluate((el) => el.setAttribute('open', ''));
  await page.getByLabel('SYNTHETIC DEMONSTRATION').selectOption('DEMO-03');
  await expect(page.getByTestId('claim-task')).toContainText('Unresolved observations');
  await expect(page.getByTestId('inspector')).toContainText('incompatible measurement protocol');
  await page.getByRole('button', { name: 'Observations', exact: true }).click();
  await expect(page.getByRole('table')).toContainText('fictional-task-v2');
});

test('valid JSON input changes real calculations and review export', async ({ page }) => {
  const p = freshCase();
  p.observations[1].value = 1200;
  await page.goto('/#monitor');
  await page.getByRole('button', { name: 'Evidence Lens', exact: true }).click();
  await page.getByRole('button', { name: 'Import fictional observations' }).click();
  await page.getByLabel('Or paste demonstration JSON').fill(JSON.stringify(p));
  await page.getByRole('button', { name: 'Validate & load' }).click();
  await page.getByTestId('claim-force').click();
  await expect(page.getByTestId('inspector')).toContainText('increased by 200 N');
  await page.getByRole('button', { name: 'Mark for qualified review', exact: true }).click();
  await page.getByRole('button', { name: 'Health Actions', exact: true }).click();
  await page
    .getByLabel('Question for qualified review')
    .fill('What does this force comparison establish?');
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download review' }).click();
  const download = await event;
  expect(download.suggestedFilename()).toBe('PARALLAX-DEMO-01-review.md');
  const stream = await download.createReadStream();
  let body = '';
  for await (const chunk of stream!) body += chunk;
  expect(body).toContain('+200 N');
  expect(body).toContain('Marked for qualified review');
  expect(body).toContain('Synthetic demonstration');
});

test('malformed imports do not replace the current case', async ({ page }) => {
  await page.goto('/#monitor');
  await page.getByRole('button', { name: 'Evidence Lens', exact: true }).click();
  await page.getByRole('button', { name: 'Import fictional observations' }).click();
  await page.getByLabel('Or paste demonstration JSON').fill('{broken');
  await page.getByRole('button', { name: 'Validate & load' }).click();
  await expect(page.getByRole('alert')).toContainText('not valid JSON');
  await page.getByRole('button', { name: 'Close import' }).click();
  await expect(page.getByTestId('claim-task')).toContainText('Directly supported');
});

test('signed HR responses retain their signs without misleading magnitude bars', async ({
  page,
}) => {
  const p = freshCase();
  p.observations[2].value = -8;
  p.observations[3].value = -3;
  await page.goto('/#monitor');
  await page.getByRole('button', { name: 'Evidence Lens', exact: true }).click();
  await page.getByRole('button', { name: 'Import fictional observations' }).click();
  await page.getByLabel('Or paste demonstration JSON').fill(JSON.stringify(p));
  await page.getByRole('button', { name: 'Validate & load' }).click();
  await page.getByTestId('claim-cardio').click();
  await expect(page.getByTestId('inspector')).toContainText('increased by 5 bpm');
  await expect(page.locator('.signed-values')).toContainText('-8');
  await expect(page.locator('.signed-caption')).toContainText('Bars omitted');
});

test('file import is validated and changes the session', async ({ page }) => {
  const p = freshCase('DEMO-02');
  p.case.id = 'IMPORTED';
  p.observations.forEach((r) => (r.caseId = 'IMPORTED'));
  await page.goto('/#monitor');
  await page.getByRole('button', { name: 'Evidence Lens', exact: true }).click();
  await page.getByRole('button', { name: 'Import fictional observations' }).click();
  await page.getByLabel('Choose demonstration JSON file').setInputFiles({
    name: 'case.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(p)),
  });
  await page.getByRole('button', { name: 'Validate & load' }).click();
  await expect(page.getByLabel('SYNTHETIC DEMONSTRATION')).toHaveValue('IMPORTED');
  await expect(page.getByTestId('claim-task')).toContainText('Insufficient evidence');
});

test('refresh preserves availability and review questions', async ({ page }) => {
  await page.goto('/#monitor');
  await page.getByRole('button', { name: 'Evidence Lens', exact: true }).click();
  await page.getByRole('switch', { name: 'Use functional follow-up' }).click();
  await page.getByRole('button', { name: 'Health Actions', exact: true }).click();
  await page.getByLabel('Question for qualified review').fill('Which session is missing?');
  await page.reload();
  await page.getByRole('button', { name: 'Evidence Lens', exact: true }).click();
  await expect(page.getByTestId('claim-task')).toContainText('Insufficient evidence');
  await page.getByRole('button', { name: 'Health Actions', exact: true }).click();
  await expect(page.getByLabel('Question for qualified review')).toHaveValue(
    'Which session is missing?',
  );
});

test('corrupt browser storage visibly restores the safe default', async ({ page }) => {
  await page.goto('/#monitor');
  await page.getByRole('button', { name: 'Evidence Lens', exact: true }).click();
  await page.evaluate(() => localStorage.setItem('parallax.synthetic.session.v1', '{invalid'));
  await page.reload();
  await page.getByRole('button', { name: 'Evidence Lens', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('saved demonstration was invalid');
  await expect(page.getByTestId('claim-task')).toContainText('Directly supported');
});

test('production app works with browser network disabled after caching', async ({
  page,
  context,
}) => {
  await page.goto('/#monitor');
  await page.getByRole('button', { name: 'Evidence Lens', exact: true }).click();
  await expect(page.getByText('Offline cache ready', { exact: true })).toBeVisible({
    timeout: 15000,
  });
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
  await page.reload();
  await page.getByRole('button', { name: 'Evidence Lens', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Trace each conclusion to its evidence.' }),
  ).toBeVisible();
  await page.getByRole('switch', { name: 'Use functional follow-up' }).click();
  await expect(page.getByTestId('claim-task')).toContainText('Insufficient evidence');
  await page.getByRole('button', { name: 'Science & sources', exact: true }).click();
  // Redesign: the Science & sources view opens with the research story's question.
  await expect(
    page.getByRole('heading', {
      name: 'Why can strength hold up while everyday tasks get harder?',
    }),
  ).toBeVisible();
  const second = await context.newPage();
  await second.goto('/#monitor');
  await second.getByRole('button', { name: 'Evidence Lens', exact: true }).click();
  await expect(second.getByTestId('claim-task')).toContainText('Insufficient evidence');
  await second.getByRole('button', { name: 'Health Actions', exact: true }).click();
  const event = second.waitForEvent('download');
  await second.getByRole('button', { name: 'Download review' }).click();
  expect((await event).suggestedFilename()).toContain('review.md');
  const record = await context.newPage();
  await record.goto('/evaluation.txt');
  await expect(record.locator('body')).toContainText('PARALLAX — Software evaluation record');
  await context.setOffline(false);
});

test('runtime has no external data requests or browser errors', async ({ page }) => {
  const external: string[] = [];
  const errors: string[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith('http://127.0.0.1:4173') && !r.url().startsWith('blob:'))
      external.push(r.url());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/#monitor');
  await page.getByRole('button', { name: 'Evidence Lens', exact: true }).click();
  for (const name of ['Observations', 'Health Actions', 'Science & sources', 'Evidence Lens']) {
    if (!(await page.getByRole('button', { name, exact: true }).isVisible()))
      await page.getByRole('button', { name: 'Monitor', exact: true }).click();
    await page.getByRole('button', { name, exact: true }).click();
  }
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test('desktop and mobile layouts have no overflow or serious accessibility violations', async ({
  page,
}) => {
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/#monitor');
    await page.getByRole('button', { name: 'Evidence Lens', exact: true }).click();
    if (width === 1440 || width === 390)
      await page.screenshot({
        path: `test-results/${width === 1440 ? 'desktop' : 'mobile'}-evidence.png`,
        fullPage: true,
      });
    for (const name of [
      'Health Monitor',
      'Evidence Lens',
      'Observations',
      'Health Actions',
      'Science & sources',
    ]) {
      {
        if (!(await page.getByRole('button', { name, exact: true }).isVisible()))
          await page.getByRole('button', { name: 'Monitor', exact: true }).click();
        await page.getByRole('button', { name, exact: true }).click();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(results.violations).toEqual([]);
    }
  }
});

test('conventional view retains the same observations and missing-data indicators', async ({
  page,
}) => {
  await page.goto('/#monitor');
  await page.getByRole('button', { name: 'Evidence Lens', exact: true }).click();
  await page.getByRole('switch', { name: 'Use functional follow-up' }).click();
  await page.getByRole('button', { name: 'Observations', exact: true }).click();
  const rows = page.getByRole('table').locator('tbody tr');
  await expect(rows).toHaveCount(8);
  await expect(rows.filter({ hasText: 'DEMO-01-force-baseline' })).toContainText('1,000');
  await expect(rows.filter({ hasText: 'DEMO-01-force-followup' })).toContainText('1,050');
  const task = rows.filter({ hasText: 'DEMO-01-task-followup' });
  await expect(task).toContainText('26');
  await expect(task).toContainText('Simulated unavailable');
  await expect(page.getByRole('button', { name: 'Inspect functional comparison' })).toContainText(
    'Comparison unavailable',
  );
});

test('native import dialog traps keyboard focus and closes with Escape', async ({ page }) => {
  await page.goto('/#monitor');
  await page.getByRole('button', { name: 'Evidence Lens', exact: true }).click();
  await page.getByRole('button', { name: 'Import fictional observations' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  for (let i = 0; i < 8; i++) await page.keyboard.press('Tab');
  expect(
    await page.evaluate(() => document.querySelector('dialog')?.contains(document.activeElement)),
  ).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Import fictional observations' })).toBeFocused();
});
