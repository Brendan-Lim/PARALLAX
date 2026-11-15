import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { noHorizontalScroll, downloadText } from './helpers';
const missionKey = 'parallax.mission.rich.v2.guided.v1';
const guide = (p: Page) => p.getByRole('complementary', { name: 'Guided mission demonstration' });
const raw = (p: Page, k = missionKey) => p.evaluate((key) => localStorage.getItem(key), k);
const saved = async (p: Page) => JSON.parse((await raw(p))!);
async function ledger(p: Page) {
  return p.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open('parallax.monitoring.v1.guided.v1');
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    try {
      const names = ['runs', 'samples', 'events', 'transitions', 'acknowledgments'];
      const tx = db.transaction(names, 'readonly');
      return Object.fromEntries(
        await Promise.all(
          names.map(
            (name) =>
              new Promise<[string, unknown[]]>((resolve, reject) => {
                const r = tx.objectStore(name).getAll();
                r.onsuccess = () => resolve([name, r.result]);
                r.onerror = () => reject(r.error);
              }),
          ),
        ),
      ) as {
        runs: { id: string; cursor: number; status: string }[];
        samples: {
          observation: { relativeSeconds: number; originalValue: number; usability: string };
        }[];
        events: { id: string; type: string }[];
        transitions: { kind: string }[];
        acknowledgments: { eventId: string }[];
      };
    } finally {
      db.close();
    }
  });
}
async function shot(p: Page, name: string) {
  await p.screenshot({ path: `test-results/phase9/screenshots/${name}.png`, fullPage: false });
}
async function retrieve(p: Page) {
  if (!(await p.getByRole('button', { name: 'Inspect archive record', exact: true }).isVisible()))
    await guide(p)
      .getByRole('button', { name: 'Inspect and retrieve the exercise record', exact: true })
      .click();
  expect((await saved(p)).includedRecordIds).not.toContain('mars-hr-jun28');
  await p.getByRole('button', { name: 'Inspect archive record', exact: true }).click();
  await expect(p.getByTestId('archive-source')).toHaveAttribute('open', '');
  await expect(p.getByTestId('archive-source')).toContainText('140 bpm');
  await expect(p.getByTestId('archive-source')).toContainText('100 W');
  await expect(p.getByRole('button', { name: 'Add record to review', exact: true })).toBeDisabled();
  await p.getByLabel(/Confirm acquisition conditions/).check();
  await shot(p, 'exercise-archive-inspection');
  await p.getByRole('button', { name: 'Add record to review', exact: true }).click();
  await expect(p.getByTestId('mission-summary-requirements')).toContainText('3 of 3');
  expect((await saved(p)).includedRecordIds).toContain('mars-hr-jun28');
  await expect(p.getByTestId('mission-chart')).toContainText('+15 bpm');
}
async function operate(p: Page, short: boolean, capture: boolean) {
  await retrieve(p);
  if (capture) await shot(p, 'retrieval-result');
  await guide(p).getByRole('button', { name: 'Set up heart-rate monitoring', exact: true }).click();
  await expect(p.locator('#m-designate')).toBeFocused();
  expect((await saved(p)).monitoringPlans).toHaveLength(0);
  if (capture) await shot(p, 'monitoring-designation');
  await p.locator('#m-designate').click();
  await expect.poll(async () => (await saved(p)).monitoringPlans.length).toBe(1);
  await guide(p)
    .getByRole('button', { name: 'Inspect the two simulated sources', exact: true })
    .click();
  await expect(p.getByRole('region', { name: 'Two simulated equipment sources' })).toBeVisible();
  await expect(p.getByTestId('exercise-source')).toContainText('125 → 140 bpm');
  await expect(p.getByTestId('exercise-source')).toContainText('PARALLAX-defined');
  if (capture) await shot(p, 'monitoring-source-overview');
  await guide(p).getByRole('button', { name: 'Start synthetic replay', exact: true }).click();
  await expect(p.getByTestId('replay-state')).toContainText('Replay paused');
  await expect.poll(async () => (await ledger(p)).samples.length).toBe(1);
  await expect(p.getByTestId('monitor-current')).toContainText('unavailable');
  await expect(p.locator('.mc-readout')).toContainText('72 bpm at 0 s');
  if (capture) await shot(p, 'wearable-usable-historical');
  await guide(p)
    .getByRole('button', { name: 'Continue to signal-quality review', exact: true })
    .click();
  for (let i = 0; i < 3; i++) {
    await guide(p).getByRole('button', { name: 'Process next source sample', exact: true }).click();
    await expect.poll(async () => (await ledger(p)).samples.length).toBe(i + 2);
  }
  await expect(p.getByTestId('quality-consequence')).toContainText(
    'The number stayed the same. Its reliability changed.',
  );
  await expect(
    guide(p).getByRole('link', { name: 'Open companion and acknowledge', exact: true }),
  ).toBeVisible();
  const before = await ledger(p);
  expect(before.samples[2].observation).toMatchObject({
    relativeSeconds: 2,
    originalValue: 72,
    usability: 'usable',
  });
  expect(before.samples[3].observation).toMatchObject({
    relativeSeconds: 3,
    originalValue: 72,
    usability: 'withheld',
  });
  expect(before.events[0].type).toBe('monitoring-interruption');
  await expect(p.getByTestId('monitor-current')).toContainText('unavailable');
  if (capture) {
    await p.getByTestId('quality-consequence').scrollIntoViewIfNeeded();
    await shot(p, 'quality-interruption');
  }
  const popup = p.waitForEvent('popup');
  await guide(p).getByRole('link', { name: 'Open companion and acknowledge', exact: true }).click();
  const c = await popup;
  await expect(c.getByTestId('companion')).toContainText('HR signal interrupted');
  await expect
    .poll(
      async () =>
        (await ledger(c)).transitions.filter((t) => t.kind === 'displayed-receipt').length,
    )
    .toBe(1);
  if (capture) await shot(c, 'companion-event');
  await c.getByRole('button', { name: 'Acknowledge notification', exact: true }).click();
  await expect(c.getByTestId('ack-state')).toContainText('Acknowledged by');
  expect((await ledger(c)).acknowledgments[0].eventId).toBe(before.events[0].id);
  if (capture) await shot(c, 'companion-acknowledged');
  await c.close();
  await p.bringToFront();
  await guide(p).getByRole('button', { name: 'Continue to human review', exact: true }).click();
  const summary = p.getByRole('definition').filter({ hasText: '2.8 → 2.7' });
  await expect(summary).toBeVisible();
  await expect(p.locator('.m-summary-list')).toContainText('7.5 → 6.5');
  await expect(p.locator('.m-summary-list')).toContainText('1,000 N');
  await expect(
    p.getByLabel('Appropriate aerobic-capacity result missing', { exact: true }),
  ).toHaveCount(0);
  await expect(
    p.getByRole('button', { name: 'Save fictional review', exact: true }),
  ).toBeDisabled();
  if (capture) await shot(p, 'review-all-findings');
  for (const name of [
    'Recorded oxygen-uptake observations reviewed',
    'Reported sleep information reviewed',
    'Monitoring interruption reviewed',
    'Post-landing function remains unknown',
  ])
    await p.getByLabel(name, { exact: true }).check();
  await p.getByRole('button', { name: 'Save fictional review', exact: true }).click();
  await expect(p.locator('#m-handoff-title')).toHaveText('Review saved');
  const review = (await saved(p)).reviews.at(-1);
  expect(review.monitoring.acknowledgments).toHaveLength(1);
  expect(review.findings).toHaveLength(5);
  if (capture) {
    await p.locator('#m-handoff-title').scrollIntoViewIfNeeded();
    await shot(p, 'current-saved-review');
  }
  const html = (await downloadText(p, 'Download mission review')).body;
  const canonical = JSON.parse(html.match(/id="canonical-review">([\s\S]*?)<\/script>/)![1]);
  const json = JSON.parse((await downloadText(p, 'Download review JSON')).body);
  expect(json).toEqual(canonical);
  expect(json.snapshot).toEqual(review);
  await guide(p)
    .getByRole('button', {
      name: short ? 'Complete short demonstration' : 'Continue to surface planning',
      exact: true,
    })
    .click();
  if (!short) {
    await expect(p.locator('#chapter-title')).toContainText('New assessment questions');
    if (capture) await shot(p, 'guided-surface');
    await guide(p)
      .getByRole('button', { name: 'Plan the next mobility assessment', exact: true })
      .click();
    await expect(p.locator('#surface-requirements')).toHaveAttribute('open', '');
    await p.getByRole('button', { name: 'Record fictional planning request', exact: true }).click();
    await expect(p.locator('main')).toContainText('Fictional planning request saved');
    await guide(p)
      .getByRole('button', { name: 'Complete guided demonstration', exact: true })
      .click();
  }
  await expect(
    guide(p).getByRole('heading', { name: 'Demonstration completed', exact: true }),
  ).toBeVisible();
  if (capture) await shot(p, short ? 'short-path-completed' : 'full-path-completed');
  expect((await saved(p)).reviews.at(-1)).toEqual(review);
  return {
    reviewId: review.id,
    samples: 4,
    events: before.events.length,
    acknowledgments: 1,
    canonicalEquality: true,
  };
}
for (const offline of [false, true])
  test(`full guided journey uses real actions, companion, durable review and canonical exports ${offline ? 'offline' : 'online'}`, async ({
    page,
    context,
  }) => {
    test.setTimeout(90000);
    const started = Date.now(),
      external: string[] = [];
    page.on('request', (r) => {
      if (!r.url().startsWith('http://127.0.0.1')) external.push(r.url());
    });
    await page.goto('/');
    if (!offline) await shot(page, 'landing-guided-entry');
    await page.getByRole('link', { name: 'Start guided mission demo', exact: true }).click();
    await expect(page.locator('.m-baseline-grid article')).toHaveCount(4);
    await expect(page.locator('main')).not.toContainText('2040-06-');
    await expect(page.locator('.m-baseline-grid')).toContainText('3.0 L/min');
    if (!offline) await shot(page, 'guided-preflight');
    if (offline) {
      await page.evaluate(async () => {
        await navigator.serviceWorker.ready;
      });
      await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
      await context.setOffline(true);
      await page.reload();
    }
    await guide(page)
      .getByRole('button', { name: 'Review baseline measurements', exact: true })
      .click();
    await expect(page.locator('#chapter-records')).toHaveAttribute('open', '');
    if (!offline) await shot(page, 'preflight-record-inspection');
    await guide(page)
      .getByRole('button', { name: 'Continue to in-flight observations', exact: true })
      .click();
    await expect(page.getByTestId('rich-vo2peak')).toContainText('2.8 → 2.7');
    await expect(page.getByTestId('transit-exercise')).toContainText('archive');
    if (!offline) await shot(page, 'guided-transit');
    await guide(page)
      .getByRole('button', { name: 'Continue to pre-landing review', exact: true })
      .click();
    await expect(page.getByTestId('mission-summary-requirements')).toContainText('2 of 3');
    if (!offline) await shot(page, 'guided-approach-initial');
    const result = await operate(page, false, !offline);
    await page.reload();
    await expect(
      guide(page).getByRole('heading', { name: 'Demonstration completed', exact: true }),
    ).toBeVisible();
    expect(external).toEqual([]);
    await mkdir('test-results/phase9', { recursive: true });
    await writeFile(
      `test-results/phase9/full-${offline ? 'offline' : 'online'}-walkthrough.json`,
      JSON.stringify(
        { automationDurationMs: Date.now() - started, humanEvaluationN: 0, ...result },
        null,
        2,
      ),
    );
  });
test('short judging path keeps all evidence and persistence prerequisites', async ({ page }) => {
  test.setTimeout(60000);
  const started = Date.now();
  await page.goto('/?demo=short#mission/health/assessments');
  await expect(guide(page)).toContainText('Step 1 of 4');
  await shot(page, 'short-path-entry');
  const result = await operate(page, true, true);
  await writeFile(
    'test-results/phase9/short-walkthrough.json',
    JSON.stringify(
      { automationDurationMs: Date.now() - started, humanEvaluationN: 0, ...result },
      null,
      2,
    ),
  );
});
test('guided Back, forward, reload, exit, resume and explicit walkthrough restart preserve evidence', async ({
  page,
}) => {
  await page.goto('/?demo=full#mission/preflight');
  await guide(page)
    .getByRole('button', { name: 'Review baseline measurements', exact: true })
    .click();
  await guide(page)
    .getByRole('button', { name: 'Continue to in-flight observations', exact: true })
    .click();
  await guide(page)
    .getByRole('button', { name: 'Continue to pre-landing review', exact: true })
    .click();
  await retrieve(page);
  const before = await raw(page);
  await guide(page).getByRole('button', { name: 'Back', exact: true }).click();
  await expect(guide(page)).toHaveAttribute('data-step', '1');
  await page.goBack();
  await expect(guide(page)).toHaveAttribute('data-step', '2');
  await page.goForward();
  await expect(guide(page)).toHaveAttribute('data-step', '1');
  await guide(page)
    .getByRole('button', { name: 'Continue to pre-landing review', exact: true })
    .click();
  await page.reload();
  expect(await raw(page)).toBe(before);
  await guide(page).getByRole('link', { name: 'Exit guided demo', exact: true }).click();
  await expect(guide(page)).toHaveCount(0);
  await page.getByRole('link', { name: 'Resume guided demo', exact: true }).click();
  await expect(guide(page)).toHaveAttribute('data-step', '2');
  expect(await raw(page)).toBe(before);
  await guide(page).getByRole('button', { name: 'Restart walkthrough', exact: true }).click();
  await page
    .getByRole('button', { name: 'Restart walkthrough with retained evidence', exact: true })
    .click();
  await expect(guide(page)).toHaveAttribute('data-step', '0');
  expect(await raw(page)).toBe(before);
});
test('starting the guide preserves an existing unrestricted active mission and review', async ({
  page,
}) => {
  await page.goto('/#mission/health/review');
  await page.getByLabel('Post-landing function remains unknown', { exact: true }).check();
  await page.getByRole('button', { name: 'Save fictional review', exact: true }).click();
  await expect(page.locator('#m-handoff-title')).toHaveText('Review saved');
  const before = await raw(page, 'parallax.mission.rich.v2');
  await page.goto('/?demo=full#mission/preflight');
  await expect(guide(page)).toBeVisible();
  await expect.poll(() => raw(page)).not.toBeNull();
  expect(await raw(page, 'parallax.mission.rich.v2')).toBe(before);
  expect((await saved(page)).reviews).toEqual([]);
  expect((await saved(page)).sessionId).not.toBe(JSON.parse(before!).sessionId);
});
test('a failed retrieval write cannot advance guided progress or claim durable evidence', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (
        k === 'parallax.mission.rich.v2.guided.v1' &&
        JSON.parse(v).includedRecordIds?.includes('mars-hr-jun28')
      )
        throw Error('test quota denial');
      return set.call(this, k, v);
    };
  });
  await page.goto('/?demo=short#mission/health/assessments');
  await page.getByRole('button', { name: 'Inspect archive record', exact: true }).click();
  await page.getByLabel(/Confirm acquisition conditions/).check();
  await page.getByRole('button', { name: 'Add record to review', exact: true }).click();
  await expect(guide(page)).toContainText('cannot confirm completion');
  await expect(
    guide(page).getByRole('button', { name: 'Set up heart-rate monitoring', exact: true }),
  ).toBeDisabled();
  expect((await saved(page)).includedRecordIds).not.toContain('mars-hr-jun28');
  await expect(guide(page)).toHaveAttribute('data-step', '2');
});
test('follower shows the real reason beside review and safely retries only after the owner closes', async ({
  page,
  context,
}) => {
  await page.goto('/?demo=short#mission/health/review');
  await expect(
    page.getByLabel('Post-landing function remains unknown', { exact: true }),
  ).toBeEnabled();
  const follower = await context.newPage();
  await follower.goto('/?demo=short#mission/health/review');
  const nearby = follower.locator('.m-fictional-review .m-editing-notice');
  await expect(nearby).toContainText('Another tab owns mission editing');
  await expect(
    follower.getByRole('button', { name: 'Save fictional review', exact: true }),
  ).toBeDisabled();
  const before = await raw(follower);
  await nearby.getByRole('button', { name: 'Retry editing', exact: true }).click();
  await expect(nearby).toBeVisible();
  expect(await raw(follower)).toBe(before);
  await shot(follower, 'read-only-recovery');
  await page.close();
  await nearby.getByRole('button', { name: 'Retry editing', exact: true }).click();
  await expect(
    follower.getByLabel('Post-landing function remains unknown', { exact: true }),
  ).toBeEnabled();
  await follower.getByLabel('Post-landing function remains unknown', { exact: true }).check();
  await follower.getByRole('button', { name: 'Save fictional review', exact: true }).click();
  await expect(follower.locator('#m-handoff-title')).toHaveText('Review saved');
  await follower.close();
});
test('unsupported single-writer browsers explain the real condition and cannot progress', async ({
  page,
}) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'locks', { value: undefined }));
  await page.goto('/?demo=short#mission/health/review');
  await expect(guide(page)).toContainText('single-writer support');
  await expect(
    guide(page).getByRole('button', { name: 'Inspect findings and save review', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Save fictional review', exact: true }),
  ).toBeDisabled();
  expect(await raw(page)).toBeNull();
});
test('direct empty monitoring provides visible sources and an actual designation route', async ({
  page,
}) => {
  await page.goto('/#mission/monitoring');
  await expect(page.getByTestId('exercise-source')).toContainText('125 bpm');
  await expect(page.getByTestId('exercise-source')).toContainText(
    '140 bpm on 2040-06-28 is archive-only',
  );
  await expect(page.getByTestId('exercise-source')).not.toContainText('+15 bpm');
  await page
    .getByRole('link', { name: 'Designate a heart-rate monitoring requirement', exact: true })
    .click();
  await expect(page.locator('#m-designate')).toBeFocused();
  expect(JSON.parse((await raw(page, 'parallax.mission.rich.v2'))!).monitoringPlans).toHaveLength(
    0,
  );
  await page.locator('#m-designate').click();
  await page.getByRole('link', { name: 'Open monitoring console', exact: true }).click();
  await expect(page.locator('#mc-start')).toBeEnabled();
});
for (const width of [320, 390, 768, 1440])
  test(`guided and unrestricted rendered layouts, keyboard and accessibility at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const route of [
      'mission/preflight',
      'mission/transit',
      'mission/health/assessments',
      'mission/monitoring',
      'mission/health/review',
      'mission/surface',
    ]) {
      await page.goto('/?demo=full#' + route);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await noHorizontalScroll(page);
      expect((await new AxeBuilder({ page }).analyze()).violations, route).toEqual([]);
      await shot(page, `guided-${route.replaceAll('/', '-')}-${width}`);
      const cta = guide(page).locator('.mg-actions .s-button').first();
      const box = await cta.boundingBox();
      expect(box?.x).toBeGreaterThanOrEqual(0);
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
      await cta.focus();
      await expect(cta).toBeFocused();
    }
  });
test('historical evaluation ignores every guide route, creates no demo state and exposes no teaching', async ({
  page,
}) => {
  for (const route of [
    'mission/preflight',
    'mission/monitoring/interruption',
    'mission/health/review',
    'mission/surface/completed',
  ]) {
    await page.goto('/?evaluation=1&demo=full#' + route);
    await expect(page.locator('.evaluation-mode')).toBeVisible();
    await expect(guide(page)).toHaveCount(0);
    expect(await raw(page)).toBeNull();
    expect(await page.evaluate(() => indexedDB.databases())).toEqual([]);
    await expect(page.locator('body')).not.toContainText('The number stayed the same.');
  }
});
test('a conclusion route cannot replace incomplete real actions', async ({ page }) => {
  await page.goto('/?demo=short#mission/health/review/completed');
  await expect(guide(page)).toContainText('Some actions still need review');
  await expect(
    guide(page).getByRole('heading', { name: 'Demonstration completed', exact: true }),
  ).toHaveCount(0);
  expect((await saved(page)).reviews).toHaveLength(0);
  await guide(page)
    .getByRole('button', { name: 'Return to the incomplete action', exact: true })
    .click();
  await expect(guide(page)).toHaveAttribute('data-step', '2');
});
test('ownership acquisition failure is identified without enabling a writer', async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator.locks, 'request', {
      value: () => Promise.reject(Error('test lock denial')),
    }),
  );
  await page.goto('/?demo=short#mission/health/review');
  await expect(page.locator('.m-fictional-review .m-editing-notice')).toContainText(
    'ownership could not be acquired',
  );
  await expect(
    page.getByLabel('Post-landing function remains unknown', { exact: true }),
  ).toBeDisabled();
  expect(await raw(page)).toBeNull();
});
test('rich watch figures, exclusions, inspection and force action follow the actual record state', async ({
  page,
}) => {
  await page.goto('/#mission/health/watchlist');
  await expect(page.getByTestId('watch-aerobic').locator('.m-watch-figure')).toContainText(
    '2.8 → 2.7',
  );
  await expect(page.getByTestId('watch-sleep').locator('.m-watch-figure')).toContainText(
    '7.5 → 6.5',
  );
  await page.getByRole('link', { name: 'Review gas-analysis records', exact: true }).click();
  await expect(page.getByTestId('rich-vo2peak').locator(':scope > details')).toHaveAttribute(
    'open',
    '',
  );
  await page.evaluate(() => {
    const k = 'parallax.mission.rich.v2',
      s = JSON.parse(localStorage.getItem(k)!);
    s.excludedRecordIds.push(
      s.includedRecordIds.find((id: string) => id.includes('vo2peak-2040-06-27')),
    );
    s.evidenceRevision++;
    s.evidenceLineage = crypto.randomUUID();
    localStorage.setItem(k, JSON.stringify(s));
  });
  await page.reload();
  await expect(page.getByTestId('rich-vo2peak').locator('.m-chip').first()).toHaveClass(
    /is-withheld/,
  );
  await page.getByTestId('rich-vo2peak').locator(':scope > details > summary').click();
  await expect(page.getByTestId('rich-vo2peak').locator('.m-records')).toContainText(
    'Excluded from this review',
  );
  await expect(page.getByTestId('mission-summary-observations')).not.toContainText(
    'VO₂peak and sleep pairs available',
  );
  await page
    .getByRole('link', { name: 'Review force assessment requirements', exact: true })
    .click();
  await expect(page.locator('#m-task-force')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('assessment-force')).toBeVisible();
});
test('a saved guided review remains immutable and historical after evidence removal', async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto('/?demo=short#mission/health/assessments');
  await operate(page, true, false);
  const review = (await saved(page)).reviews.at(-1);
  await page.goto('/?demo=short#mission/health/assessments');
  await page.getByRole('button', { name: 'Undo retrieval', exact: true }).click();
  await page.goto('/?demo=short#mission/health/review');
  await expect(page.getByTestId('review-currency')).toContainText('Stale review');
  expect((await saved(page)).reviews.at(-1)).toEqual(review);
  await page.locator('#m-handoff-title').scrollIntoViewIfNeeded();
  await shot(page, 'historical-review');
  await page.goto('/?demo=short#mission/health/review/completed');
  await expect(guide(page)).toContainText('Some actions still need review');
});
