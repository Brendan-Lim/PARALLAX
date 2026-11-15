import { expect, test } from '@playwright/test';
import { downloadText, opening, openStep, slugs } from './helpers';

// Redesign: the dependent-observation investigation and its handoff moved from the workspace
// Monitor into guided steps 4–5. The assertions about one finding, preview/file agreement,
// reload, selection independence and the compact result are unchanged in substance.
for (const width of [1440, 390]) {
  test(`investigation, preview and report describe the same finding after reload and Lens at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await openStep(page, slugs.copy, 4);
    await page.getByTestId('source-toggle').click();
    await page.getByRole('button', { name: /Next/ }).click();
    await page.getByLabel('Question for the reviewer').fill('Locate the original force record.');
    const check = async () => {
      await expect(page.locator('#step-title')).toHaveText(
        'The copy cannot replace the original record',
      );
      await page.getByText('What the file opens with').click();
      const preview = page.locator('.g-handoff-list');
      await expect(preview).toContainText('Recorded muscular force change · Insufficient evidence');
      await expect(preview).toContainText('Find the missing force record');
      await expect(preview).toContainText('Locate the original force record.');
      await expect(page.getByTestId('next-action')).toContainText('Find the missing force record');
      const first = opening((await downloadText(page)).body);
      expect(first).toContain(
        'Selected finding: Recorded muscular force change — Insufficient evidence',
      );
      expect(first).toContain('> Locate the original force record.');
      expect(first).toMatch(/### Next review action\n\nFind the missing force record/);
    };
    await check();
    await page.reload();
    await check();
    // The workspace keeps its own deliberately selected finding after an explicit transfer.
    await page.getByRole('button', { name: 'Continue in the advanced workspace' }).click();
    await page.getByRole('button', { name: 'Evidence Lens', exact: true }).click();
    await expect(page.getByTestId('inspector')).toContainText('Recorded muscular force change');
    await page.getByTestId('claim-tandem').click();
    await page.getByRole('button', { name: 'Health Actions', exact: true }).click();
    await expect(page.locator('.review-handoff .handoff-contents')).toContainText(
      'Recorded tandem correct steps change',
    );
    await openStep(page, slugs.copy, 5);
    await check();
  });

  test(`compact dependency result is visible beside its control at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await openStep(page, slugs.copy, 4);
    const toggle = page.getByTestId('source-toggle');
    await toggle.click();
    await expect(toggle).toHaveAccessibleName('Restore the original record');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(toggle).toBeFocused();
    const feedback = page.getByTestId('compact-result');
    await expect(feedback).toContainText('Force comparison unknown');
    await expect(feedback).toContainText('Record missing');
    await expect(feedback).toContainText('depends on the excluded record');
    await expect(feedback).toContainText('3 other comparisons are unchanged.');
    await expect(toggle).toBeInViewport({ ratio: 1 });
    // 0.99 tolerates sub-pixel rounding at the viewport edge, not a hidden line.
    await expect(feedback).toBeInViewport({ ratio: 0.99 });
    await page.getByRole('button', { name: 'Restart' }).click();
    await page.goto(`/#scenarios/${slugs.copy}/4`);
    await expect(feedback).toContainText('Force comparison +5%');
    await expect(feedback).toContainText('The original record is in use.');
  });
}
