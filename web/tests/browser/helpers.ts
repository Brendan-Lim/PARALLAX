import { expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

/** Verification captures stay with generated reports for this checkout. */
export const captures = './test-results/browser-captures';

export const slugs = {
  missing: 'missing-evidence',
  conditions: 'incompatible-measurements',
  copy: 'dependent-observations',
} as const;

export async function openStep(page: Page, slug: string, step: number) {
  await page.goto(`/#scenarios/${slug}/${step}`);
  await expect(page.locator('#step-title')).toBeVisible();
  await expect(page.locator('.g-step')).toHaveAttribute('data-step', String(step));
}

/** Enters the fictional slip's 29 s result through the validated record form. */
export async function enterSlip(page: Page) {
  await page.getByRole('button', { name: 'Enter the slip’s result' }).click();
  await expect(page.getByLabel('Recorded value', { exact: true })).toHaveValue('29');
  await page.getByLabel('This is a synthetic result').check();
  await page.getByRole('button', { name: 'Validate observation & reassess' }).click();
}

/** Applies the correction log's documented 100 W workload through the validated record form. */
export async function applyCorrection(page: Page) {
  await page.getByRole('button', { name: 'Apply the documented workload' }).click();
  await page.getByLabel('Recorded workload (W)').fill('100');
  await page.getByLabel('This is a synthetic result').check();
  await page.getByRole('button', { name: 'Validate observation & reassess' }).click();
}

export async function downloadText(page: Page, name = 'Download the review') {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name, exact: true }).click();
  const download = await pending;
  const path = await download.path();
  return { body: await readFile(path!, 'utf8'), filename: download.suggestedFilename() };
}

export const opening = (body: string) => body.split('\n## Supporting detail and provenance\n')[0];

export async function noHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
