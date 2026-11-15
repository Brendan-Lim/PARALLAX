import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
async function enter(page: Page, value: string) {
  await page.getByRole('button', { name: 'Add / update demo observation' }).click();
  await page.getByLabel('Recorded value', { exact: true }).fill(value);
  await page.getByText('Verify protocol & source metadata', { exact: true }).click();
  await page
    .getByLabel('This is a synthetic result from an already authorised demonstration assessment.')
    .check();
}
test('default monitor connects observations, evidence and review action', async ({ page }) => {
  await page.goto('/#monitor');
  await expect(
    page.getByRole('heading', { name: 'Review the observations. Check the evidence.' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Inspect muscular comparison' })).toContainText(
    'Leg-press isometric force',
  );
  await expect(page.getByRole('region', { name: 'Selected health assessment' })).toContainText(
    'increased by 6 s',
  );
  await expect(page.getByTestId('action-different-changes')).toContainText('Qualified review');
  await page.screenshot({ path: 'test-results/desktop-monitor.png', fullPage: true });
  await page.screenshot({ path: 'test-results/monitor-viewport.png' });
  await page.getByRole('button', { name: 'Trace this finding in Evidence Lens' }).click();
  await page.locator('.evidence-layout').screenshot({ path: 'test-results/lens-detail.png' });
  await page.getByRole('switch', { name: 'Use functional follow-up' }).click();
  await expect(page.getByTestId('claim-force')).toContainText('Directly supported');
  await expect(page.getByTestId('claim-task')).toContainText('Insufficient evidence');
  await page
    .locator('.evidence-layout')
    .screenshot({ path: 'test-results/lens-unavailable-detail.png' });
  await page.screenshot({ path: 'test-results/evidence-unavailable.png', fullPage: true });
  await page.getByRole('button', { name: 'Health Actions', exact: true }).click();
  await expect(page.getByTestId('action-task-missing')).toContainText('Record verification');
  await page.screenshot({ path: 'test-results/desktop-actions.png', fullPage: true });
  await page
    .getByTestId('action-task-missing')
    .screenshot({ path: 'test-results/action-detail.png' });
});
test('validated manual entry updates evidence, export and undo across refresh', async ({
  page,
}) => {
  await page.goto('/#monitor');
  await page
    .locator('.workspace-configuration > details:first-child')
    .evaluate((el) => el.setAttribute('open', ''));
  await page.getByLabel('SYNTHETIC DEMONSTRATION').selectOption('DEMO-02');
  await enter(page, '30');
  await page.getByLabel('Session label', { exact: true }).fill('POST-DEMO');
  await page
    .getByLabel('Source record reference', { exact: true })
    .fill('DEMO-02/task/manual-followup');
  await page.getByRole('button', { name: 'Validate observation & reassess' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('region', { name: 'Selected health assessment' })).toContainText(
    'increased by 6 s',
  );
  await page.getByRole('button', { name: 'Health Actions', exact: true }).click();
  await expect(page.getByTestId('action-task-missing')).toHaveCount(0);
  await page.locator('.routine-actions').evaluate((el) => el.setAttribute('open', ''));
  await expect(page.getByTestId('action-task-review')).toBeVisible();
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download review' }).click();
  const stream = await (await event).createReadStream();
  let report = '';
  for await (const part of stream!) report += part;
  for (const text of [
    'Follow-up: 30 s',
    '+6 s',
    'Mission context',
    'Evidence-aware health actions',
    'Source',
  ])
    expect(report).toContain(text);
  await page.reload();
  await page.getByRole('button', { name: 'Health Monitor', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Inspect functional comparison' })).toContainText(
    '30',
  );
  await page.getByRole('button', { name: 'Undo observation entry' }).click();
  await page.locator('.comparison-overview').evaluate((el) => el.setAttribute('open', ''));
  await expect(page.getByRole('button', { name: 'Inspect functional comparison' })).toContainText(
    'Comparison unavailable',
  );
});
test('invalid manual entry is rejected atomically with accessible error and focus trap', async ({
  page,
}) => {
  await page.goto('/#monitor');
  await enter(page, '-2');
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(result.violations).toEqual([]);
  await page.getByRole('button', { name: 'Validate observation & reassess' }).click();
  await expect(page.getByRole('alert')).toContainText('cannot be negative');
  for (let i = 0; i < 15; i++) await page.keyboard.press('Tab');
  expect(
    await page.evaluate(() =>
      document.querySelector('.entry-dialog')?.contains(document.activeElement),
    ),
  ).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Inspect functional comparison' })).toContainText(
    '26',
  );
});
test('review lifecycle persists and resets after relevant observation changes', async ({
  page,
}) => {
  await page.goto('/#monitor');
  await page.getByRole('button', { name: 'Health Actions', exact: true }).click();
  const card = page.getByTestId('action-task-review');
  await page.locator('.routine-actions').evaluate((el) => el.setAttribute('open', ''));
  await card.getByRole('combobox').selectOption('Acknowledged');
  await page.locator('.routine-actions').evaluate((el) => el.setAttribute('open', ''));
  await page.getByLabel('Record demonstration activity as completed').check();
  await page.reload();
  await page.getByRole('button', { name: 'Health Actions', exact: true }).click();
  await page.locator('.routine-actions').evaluate((el) => el.setAttribute('open', ''));
  await expect(card.getByRole('combobox')).toHaveValue('Acknowledged');
  await expect(page.getByLabel('Record demonstration activity as completed')).toBeChecked();
  await expect(page.getByText('Activity recorded.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Health Monitor', exact: true }).click();
  await enter(page, '28');
  await page.getByRole('button', { name: 'Validate observation & reassess' }).click();
  await page.getByRole('button', { name: 'Health Actions', exact: true }).click();
  await page.locator('.routine-actions').evaluate((el) => el.setAttribute('open', ''));
  await expect(card.getByRole('combobox')).toHaveValue('Not reviewed');
  await expect(card).toContainText('Evidence or context changed');
  await expect(
    page.locator('.review-finding').filter({ hasText: 'Medically cleared for EVA' }),
  ).toContainText('Outside validated scope');
});
test('mission review affects feasibility while analog identity remains fixed', async ({ page }) => {
  await page.goto('/#monitor');
  await page
    .locator('.workspace-configuration > details:first-child')
    .evaluate((el) => el.setAttribute('open', ''));
  await page.locator('.mission-context-settings').evaluate((el) => el.setAttribute('open', ''));
  await page.getByLabel('MISSION REVIEW CONTEXT').selectOption('inflight');
  await expect(page.getByRole('region', { name: 'Selected health assessment' })).toContainText(
    'not an in-flight microgravity assessment',
  );
  await page.getByRole('button', { name: 'Add / update demo observation' }).click();
  await expect(page.getByRole('dialog')).toContainText('Do not perform it from this app');
  await page.keyboard.press('Escape');
  await page
    .locator('.workspace-configuration > details:first-child')
    .evaluate((el) => el.setAttribute('open', ''));
  await page.getByLabel('SYNTHETIC DEMONSTRATION').selectOption('DEMO-03');
  await page
    .locator('.workspace-configuration > details:first-child')
    .evaluate((el) => el.setAttribute('open', ''));
  await page.locator('.mission-context-settings').evaluate((el) => el.setAttribute('open', ''));
  await page.getByLabel('MISSION REVIEW CONTEXT').selectOption('inflight');
  const context = page.getByRole('region', { name: 'Mission context' });
  await expect(context).toContainText('Synthetic bed-rest analog');
  await context.getByText('Acquisition setting & limits').click();
  await expect(context).toContainText('does not reclassify this bed-rest analog');
  await context.screenshot({ path: 'test-results/analog-context.png' });
  await page.getByRole('button', { name: 'Health Actions', exact: true }).click();
  await expect(page.getByTestId('action-task-verify')).toContainText(
    'incompatible measurement protocol',
  );
});
test('new monitoring entry and action persistence work offline after caching', async ({
  page,
  context,
}) => {
  await page.goto('/#monitor');
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
  await enter(page, '29');
  await page.getByRole('button', { name: 'Validate observation & reassess' }).click();
  await page
    .locator('.workspace-configuration > details:first-child')
    .evaluate((el) => el.setAttribute('open', ''));
  await page.locator('.mission-context-settings').evaluate((el) => el.setAttribute('open', ''));
  await page.getByLabel('MISSION REVIEW CONTEXT').selectOption('surface');
  await page.getByRole('button', { name: 'Health Actions', exact: true }).click();
  await page.locator('.routine-actions').evaluate((el) => el.setAttribute('open', ''));
  await page
    .getByTestId('action-task-review')
    .getByRole('combobox')
    .selectOption('Recorded for qualified review');
  await page.reload();
  await page.getByRole('button', { name: 'Health Actions', exact: true }).click();
  await page.locator('.routine-actions').evaluate((el) => el.setAttribute('open', ''));
  await expect(page.getByTestId('action-task-review').getByRole('combobox')).toHaveValue(
    'Recorded for qualified review',
  );
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download review' }).click();
  expect((await event).suggestedFilename()).toContain('review.md');
  await context.setOffline(false);
});
test('mobile monitor and structured entry fit a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.goto('/#monitor');
  await page.screenshot({ path: 'test-results/mobile-monitor.png', fullPage: true });
  await page.getByRole('button', { name: 'Add / update demo observation' }).click();
  await page.screenshot({ path: 'test-results/mobile-entry.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Reset demonstration' }).click();
  await expect(page.getByRole('button', { name: 'Inspect functional comparison' })).toContainText(
    '26',
  );
});
