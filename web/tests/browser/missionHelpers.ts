import { expect, type Page } from '@playwright/test';
export async function retrieveMissionRecord(page: Page) {
  await page.getByRole('button', { name: 'Plan missing assessments', exact: true }).click();
  await expect(page.locator('#m-planner-title')).toBeFocused();
  await page
    .getByTestId('archive-source')
    .getByText('Inspect fictional exercise archive source', { exact: true })
    .click();
  await page.getByLabel('I reviewed the fictional acquisition conditions').check();
  await page.getByRole('button', { name: 'Add record to review' }).click();
  await expect(page.getByTestId('mission-chart')).toContainText('+15 bpm');
  await expect(page.locator('#m-planner-title')).toBeFocused();
}
