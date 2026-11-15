import { expect, test } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import { captures, downloadText, opening, openStep, slugs } from './helpers';
// Redesign: captures go to the candidate folder; accepted release folders are never written.
const out = `${captures}/blind-refinement`;
test.beforeAll(async () => {
  await mkdir(out, { recursive: true });
});
for (const width of [1440, 390, 320]) {
  // Redesign: reassessment now happens in guided step 4. Escape returns focus to the opener, the
  // updated result receives focus inside the viewport, and Undo restores the previous state.
  test(`reassessment and Undo retain the updated finding and keyboard context at ${width}px`, async ({
    page,
  }) => {
    const height = width === 320 ? 740 : 844;
    await page.setViewportSize({ width, height });
    for (const scenario of ['Missing Evidence', 'Incompatible Measurements']) {
      const missing = scenario === 'Missing Evidence';
      await openStep(page, missing ? slugs.missing : slugs.conditions, 4);
      const opener = page.getByRole('button', {
        name: missing ? 'Enter the slip’s result' : 'Apply the documented workload',
      });
      await opener.click();
      await page.keyboard.press('Escape');
      await expect(opener).toBeFocused();
      await opener.click();
      if (!missing) await page.getByLabel('Recorded workload (W)').fill('100');
      await page.getByLabel('This is a synthetic result').check();
      await page.getByRole('button', { name: 'Validate observation & reassess' }).click();
      const result = page.locator('#guided-result');
      await expect(result).toBeFocused();
      await expect(result).toContainText(missing ? '+20.83%' : '+15 bpm');
      const rect = await result.boundingBox();
      expect(rect!.y).toBeGreaterThanOrEqual(0);
      expect(rect!.y + rect!.height).toBeLessThanOrEqual(height + 1);
      const undo = page.getByRole('button', { name: 'Undo entry' });
      await undo.scrollIntoViewIfNeeded();
      await expect(undo).toBeInViewport();
      await page.screenshot({
        path: `${out}/${missing ? 'missing' : 'cycling'}-reassessed-${width}.png`,
      });
      await undo.click();
      await expect(result).toBeFocused();
      await expect(result).toContainText(missing ? 'Change unknown' : 'Comparison withheld');
      if (!missing) await expect(result).toContainText('100 W and 120 W');
      await page.getByRole('button', { name: 'Restart' }).click();
    }
  });
  // Redesign: the source-copy review is guided scenario 3; the landing page's single primary
  // action is in the first viewport and the scenario list reaches the dependency case.
  test(`source-copy review stays coherent and exports the unresolved issue first at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    // Mission is now the primary entry; this retained educational workflow starts on Discover.
    await page.goto('/#discover');
    await expect(
      page.getByRole('link', { name: 'Explore the first scenario' }).first(),
    ).toBeInViewport();
    await page.getByRole('link', { name: 'Explore scenarios' }).click();
    await page.getByRole('link', { name: /Dependent Observations/ }).click();
    await expect(page.locator('#step-title')).toContainText('Are they two measurements?');
    await openStep(page, slugs.copy, 4);
    const ledger = page.getByRole('list', { name: 'Other comparisons' });
    const supported = await ledger.innerText();
    await page.getByTestId('source-toggle').click();
    await expect(page.getByTestId('source-copy')).toContainText('1,050 N');
    await expect(page.getByTestId('compact-result')).toContainText('Record missing');
    await expect(page.getByTestId('compact-result')).toContainText('Force comparison unknown');
    expect(await ledger.innerText()).toBe(supported);
    await page.getByRole('button', { name: /Next/ }).click();
    await page.getByText('Source records', { exact: true }).click();
    await page.getByText('Inspect source records', { exact: false }).click();
    await expect(page.locator('.record-details')).toContainText('DEMO-04-force-followup');
    await expect(page.locator('.record-details')).toContainText('supplies no independent support');
    const sourceSize = await page
      .locator('.record dd')
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(sourceSize).toBeGreaterThanOrEqual(14);
    await page
      .getByLabel('Question for the reviewer')
      .fill('Locate and verify the original force follow-up.');
    const { body } = await downloadText(page);
    const first = opening(body);
    for (const text of [
      'Dependent Observations',
      'Locate and verify the original',
      'DEMO-04-force-followup',
      'supplies no independent support',
      'Relevant supported findings',
      'readable handoff',
    ])
      expect(first).toContain(text);
    expect(body).toContain('Derived record excluded from independent support');
    expect(body).not.toContain('Change: +50 N');
    await page.screenshot({ path: `${out}/dependency-excluded-${width}.png`, fullPage: true });
    await openStep(page, slugs.copy, 4);
    await page.getByTestId('source-toggle').click();
    await expect(page.getByTestId('compact-result')).toContainText('Supported');
    expect(await ledger.innerText()).toBe(supported);
  });
  test(`all evidence rows activate once by label, pointer and Space at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/#lens');
    for (const row of await page.getByRole('switch').all()) {
      const bounds = await row.boundingBox();
      expect(bounds!.width).toBeGreaterThanOrEqual(44);
      expect(bounds!.height).toBeGreaterThanOrEqual(44);
      const label = row.locator('strong');
      await label.click();
      await expect(row).toHaveAttribute('aria-checked', 'false');
      await row.click();
      await expect(row).toHaveAttribute('aria-checked', 'true');
      await row.focus();
      await page.keyboard.press('Space');
      await expect(row).toHaveAttribute('aria-checked', 'false');
      await page.keyboard.press('Space');
      await expect(row).toHaveAttribute('aria-checked', 'true');
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `${out}/lens-switches-${width}.png`, fullPage: true });
  });
}
test('production cache contains every declared resource and supports an offline new tab and inspected handoff', async ({
  page,
  context,
}) => {
  await page.goto('/#monitor');
  await page.getByText('Offline cache ready', { exact: true }).waitFor();
  const cache = await page.evaluate(async () => {
    const keys = (await caches.keys()).filter((k) => k.startsWith('parallax-shell-'));
    return {
      keys,
      urls: (await (await caches.open(keys[0])).keys()).map((r) => new URL(r.url).pathname),
    };
  });
  const sw = await readFile('dist/sw.js', 'utf8');
  const declared = JSON.parse(sw.match(/const ASSETS = (\[[^;]+\]);/)![1]);
  expect(cache.urls.sort()).toEqual(declared.sort());
  await context.setOffline(true);
  await page.reload();
  const reopened = await context.newPage();
  // Redesign: the offline new tab runs the guided dependency investigation.
  await reopened.goto(`http://127.0.0.1:4173/#scenarios/${slugs.copy}/4`);
  await reopened.getByTestId('source-toggle').click();
  await reopened.getByRole('button', { name: /Next/ }).click();
  await reopened.getByText('Source records', { exact: true }).click();
  await reopened.getByText('Inspect source records', { exact: false }).click();
  await expect(reopened.locator('.record-details')).toContainText('DEMO-04-force-followup');
  const dl = reopened.waitForEvent('download');
  await reopened.getByRole('button', { name: 'Download the review', exact: true }).click();
  await (await dl).saveAs(`${out}/production-offline-review.md`);
  const body = await readFile(`${out}/production-offline-review.md`, 'utf8');
  expect(body.split('## Supporting detail')[0]).toContain('DEMO-04-force-followup');
  expect(body).toContain('Dependent copy:');
  await reopened.screenshot({ path: `${out}/production-offline.png` });
});
// Redesign: the scenario list replaces the Monitor cards and the Research page replaces the
// outcome selector; stacking, the full sway outcome and narrow reflow are still checked.
test('skip link comes first; intermediate cards stack and full outcome remains visible', async ({
  page,
}) => {
  await page.goto('/#discover');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
  await page.setViewportSize({ width: 720, height: 1000 });
  await page.getByRole('link', { name: 'Scenarios', exact: true }).click();
  await expect(page.locator('.g-card')).toHaveCount(6);
  const cards = await page.locator('.g-card').all();
  const a = await cards[0].boundingBox(),
    b = await cards[1].boundingBox();
  expect(a!.x).toBe(b!.x);
  expect(b!.y).toBeGreaterThan(a!.y);
  await page.setViewportSize({ width: 320, height: 740 });
  await page.getByRole('link', { name: 'Research', exact: true }).click();
  const sway = page.locator('.c-cohort').filter({ hasText: 'Recovery from Fall/Stand' });
  await expect(sway).toContainText('Postural sway speed');
  for (const value of ['+66%', '+54%', '+42%']) await expect(sway).toContainText(value);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
