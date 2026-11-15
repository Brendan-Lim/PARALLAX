import { expect, test } from '@playwright/test';
import { enterSlip, openStep, slugs } from './helpers';

const titles = ['Missing Evidence', 'Incompatible Measurements', 'Dependent Observations'];

// Redesign: ordinary navigation is now the guided site. The substance is unchanged: only the
// three curated scenarios are offered, no fixture identifier appears in ordinary navigation, and
// the workspace hides its extra example loaders until asked.
test('ordinary Monitor navigation offers only the three curated scenarios without fixture identifiers', async ({
  page,
}) => {
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/#scenarios');
    await expect(page.locator('.g-card')).toHaveCount(6);
    await expect(page.locator('main')).not.toContainText(/DEMO-/, { useInnerText: true });
    for (const [i, title] of titles.entries()) {
      const card = page.locator('.g-card').nth(i + 2);
      await expect(card).toContainText(title);
      await card.getByRole('link').click();
      await expect(page.locator('.g-scenario-name')).toContainText(title);
      for (let step = 1; step <= 5; step++) {
        await openStep(page, Object.values(slugs)[i], step);
        await expect(page.locator('.g-run')).not.toContainText(/DEMO-/, { useInnerText: true });
        await expect(page.locator('.sr-only[role="status"]')).not.toContainText(/DEMO-/);
      }
      await page.goto('/#scenarios');
    }
    await page.goto('/#lens');
    await expect(
      page.getByRole('button', { name: 'Two values, incompatible protocols' }),
    ).toBeHidden();
    await expect(
      page.getByRole('button', { name: 'A publication cannot fill a gap' }),
    ).toBeHidden();
    await expect(
      page.getByRole('button', { name: 'A derived copy is not independent' }),
    ).toBeHidden();
  }
});

// Redesign: the separate Discover experiment became the Discover comparison plus guided Missing
// Evidence. Its own state still changes only through its own interaction.
test('technical fixture access and separate Discover experiment remain available', async ({
  page,
}) => {
  await page.goto('/#monitor');
  await page.locator('.workspace-configuration > details:first-child > summary').click();
  const select = page.getByLabel('SYNTHETIC DEMONSTRATION');
  await expect(select.locator('option')).toHaveCount(6);
  await select.selectOption('DEMO-03');
  await expect(page.locator('.workspace-configuration')).toContainText(
    'Fixture identifier: DEMO-03',
  );
  await page.getByRole('button', { name: 'Evidence Lens', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Two values, incompatible protocols' }),
  ).toBeHidden();
  await page.getByText('Additional evidence examples', { exact: true }).click();
  await page.getByRole('button', { name: 'Two values, incompatible protocols' }).click();
  await expect(page.getByTestId('claim-task')).toContainText('Unresolved observations');
  await page.goto('/#discover');
  await expect(page.getByTestId('bars-force')).toContainText('1,050');
  await expect(page.getByTestId('bars-task')).toContainText('26');
  await openStep(page, slugs.missing, 3);
  await expect(page.getByTestId('bars-task')).toContainText('Not recorded');
  await expect(page.getByTestId('result-task')).toContainText('Change unknown');
  await openStep(page, slugs.missing, 4);
  await enterSlip(page);
  await expect(page.getByTestId('bars-task')).toContainText('29');
  await page.getByRole('button', { name: 'Undo entry' }).click();
  await expect(page.getByTestId('result-task')).toContainText('Change unknown');
  // The workspace still holds DEMO-03: the guided case never touched it.
  await page.goto('/#lens');
  await expect(page.getByTestId('claim-task')).toContainText('Unresolved observations');
});
