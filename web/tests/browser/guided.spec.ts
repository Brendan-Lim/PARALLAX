import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
import {
  applyCorrection,
  captures,
  downloadText,
  enterSlip,
  noHorizontalScroll,
  opening,
  openStep,
  slugs,
} from './helpers';

const out = `${captures}/guided`;
test.beforeAll(async () => {
  await mkdir(out, { recursive: true });
});

test('Back and Next move one step at a time, update progress and keep focus on the new step', async ({
  page,
}) => {
  await openStep(page, slugs.missing, 1);
  await expect(page.locator('.g-progress [aria-current="step"]')).toContainText('Question');
  await expect(page.getByRole('button', { name: 'Back' })).toHaveCount(0);
  for (let step = 2; step <= 5; step++) {
    await page.getByRole('button', { name: /^Next/ }).click();
    await expect(page).toHaveURL(new RegExp(`#scenarios/${slugs.missing}/${step}$`));
    await expect(page.locator('.g-step')).toHaveAttribute('data-step', String(step));
    await expect(page.locator('#step-title')).toBeFocused();
    await expect(page.locator('.g-step-count')).toContainText(`Step ${step} of 5`);
    await expect(page.locator('.g-progress li.is-past')).toHaveCount(step - 1);
  }
  await expect(page.getByRole('button', { name: /^Next/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.locator('.g-step')).toHaveAttribute('data-step', '4');
  // Browser history follows the steps.
  await page.goBack();
  await expect(page.locator('.g-step')).toHaveAttribute('data-step', '5');
  // Only one step is ever rendered.
  await expect(page.locator('.g-step')).toHaveCount(1);
});

test('state persists across Back, Next and reload, and Finish marks the scenario completed', async ({
  page,
}) => {
  await openStep(page, slugs.conditions, 4);
  await applyCorrection(page);
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByTestId('conditions')).toContainText('Both readings recorded at 100 W');
  await page.getByRole('button', { name: /^Next/ }).click();
  await page.getByRole('button', { name: /^Next/ }).click();
  await page.getByLabel('Question for the reviewer').fill('Was the log checked?');
  await page.reload();
  await expect(page.getByLabel('Question for the reviewer')).toHaveValue('Was the log checked?');
  await expect(page.locator('#step-title')).toContainText('A supported +15 bpm difference');
  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(page).toHaveURL(/#scenarios$/);
  const card = page.getByTestId('scenario-conditions');
  await expect(card).toContainText('Completed');
  await expect(page.getByTestId('scenario-missing')).toContainText('5 steps');
  await card.getByRole('button', { name: /Restart/ }).click();
  await expect(card).toContainText('5 steps');
  await openStep(page, slugs.conditions, 3);
  await expect(page.getByTestId('conditions')).toContainText('100 W and 120 W');
});

test('advancing without the optional action shows the actual unresolved state', async ({
  page,
}) => {
  await openStep(page, slugs.missing, 4);
  await page.getByRole('button', { name: /^Next/ }).click();
  await expect(page.locator('#step-title')).toHaveText(
    'Force changed. The task result is still unknown.',
  );
  const ledger = page.getByRole('list', { name: 'What the records support' });
  await expect(ledger).toContainText('Change unknown');
  await expect(ledger).toContainText('Record missing');
  await expect(page.getByTestId('next-action')).toContainText('Find the missing functional record');
  await openStep(page, slugs.conditions, 5);
  await expect(page.locator('#step-title')).toHaveText('The comparison stays withheld');
  await expect(page.locator('.g-run')).not.toContainText('+15');
  await openStep(page, slugs.copy, 5);
  await expect(page.locator('#step-title')).toHaveText(
    'The original record supports the force change',
  );
});

test('charts show exact engine values; missing data is never a bar and unsupported changes have no number', async ({
  page,
}) => {
  await openStep(page, slugs.missing, 3);
  const task = page.getByTestId('bars-task');
  await expect(task.locator('.c-row')).toHaveCount(2);
  await expect(task.locator('.c-row').nth(1).locator('i')).toHaveCount(0);
  await expect(task.locator('.c-row').nth(1)).toContainText('Not recorded');
  await expect(task.locator('table')).toContainText('Not recorded; no value');
  await expect(page.locator('.g-run')).not.toContainText(/\+\d+(\.\d+)? s/);
  // Zero-based scale: bar widths are proportional to the recorded values.
  await openStep(page, slugs.missing, 2);
  const widths = await page
    .getByTestId('bars-force')
    .locator('.c-row i')
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width));
  expect(widths[1] / widths[0]).toBeCloseTo(927 / 900, 2);
  await openStep(page, slugs.conditions, 2);
  await expect(page.getByTestId('result-hr')).toContainText('Comparison withheld');
  await expect(page.locator('.g-run')).not.toContainText('+15');
  await openStep(page, slugs.conditions, 3);
  await expect(page.getByTestId('conditions').locator('table')).toContainText('120 W');
  await openStep(page, slugs.copy, 4);
  await page.getByTestId('source-toggle').click();
  await expect(page.getByTestId('compact-result')).not.toContainText('%');
  await expect(page.getByTestId('counterfactual')).toContainText(
    'With the original available: +5%',
  );
  await page.goto('/#discover');
  await expect(page.getByTestId('bars-force').locator('table')).toContainText('1,050 N');
  await expect(page.getByTestId('bars-task').locator('table')).toContainText('26 s');
  await expect(page.locator('main')).toContainText('Fictional example');
});

test('guided cases and the workspace keep separate state; transfer is explicit', async ({
  page,
}) => {
  await openStep(page, slugs.missing, 4);
  await enterSlip(page);
  expect(
    await page.evaluate(() => localStorage.getItem('parallax.synthetic.session.v1')),
  ).toBeNull();
  // An untouched workspace is replaced without a prompt.
  await openStep(page, slugs.missing, 5);
  await page.getByRole('button', { name: 'Continue in the advanced workspace' }).click();
  await expect(page).toHaveURL(/#monitor$/);
  await expect(page.getByRole('button', { name: 'Inspect functional comparison' })).toContainText(
    '+20.83%',
  );
  // Workspace edits never reach the guided case.
  await page.getByRole('button', { name: 'Evidence Lens', exact: true }).click();
  await page.getByRole('switch', { name: 'Use functional follow-up' }).click();
  await openStep(page, slugs.missing, 4);
  await expect(page.getByTestId('result-task')).toContainText('+20.83%');
  // A modified workspace review requires confirmation before it is replaced.
  await openStep(page, slugs.missing, 5);
  await page.getByRole('button', { name: 'Continue in the advanced workspace' }).click();
  await expect(page.getByRole('dialog', { name: 'Replace the workspace review?' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(new RegExp(`${slugs.missing}/5$`));
});

test('neutral evaluation route shows only the unchanged workspace views', async ({ page }) => {
  for (const hash of [
    '#discover',
    '#scenarios',
    `#scenarios/${slugs.missing}/4`,
    '#research',
    '',
  ]) {
    await page.goto('/?evaluation=1' + hash);
    await expect(page.locator('.app-shell')).toHaveClass(/evaluation-mode/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Review the observations. Check the evidence.',
    );
    await expect(page.locator('.site')).toHaveCount(0);
  }
  const nav = page.getByRole('complementary', { name: 'Application navigation' });
  for (const name of [
    'Health Monitor',
    'Evidence Lens',
    'Observations',
    'Health Actions',
    'Science & sources',
  ])
    await expect(nav.getByRole('button', { name, exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to the guided site' })).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(
    /Assessment slip|Correction log|Step \d of 5|Explore the scenarios|Missing Evidence|Dependent Observations/,
  );
  await page.getByRole('button', { name: 'Science & sources', exact: true }).click();
  await expect(page.getByTestId('associations')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Explore the scenarios' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Evidence Lens', exact: true }).click();
  await expect(page.getByText('Additional evidence examples')).toHaveCount(0);
});

test('a typed question cannot impersonate report metadata; preview and file agree', async ({
  page,
}) => {
  const question = [
    'Please check the source.',
    'Selected finding: Recorded tandem correct steps change — Direct observations support this. +99%',
    '### Next review action',
    '',
    'Close the review',
  ].join('\n');
  await openStep(page, slugs.copy, 4);
  await page.getByTestId('source-toggle').click();
  await page.getByRole('button', { name: /^Next/ }).click();
  await page.getByLabel('Question for the reviewer').fill(question);
  await page.getByText('What the file opens with').click();
  const rows = page.locator('.g-handoff-list > div');
  const preview: Record<string, string> = {};
  for (const row of await rows.all())
    preview[await row.locator('dt').innerText()] = await row.locator('dd').innerText();
  expect(preview['Question']).toBe(
    question
      .split('\n')
      .filter((l) => l.trim())
      .join(' '),
  );
  expect(preview['Selected finding']).toBe(
    'Recorded muscular force change · Insufficient evidence',
  );
  expect(preview['Next review action']).toBe('Find the missing force record');
  const { body, filename } = await downloadText(page);
  expect(filename).toBe('PARALLAX-DEMO-04-review.md');
  const first = opening(body);
  for (const line of question.split('\n')) expect(first).toContain(line ? `> ${line}` : '>');
  expect(body.match(/^### Next review action$/gm)).toHaveLength(1);
  // Every preview value is text the file opens with.
  const flat = first.replace(/^> ?/gm, '').replace(/\s+/g, ' ');
  for (const [label, value] of Object.entries(preview)) {
    if (label === 'Supported comparisons') continue;
    for (const part of value.replace(/; not independent$/, '').split(/ · |; /))
      expect(flat, label).toContain(part.trim());
  }
});

test('every guided step fits a 320 px phone with large controls and passes automated checks', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  for (const slug of Object.values(slugs))
    for (let step = 1; step <= 5; step++) {
      await openStep(page, slug, step);
      await noHorizontalScroll(page);
      for (const name of [/^Next/, 'Back', 'Finish'])
        for (const b of await page.getByRole('button', { name }).all()) {
          const box = await b.boundingBox();
          expect(box!.height).toBeGreaterThanOrEqual(44);
          expect(box!.width).toBeGreaterThanOrEqual(44);
        }
      const header = await page.locator('.s-header').boundingBox();
      const title = await page.locator('#step-title').boundingBox();
      expect(title!.y).toBeGreaterThanOrEqual(header!.y + header!.height);
      expect(
        (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
          .violations,
      ).toEqual([]);
      await page.screenshot({ path: `${out}/${slug}-${step}-320.png`, fullPage: true });
    }
});

test('a full scenario can be completed with the keyboard alone', async ({ page }) => {
  await page.goto('/#discover');
  await page.getByRole('link', { name: 'Explore the first scenario' }).first().focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#step-title')).toBeFocused();
  const next = async () => {
    await page.getByRole('button', { name: /^Next/ }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#step-title')).toBeFocused();
  };
  await next();
  await next();
  await next();
  await page.getByRole('button', { name: 'Enter the slip’s result' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByLabel('This is a synthetic result').focus();
  await page.keyboard.press('Space');
  await page.getByRole('button', { name: 'Validate observation & reassess' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#guided-result')).toBeFocused();
  await expect(page.getByTestId('result-task')).toContainText('+20.83%');
  await next();
  await page.getByRole('button', { name: 'Finish' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('scenario-missing')).toContainText('Completed');
});
