import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import {
  applyCorrection,
  captures,
  enterSlip,
  noHorizontalScroll,
  openStep,
  slugs,
} from './helpers';
// Redesign: captures go to the candidate folder; accepted release folders are never written.
const shots = `${captures}/v4`;
test.beforeAll(async () => {
  await mkdir(shots, { recursive: true });
});

// Redesign: the three scenarios are guided sequences. Same engine values, Undo and reset, and the
// guided cases never write the workspace session.
test('three featured scenarios reassess missing, incompatible and dependent evidence without mixing sessions', async ({
  page,
}) => {
  await page.goto('/#scenarios');
  await expect(page.locator('.g-card')).toHaveCount(6);
  await openStep(page, slugs.missing, 3);
  await expect(page.getByTestId('result-task')).toContainText('Record missing');
  await page.screenshot({ path: `${shots}/scenario-01-missing.png`, fullPage: true });
  await openStep(page, slugs.missing, 4);
  await enterSlip(page);
  await expect(page.getByTestId('result-task')).toContainText('Supported');
  await expect(page.getByTestId('result-task')).toContainText('+5 s · +20.83%');
  await expect(page.getByTestId('source-slip')).toContainText('After record in use: 29 s');
  await page.screenshot({ path: `${shots}/scenario-01-reassessed.png`, fullPage: true });
  await page.getByRole('button', { name: 'Undo entry' }).click();
  await expect(page.getByTestId('result-task')).toContainText('Record missing');
  await openStep(page, slugs.conditions, 2);
  await expect(page.getByTestId('result-hr')).toContainText('Comparison withheld');
  await expect(page.getByTestId('bars-hr')).toContainText('125');
  await expect(page.getByTestId('bars-hr')).toContainText('140');
  await openStep(page, slugs.conditions, 3);
  await expect(page.getByTestId('conditions')).toContainText('120 W');
  await page.screenshot({ path: `${shots}/scenario-02-incompatible.png`, fullPage: true });
  await openStep(page, slugs.conditions, 4);
  await applyCorrection(page);
  await expect(page.getByTestId('result-hr')).toContainText('+15 bpm');
  await expect(page.getByTestId('conditions')).toContainText('Both readings recorded at 100 W');
  await page.screenshot({ path: `${shots}/scenario-02-corrected.png`, fullPage: true });
  await page.getByRole('button', { name: 'Undo entry' }).click();
  await expect(page.getByTestId('result-hr')).toContainText('Comparison withheld');
  await applyCorrection(page);
  await page.getByRole('button', { name: 'Restart' }).click();
  await openStep(page, slugs.conditions, 3);
  await expect(page.getByTestId('conditions')).toContainText('120 W');
  await openStep(page, slugs.copy, 3);
  await expect(page.getByTestId('source-copy')).toContainText('Copied display');
  await openStep(page, slugs.copy, 4);
  await expect(page.getByTestId('compact-result')).toContainText('Supported');
  await page.getByTestId('source-toggle').click();
  await expect(page.getByTestId('compact-result')).toContainText('Record missing');
  await expect(page.getByTestId('source-copy')).toContainText('1,050 N');
  await expect(page.getByRole('list', { name: 'Other comparisons' })).toContainText('+30%');
  await page.screenshot({ path: `${shots}/scenario-03-dependent.png`, fullPage: true });
  const guided = await page.evaluate(() => JSON.parse(localStorage.getItem('parallax.guided.v1')!));
  expect(
    guided.cases.copy.packet.observations.every((r: { caseId: string }) => r.caseId === 'DEMO-04'),
  ).toBe(true);
  expect(guided.cases.copy.packet.context.kind).toBe('mission-demo');
  expect(
    await page.evaluate(() => localStorage.getItem('parallax.synthetic.session.v1')),
  ).toBeNull();
  await page.getByTestId('source-toggle').click();
  await expect(page.getByTestId('compact-result')).toContainText('Supported');
});

// Redesign: Discover's comparison and the guided cases keep their own state. The workspace review
// persists and changes only through an explicit, confirmed transfer.
test('Discover keeps its own evidence while flight monitoring persists and transfers only on request', async ({
  page,
}) => {
  await page.goto('/#monitor');
  await page.locator('.workspace-configuration > details:first-child > summary').click();
  await page.getByLabel('SYNTHETIC DEMONSTRATION').selectOption('DEMO-05-MISMATCH');
  const saved = await page.evaluate(() => localStorage.getItem('parallax.synthetic.session.v1'));
  await page.getByRole('link', { name: 'Back to the guided site' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Stronger muscles.');
  await expect(page.getByTestId('bars-force')).toContainText('1,000');
  await openStep(page, slugs.copy, 4);
  await page.getByTestId('source-toggle').click();
  expect(await page.evaluate(() => localStorage.getItem('parallax.synthetic.session.v1'))).toBe(
    saved,
  );
  await page.goto('/#monitor');
  await expect(page.getByRole('button', { name: 'Inspect heart rate comparison' })).toContainText(
    'Comparison withheld',
  );
  await openStep(page, slugs.copy, 5);
  await page.getByRole('button', { name: 'Continue in the advanced workspace' }).click();
  const dialog = page.getByRole('dialog', { name: 'Replace the workspace review?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Keep the current review' }).click();
  expect(await page.evaluate(() => localStorage.getItem('parallax.synthetic.session.v1'))).toBe(
    saved,
  );
  await page.getByRole('button', { name: 'Continue in the advanced workspace' }).click();
  await dialog.getByRole('button', { name: 'Replace and continue' }).click();
  await page.getByRole('button', { name: 'Evidence Lens', exact: true }).click();
  await expect(page.getByTestId('claim-task')).toContainText('Directly supported');
  await expect(page.getByTestId('claim-force')).toContainText('Insufficient evidence');
});

test('Original illustrations load locally and retain fixed layout after cached offline reload', async ({
  page,
  context,
}) => {
  await page.goto('/#discover');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  const loaded = (selector: string) =>
    page
      .locator(selector)
      .first()
      .evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0);
  await expect(page.locator('.d-hero-img')).toBeVisible();
  expect(await loaded('.d-hero-img')).toBe(true);
  await page.locator('.d-users-photo').scrollIntoViewIfNeeded();
  await expect.poll(() => loaded('.d-users-photo img')).toBe(true);
  await page.getByRole('link', { name: 'Research', exact: true }).click();
  await page.locator('.r-hero img').scrollIntoViewIfNeeded();
  await expect.poll(() => loaded('.r-hero img')).toBe(true);
  await openStep(page, slugs.conditions, 1);
  await expect.poll(() => loaded('.g-visual img')).toBe(true);
});

test('evaluation workspace withholds introductory training in both conditions and keeps the same records', async ({
  page,
}) => {
  await page.goto('/?evaluation=1#observations');
  await expect(page.getByRole('button', { name: 'Discover', exact: true })).toBeHidden();
  await expect(page.getByRole('table')).toContainText('1,050');
  await page.getByRole('button', { name: 'Health Monitor', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Three featured scenarios' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Inspect muscular comparison' })).toContainText(
    '1,050',
  );
  await page.getByRole('button', { name: 'Evidence Lens', exact: true }).click();
  await expect(page.locator('.reasoning-examples')).toBeHidden();
  await expect(page.getByTestId('claim-force')).toContainText('Directly supported');
  await page.goto('/?evaluation=1#discover');
  await expect(page.locator('.app-shell')).toHaveClass(/mode-monitor/);
  await expect(page.locator('.intro-experiment-section')).toHaveCount(0);
});

// Redesign: scenario cards are links on the scenario list; each opens its first step by keyboard.
test('featured investigations reflow accessibly and load by keyboard at desktop and phone widths', async ({
  page,
}) => {
  const { default: AxeBuilder } = await import('@axe-core/playwright');
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const title of [
      'Missing Evidence',
      'Incompatible Measurements',
      'Dependent Observations',
    ]) {
      await page.goto('/#scenarios');
      await page.locator('.g-card').filter({ hasText: title }).getByRole('link').focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('.g-scenario-name')).toContainText(title);
      await expect(page.locator('#step-title')).toBeFocused();
      await noHorizontalScroll(page);
      expect(
        (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
          .violations,
      ).toEqual([]);
    }
  }
});
