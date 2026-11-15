import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { captures, enterSlip, noHorizontalScroll, openStep, slugs } from './helpers';
// Redesign: captures go to the candidate folder; accepted release folders are never written.
const shots = `${captures}/v4`;
test.beforeAll(async () => {
  await mkdir(shots, { recursive: true });
});

// Redesign: the first encounter is guided Missing Evidence instead of the Discover exclusion
// experiment. Substance kept: real engine values, force unchanged while the task is unknown, no
// write to the workspace session, reassessment and reversal.
test('first encounter reveals actual dependent evidence, preserves force and restores the source', async ({
  page,
}) => {
  await page.goto('/#discover');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Stronger muscles.');
  await page.screenshot({ path: `${shots}/discover-desktop.png`, fullPage: true });
  await page.screenshot({ path: `${shots}/discover-viewport.png` });
  await openStep(page, slugs.missing, 2);
  const force = page.getByTestId('bars-force');
  await expect(force).toContainText('900');
  await expect(force).toContainText('927');
  await expect(page.getByTestId('result-force')).toContainText('+3%');
  const original = await force.innerText();
  await openStep(page, slugs.missing, 3);
  const task = page.getByTestId('bars-task');
  await expect(task).toContainText('24');
  await expect(task).toContainText('Not recorded');
  await expect(page.getByTestId('result-task')).toContainText('Change unknown');
  await expect(page.getByTestId('result-task')).toContainText('Record missing');
  await openStep(page, slugs.missing, 2);
  expect(await force.innerText()).toBe(original);
  expect(
    await page.evaluate(() => localStorage.getItem('parallax.synthetic.session.v1')),
  ).toBeNull();
  await openStep(page, slugs.missing, 5);
  await expect(page.getByTestId('next-action')).toContainText('Find the missing functional record');
  await openStep(page, slugs.missing, 4);
  await enterSlip(page);
  await expect(page.getByTestId('result-task')).toContainText('+5 s · +20.83%');
  await openStep(page, slugs.missing, 5);
  await expect(page.getByTestId('next-action')).toContainText(
    'Preserve the different recorded changes',
  );
  await page.screenshot({ path: `${shots}/guided-missing-meaning.png`, fullPage: true });
  await openStep(page, slugs.missing, 4);
  await page.getByRole('button', { name: 'Undo entry' }).click();
  await expect(page.getByTestId('result-task')).toContainText('Change unknown');
  expect(
    await page.evaluate(() => localStorage.getItem('parallax.synthetic.session.v1')),
  ).toBeNull();
});

test('incompatible and dependent records demonstrate applicability beyond missingness', async ({
  page,
}) => {
  await page.goto('/#lens');
  await page.getByText('Additional evidence examples', { exact: true }).click();
  await page.getByRole('button', { name: 'Two values, incompatible protocols' }).click();
  await expect(page.getByTestId('claim-task')).toContainText('Unresolved observations');
  await expect(page.getByTestId('inspector')).toContainText('incompatible measurement protocol');
  await page.getByText('Inspect source records', { exact: false }).click();
  const metric = page.locator('.record-details');
  await expect(metric).toContainText('21');
  await expect(metric).toContainText('25');
  await expect(page.getByTestId('claim-task')).toContainText('Unresolved observations');
  await page.getByRole('button', { name: 'A derived copy is not independent' }).click();
  await expect(page.getByTestId('inspector')).toContainText('Derived observations');
  await page.getByRole('switch', { name: 'Use muscular follow-up' }).click();
  await expect(page.getByTestId('claim-force')).toContainText('Insufficient evidence');
  await expect(page.getByTestId('inspector')).toContainText('not independent direct observations');
  await page.getByRole('button', { name: 'Health Actions', exact: true }).click();
  await expect(page.getByTestId('action-force-missing')).toContainText('Record verification');
});

// Redesign: Research presents every published value as labelled small multiples instead of
// selectors. Substance kept: exact values, no fictional case evidence on the page, and published
// research never changes an individual finding or its export.
test('research selectors change published values and explanations without supplying case evidence', async ({
  page,
}) => {
  await page.goto('/#research');
  const research = page.getByTestId('research');
  const walk = research.locator('.c-cohort').filter({ hasText: 'Seat Egress and Walk' });
  const sway = research.locator('.c-cohort').filter({ hasText: 'Recovery from Fall/Stand' });
  for (const v of ['+31%', '+38%', '+23%']) await expect(walk).toContainText(v);
  for (const v of ['+66%', '+54%', '+42%']) await expect(sway).toContainText(v);
  await expect(research.getByTestId('associations')).toContainText('+0.398');
  await expect(research).not.toContainText(/DEMO-|1,050|927/);
  await page.screenshot({ path: `${shots}/research-desktop.png`, fullPage: true });
  await page.goto('/#lens');
  await page.getByRole('switch', { name: 'Use functional follow-up' }).click();
  await page.getByRole('button', { name: 'Science & sources', exact: true }).click();
  await expect(page.getByTestId('associations')).toBeVisible();
  await page.getByRole('button', { name: 'Health Actions', exact: true }).click();
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download review' }).click();
  const stream = await (await event).createReadStream();
  let body = '';
  for await (const part of stream!) body += part;
  expect(body).toContain('Insufficient evidence');
  expect(body).not.toContain('+30%');
});

// Redesign: the first-use action is the guided route. Keyboard operation of the essential
// interaction is reversible and charts do not animate under reduced motion.
test('first-use action fits mobile, is keyboard reversible and respects reduced motion', async ({
  page,
}) => {
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/#discover');
    const heroAction = page.getByRole('link', { name: 'Explore the first scenario' }).first();
    const b = await heroAction.boundingBox();
    expect(b!.y + b!.height).toBeLessThan(844);
    await openStep(page, slugs.copy, 4);
    const toggle = page.getByTestId('source-toggle');
    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(toggle).toBeFocused();
    await expect(page.getByTestId('compact-result')).toContainText('Force comparison unknown');
    expect(
      await page
        .locator('.c-doc')
        .first()
        .evaluate((el) => getComputedStyle(el).transitionDuration),
    ).toBe('0s');
    await page.screenshot({ path: `${shots}/guided-excluded-${width}.png`, fullPage: true });
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByTestId('compact-result')).toContainText('Force comparison +5%');
    await openStep(page, slugs.missing, 3);
    expect(
      await page
        .locator('.c-row i')
        .first()
        .evaluate((el) => getComputedStyle(el).transitionDuration),
    ).toBe('0s');
    await page.goto('/#research');
    await expect(page.locator('.c-cohort').filter({ hasText: 'Recovery' })).toContainText('+42%');
    await page.screenshot({ path: `${shots}/research-${width}.png`, fullPage: true });
  }
});

test('all V3 modes reflow accessibly at desktop tablet phone and 200 percent equivalent width', async ({
  page,
}) => {
  const results = [];
  for (const width of [1440, 768, 640, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const mode of [
      'discover',
      'scenarios',
      `scenarios/${slugs.missing}/3`,
      `scenarios/${slugs.conditions}/3`,
      `scenarios/${slugs.copy}/4`,
      'research',
      'monitor',
      'science',
    ]) {
      await page.goto('/#' + mode);
      await expect(page.locator('main')).toBeVisible();
      await noHorizontalScroll(page);
      const axe = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      results.push({ width, mode, violations: axe.violations.length });
      expect(axe.violations).toEqual([]);
    }
  }
  await writeFile('test-results/v3-accessibility.json', JSON.stringify(results, null, 2));
});

test('new modes and selections work offline after cache installation with no external requests', async ({
  page,
  context,
}) => {
  const external: string[] = [];
  const errors: string[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith('http://127.0.0.1:4173') && !r.url().startsWith('blob:'))
      external.push(r.url());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/#monitor');
  await expect(page.getByText('Offline cache ready', { exact: true })).toBeVisible();
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
  await page.goto('/#discover');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Stronger muscles.');
  await openStep(page, slugs.missing, 4);
  await enterSlip(page);
  await expect(page.getByTestId('result-task')).toContainText('+20.83%');
  await page.goto('/#research');
  await expect(page.getByTestId('associations')).toContainText('−0.456');
  await openStep(page, slugs.copy, 4);
  await page.getByTestId('source-toggle').click();
  await expect(page.getByTestId('counterfactual')).toContainText('+5%');
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
  await context.setOffline(false);
});
