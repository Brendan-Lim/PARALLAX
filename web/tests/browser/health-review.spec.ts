import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { retrieveMissionRecord } from './missionHelpers';
import { noHorizontalScroll } from './helpers';
const key = 'parallax.mission.v1';
async function openReview(page: Page) {
  await page.getByRole('button', { name: 'Interpret health and open watchlist' }).click();
  await expect(page.locator('#m-interpretation-title')).toBeVisible();
}
async function designate(page: Page) {
  await page.getByRole('button', { name: 'Designate fictional HR monitoring requirement' }).click();
  await expect(
    page.getByRole('button', { name: 'Requirement designated for this evidence' }),
  ).toBeDisabled();
}
async function saveReview(page: Page) {
  await page.getByLabel('Post-landing function remains unknown', { exact: true }).check();
  await page.getByLabel('Appropriate aerobic-capacity result missing', { exact: true }).check();
  await page.getByRole('button', { name: 'Save fictional review' }).click();
  await expect(page.getByTestId('review-currency')).toContainText('Current review');
}
async function saved(page: Page) {
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), key);
}

test('complete assessment-to-review handoff and evidence removal preserve the historical snapshot', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?legacy=1');
  await page.getByRole('link', { name: 'Begin mission review' }).click();
  await expect(page.getByTestId('mission-no-comparison')).toBeVisible();
  await expect(page.getByTestId('mission-summary-requirements')).toContainText('0 of 2');
  await retrieveMissionRecord(page);
  await expect(page.getByTestId('mission-chart')).toContainText('+15 bpm');
  await page.getByRole('button', { name: 'Interpret retrieved findings' }).click();
  await expect(page.getByTestId('mission-planner')).toHaveCount(0);
  await expect(page.locator('#m-interpretation-title')).toBeFocused();
  const watch = page.getByRole('list', { name: 'Mission health watchlist' });
  await expect(watch.locator(':scope > li')).toHaveCount(4);
  await expect(watch.locator(':scope > li').first()).toContainText(
    'Post-landing functional capability',
  );
  await page.getByText('Why cardiovascular response matters', { exact: true }).click();
  await expect(page.getByTestId('watch-cardiovascular')).toContainText(
    'cause of any difference is unknown',
  );
  await expect(page.getByTestId('watch-aerobic')).toContainText('No suitable aerobic-capacity');
  await expect(page.getByTestId('watch-functional')).toContainText('No post-landing');
  await designate(page);
  await saveReview(page);
  const before = await saved(page);
  expect(before.reviews[0].monitoringPlans[0].currencyAtReview).toBe('current');
  await expect(page.getByTestId('mission-summary-disposition')).toContainText(
    'Review recorded for the current evidence',
  );
  await page.getByText('Preview the handoff document', { exact: true }).click();
  const preview = await page
    .getByTestId('handoff-preview')
    .locator('section')
    .evaluateAll((sections) =>
      sections.map((section) => ({
        heading: section.querySelector('h4')!.textContent,
        lines: [...section.querySelectorAll('p')].map((p) => p.textContent),
      })),
    );
  const fileEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download mission review', exact: true }).click();
  const file = await fileEvent;
  expect(file.suggestedFilename()).toMatch(/PARALLAX-mission-review-.*\.html$/);
  const html = await readFile((await file.path())!, 'utf8');
  const doc = JSON.parse(html.match(/id="canonical-review">([\s\S]*?)<\/script>/)![1]);
  expect(doc.sections).toEqual(preview);
  expect(doc.snapshot).toEqual(before.reviews[0]);
  expect(doc.currency).toBe('current-review');
  expect(html).toContain('+15 bpm');
  expect(html).toContain('Fictional CMO');
  expect(doc.snapshot.unresolvedRequirementIds).toEqual(['aerobic', 'mobility']);
  const jsonEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download review JSON' }).click();
  const json = JSON.parse(await readFile((await (await jsonEvent).path())!, 'utf8'));
  expect(json).toEqual(doc);
  await page.getByRole('button', { name: 'Plan missing assessments' }).click();
  await page.getByRole('button', { name: 'Undo retrieval' }).click();
  await expect(page.getByTestId('mission-no-comparison')).toBeVisible();
  await expect(page.getByTestId('watch-cardiovascular')).not.toContainText('+15');
  await expect(page.getByTestId('review-currency')).toContainText('Stale review');
  await expect(page.getByTestId('mission-summary-disposition')).toContainText(
    'New review required',
  );
  await page.getByText(/Monitoring designation history/).click();
  await expect(page.getByTestId('plan-history')).toContainText('Monitoring plan stale');
  const after = await saved(page);
  expect(after.reviews).toEqual(before.reviews);
  expect(after.monitoringPlans).toEqual(before.monitoringPlans);
  await expect(page.getByTestId('watch-functional')).toContainText('remains unknown');
  await page.reload();
  await openReview(page);
  await expect(page.getByTestId('review-currency')).toContainText('Stale review');
  expect((await saved(page)).reviews).toEqual(before.reviews);
  expect(errors).toEqual([]);
});

test('live exclusion removes current interpretation and restoration leaves earlier review stale', async ({
  page,
}) => {
  await page.goto('/?legacy=1#mission/health');
  await retrieveMissionRecord(page);
  await openReview(page);
  await designate(page);
  await saveReview(page);
  await page.getByText('Inspect records and comparison', { exact: true }).click();
  await page.getByLabel('Use the 28 June record in this review').uncheck();
  await expect(page.getByTestId('watch-cardiovascular')).toContainText('Evidence: excluded');
  await expect(page.getByTestId('watch-cardiovascular')).not.toContainText('+15');
  await expect(page.getByTestId('review-currency')).toContainText('Stale review');
  await page.getByLabel('Use the 28 June record in this review').check();
  await expect(page.getByTestId('watch-cardiovascular')).toContainText('+15 bpm');
  await expect(page.getByTestId('review-currency')).toContainText('Stale review');
});

test('restart preserves bounded history under a new generation and keeps prior review stale', async ({
  page,
}) => {
  await page.goto('/?legacy=1#mission/health');
  await retrieveMissionRecord(page);
  await openReview(page);
  await designate(page);
  await saveReview(page);
  const before = await saved(page);
  await page.getByRole('button', { name: 'Restart mission', exact: true }).click();
  await page.getByRole('button', { name: 'Restart mission review', exact: true }).click();
  await page.getByRole('link', { name: 'Begin mission review' }).click();
  await openReview(page);
  const after = await saved(page);
  expect(after.sessionId).not.toBe(before.sessionId);
  expect(after.reviews).toEqual(before.reviews);
  await expect(page.getByTestId('review-currency')).toContainText('Stale review');
  await expect(page.getByTestId('watch-cardiovascular')).not.toContainText('+15');
});

for (const width of [1440, 390, 320])
  test(`keyboard, focus, announcements and review reflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/?legacy=1#mission/health');
    await retrieveMissionRecord(page);
    const open = page.getByRole('button', { name: 'Interpret health and open watchlist' });
    await open.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#m-interpretation-title')).toBeFocused();
    await expect
      .poll(() =>
        page.locator('#m-interpretation-title').evaluate((el) => {
          const header = document.querySelector('.s-header')!;
          return (
            el.getBoundingClientRect().top >=
            (getComputedStyle(header).position === 'sticky'
              ? header.getBoundingClientRect().bottom
              : 0)
          );
        }),
      )
      .toBe(true);
    const designation = page.getByRole('button', {
      name: 'Designate fictional HR monitoring requirement',
    });
    await designation.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#m-designation-status')).toBeFocused();
    await expect(page.locator('#m-designation-status')).toBeInViewport();
    await expect(page.locator('#m-designation-status')).toContainText('Monitoring has not started');
    const reason = page.getByLabel('Post-landing function remains unknown', { exact: true });
    await reason.focus();
    await page.keyboard.press('Space');
    await expect(page.getByTestId('selected-disposition')).toHaveText(
      'Selected disposition: Findings reviewed; unresolved requirements retained',
    );
    const save = page.getByRole('button', { name: 'Save fictional review' });
    await save.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#m-handoff-title')).toBeFocused();
    await expect(page.locator('#m-handoff-title')).toBeInViewport();
    await expect(page.locator('#m-review-status')).toContainText('Fictional review recorded');
    await expect(page.getByTestId('review-currency')).toContainText('Current review');
    for (const label of [
      'Why post-landing functional capability matters',
      'Why aerobic capacity matters',
      'Why cardiovascular response matters',
      'Why musculoskeletal performance matters',
    ])
      await page.getByText(label, { exact: true }).click();
    await page.getByText('Preview the handoff document', { exact: true }).click();
    await noHorizontalScroll(page);
    const axe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(axe.violations).toEqual([]);
  });

test('installed production supports offline review creation, both exports and reload', async ({
  page,
  context,
}) => {
  const external: string[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith('http://127.0.0.1:4173/')) external.push(r.url());
  });
  await page.goto('/?legacy=1');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('link', { name: 'Begin mission review' }).click();
  await retrieveMissionRecord(page);
  await openReview(page);
  await designate(page);
  await saveReview(page);
  for (const label of ['Download mission review', 'Download review JSON']) {
    const event = page.waitForEvent('download');
    await page.getByRole('button', { name: label, exact: true }).click();
    expect(await (await event).path()).toBeTruthy();
  }
  const before = await saved(page);
  await page.reload();
  await openReview(page);
  await expect(page.getByTestId('review-currency')).toContainText('Current review');
  expect((await saved(page)).reviews).toEqual(before.reviews);
  expect(external).toEqual([]);
});

test('single writer keeps second tab read-only and transfers ownership only after owner closes', async ({
  page,
  context,
}) => {
  await page.goto('/?legacy=1#mission/health');
  await retrieveMissionRecord(page);
  await openReview(page);
  await designate(page);
  await saveReview(page);
  const before = await saved(page);
  const second = await context.newPage();
  await second.goto('/?legacy=1#mission/health');
  await expect(second.getByRole('status').filter({ hasText: 'Another tab owns' })).toBeVisible();
  await second.getByRole('button', { name: 'Plan missing assessments' }).click();
  await expect(second.getByRole('button', { name: 'Undo retrieval' })).toBeDisabled();
  await openReview(second);
  await expect(second.getByRole('button', { name: 'Save fictional review' })).toBeDisabled();
  expect(await saved(second)).toEqual(before);
  await page.getByRole('button', { name: 'Undo retrieval' }).click();
  await expect(second.getByTestId('watch-cardiovascular')).not.toContainText('+15');
  await expect(second.getByTestId('review-currency')).toContainText('Stale review');
  await page.close();
  await second.reload();
  await openReview(second);
  await expect(
    second.getByRole('button', { name: 'Designate fictional HR monitoring requirement' }),
  ).toBeEnabled();
  await designate(second);
  await saveReview(second);
  await second.close();
});

test('unexpected storage writer is detected before a stale mission action can overwrite it', async ({
  page,
}) => {
  await page.goto('/?legacy=1#mission/health');
  await retrieveMissionRecord(page);
  await openReview(page);
  await page.evaluate((k) => {
    const state = JSON.parse(localStorage.getItem(k)!);
    state.evidenceRevision += 1;
    state.evidenceLineage = crypto.randomUUID();
    localStorage.setItem(k, JSON.stringify(state));
  }, key);
  const newer = await page.evaluate((k) => localStorage.getItem(k), key);
  await page.getByRole('button', { name: 'Designate fictional HR monitoring requirement' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'pending action was not saved' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save fictional review' })).toBeDisabled();
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBe(newer);
});

test('missing lock support prevents mission writes while retaining read-only inspection', async ({
  page,
}) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'locks', { value: undefined }));
  await page.goto('/?legacy=1#mission/health');
  await expect(page.getByRole('status').filter({ hasText: 'single-writer support' })).toBeVisible();
  await openReview(page);
  await expect(
    page.getByRole('button', { name: 'Designate fictional HR monitoring requirement' }),
  ).toBeDisabled();
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBeNull();
});

test('review actions do not leak into the neutral evaluation or independent workspace', async ({
  page,
}) => {
  await page.goto('/#monitor');
  await expect(page.locator('.app-shell')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('parallax.synthetic.session.v1')))
    .not.toBeNull();
  const workspace = await page.evaluate(() =>
    localStorage.getItem('parallax.synthetic.session.v1'),
  );
  await page.goto('/?legacy=1#mission/health');
  await retrieveMissionRecord(page);
  await openReview(page);
  await designate(page);
  await saveReview(page);
  const before = await page.evaluate((k) => localStorage.getItem(k), key);
  await page.goto('/?evaluation=1#mission/health/review');
  await expect(page.locator('.app-shell')).toBeVisible();
  await expect(page.getByTestId('fictional-review')).toHaveCount(0);
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBe(before);
  expect(await page.evaluate(() => localStorage.getItem('parallax.synthetic.session.v1'))).toBe(
    workspace,
  );
});

test('bounded selection controls accept no name, credentials or free-form medical text', async ({
  page,
}) => {
  await page.goto('/?legacy=1#mission/health');
  await openReview(page);
  const review = page.getByTestId('fictional-review');
  await expect(review.locator('textarea,input:not([type="checkbox"])')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save fictional review' })).toBeDisabled();
  await expect(review).toContainText('authenticates no clinician');
  const options = await page.locator('#m-disposition option').allTextContents();
  expect(options).toHaveLength(4);
  expect(options.join(' ')).not.toMatch(/clearance|safe|abort|treatment/i);
});

test('persisted context change stales the review and withholds a transit number on the surface', async ({
  page,
}) => {
  await page.goto('/?legacy=1#mission/health');
  await retrieveMissionRecord(page);
  await openReview(page);
  await designate(page);
  await saveReview(page);
  const before = await saved(page);
  await page.evaluate((k) => {
    const state = JSON.parse(localStorage.getItem(k)!);
    state.context = {
      ...state.context,
      phase: 'surface',
      gravity: 'mars-0.38g',
      fictionalNow: '2040-06-30T14:00:00Z',
      contextRevision: state.context.contextRevision + 1,
      nextActivity: {
        label: 'Review lander-to-habitat transfer',
        kind: 'surface-transfer',
        at: '2040-07-01T10:00:00Z',
      },
    };
    state.evidenceLineage = crypto.randomUUID();
    localStorage.setItem(k, JSON.stringify(state));
  }, key);
  await page.reload();
  await openReview(page);
  await expect(page.getByTestId('watch-cardiovascular')).toContainText('Evidence: incompatible');
  await expect(page.getByTestId('watch-cardiovascular')).not.toContainText('+15');
  await expect(page.getByTestId('review-currency')).toContainText('Stale review');
  await expect(page.getByTestId('mission-summary-requirements')).toContainText(
    '0 of 2 surface items',
  );
  expect((await saved(page)).reviews).toEqual(before.reviews);
});

test('invalid persisted fictional reviewer is rejected visibly on production reload', async ({
  page,
}) => {
  await page.goto('/?legacy=1#mission/health');
  await retrieveMissionRecord(page);
  await openReview(page);
  await saveReview(page);
  await page.evaluate((k) => {
    const state = JSON.parse(localStorage.getItem(k)!);
    state.reviews[0].reviewer = 'Authenticated NASA flight surgeon';
    localStorage.setItem(k, JSON.stringify(state));
  }, key);
  await page.reload();
  await expect(page.getByRole('status').filter({ hasText: 'could not be resumed' })).toBeVisible();
  await openReview(page);
  await expect(page.getByTestId('mission-handoff')).toHaveCount(0);
  await expect(page.getByTestId('fictional-review')).toContainText('No human review recorded');
  await expect(page.locator('body')).not.toContainText('Authenticated NASA flight surgeon');
});
