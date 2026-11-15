import { expect, test, type Page } from '@playwright/test';
import { freshCase } from '../../src/data/cases';
import type { CasePacket } from '../../src/core/model';
import { openStep, slugs } from './helpers';

// Redesign: the workspace no longer renders the guided teaching layer at all; its navigation
// button is the sidebar's Health Monitor. Teaching documents (slip, correction log) now live in
// guided steps, which must suppress them whenever records leave a recognised teaching state.
async function importPacket(page: Page, packet: CasePacket) {
  await page.getByRole('button', { name: 'Import fictional observations' }).click();
  await page.getByLabel('Or paste demonstration JSON').fill(JSON.stringify(packet));
  await page.getByRole('button', { name: 'Validate & load' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByRole('button', { name: 'Health Monitor', exact: true }).click();
}

for (const id of ['DEMO-02', 'DEMO-05-MISMATCH', 'DEMO-04']) {
  test(`colliding import ${id} retains actual evidence without fixture sources or reset`, async ({
    page,
  }) => {
    const packet = freshCase(id);
    if (id === 'DEMO-02') packet.observations.find((r) => r.measurement === 'task')!.value = 80;
    if (id === 'DEMO-05-MISMATCH') packet.observations[1].acquisition!.workloadWatts = 180;
    if (id === 'DEMO-04') {
      const copy = packet.observations.find((r) => r.form === 'derived')!;
      copy.value = 700;
      copy.derivedFrom = [packet.observations.find((r) => r.measurement === 'task')!.id];
    }
    await page.goto('/#monitor');
    // Mission isolation leaves an unused guided namespace absent. Preserve its exact prior bytes.
    const guidedBefore = await page.evaluate(() => localStorage.getItem('parallax.guided.v1'));
    await importPacket(page, packet);
    const main = page.locator('main');
    await expect(page.getByTestId('scenario-investigation')).toHaveCount(0);
    await expect(main).not.toContainText('Assessment slip');
    await expect(main).not.toContainText('Correction log');
    await expect(main).not.toContainText('Depends on the original');
    expect(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem('parallax.synthetic.session.v1')!).packet,
      ),
    ).toEqual(packet);
    // The guided cases are untouched by a workspace import.
    const guidedAfter = await page.evaluate(() => localStorage.getItem('parallax.guided.v1'));
    expect(guidedAfter).toBe(guidedBefore);
    expect(guidedAfter ?? '').not.toContain('"value":80');
    await page.reload();
    if (id === 'DEMO-02') {
      await page.getByRole('button', { name: 'Add / update demo observation' }).click();
      await page.getByLabel('Measurement type').selectOption('task');
      await expect(page.getByLabel('Recorded value', { exact: true })).toHaveValue('');
      await page.getByRole('button', { name: 'Close observation entry' }).click();
    }
    await page.getByRole('button', { name: 'Evidence Lens', exact: true }).click();
    await expect(
      page.getByTestId(
        id === 'DEMO-02' ? 'claim-task' : id === 'DEMO-04' ? 'claim-force' : 'claim-hr',
      ),
    ).toBeVisible();
    if (id === 'DEMO-05-MISMATCH')
      await expect(page.locator('.evidence-layout')).toContainText('180');
  });
}

for (const [title, value] of [
  ['Missing Evidence', '99'],
  ['Incompatible Measurements', '155'],
  ['Dependent Observations', '1060'],
]) {
  test(`arbitrary entry in ${title} suppresses teaching material; undo and explicit load recover it`, async ({
    page,
  }) => {
    const slug =
      title === 'Missing Evidence'
        ? slugs.missing
        : title === 'Incompatible Measurements'
          ? slugs.conditions
          : slugs.copy;
    if (title === 'Dependent Observations') {
      // The guided dependency case has no entry control; an edited stored record must still be
      // recognised as outside the teaching state.
      await openStep(page, slug, 1);
      const packet = freshCase('DEMO-04');
      packet.observations.find((r) => r.id === 'DEMO-04-force-followup')!.value = Number(value);
      await page.evaluate((p) => {
        localStorage.setItem(
          'parallax.guided.v1',
          JSON.stringify({
            version: 1,
            cases: { copy: { packet: p, unavailable: [], undo: null, note: '', reached: 4 } },
            completed: [],
          }),
        );
      }, packet);
      await page.reload();
      await openStep(page, slug, 4);
      await expect(page.getByTestId('edited-records')).toBeVisible();
      await page.getByRole('button', { name: 'Restart' }).click();
      await openStep(page, slug, 4);
      await expect(page.getByTestId('edited-records')).toHaveCount(0);
      return;
    }
    await openStep(page, slug, 4);
    await expect(page.getByTestId('source-slip')).toBeVisible();
    await page
      .getByRole('button', {
        name:
          title === 'Missing Evidence'
            ? 'Enter the slip’s result'
            : 'Apply the documented workload',
      })
      .click();
    await page.getByLabel('Recorded value', { exact: true }).fill(value);
    await page.getByLabel('This is a synthetic result').check();
    await page.getByRole('button', { name: 'Validate observation & reassess' }).click();
    await expect(page.getByTestId('edited-records')).toBeVisible();
    await expect(page.getByTestId('source-slip')).toHaveCount(0);
    await expect(page.locator('.g-run')).not.toContainText('Correction log');
    await expect(page.locator('.g-run')).not.toContainText('Assessment slip');
    await page.getByRole('button', { name: 'Undo entry' }).click();
    await expect(page.getByTestId('edited-records')).toHaveCount(0);
    await expect(page.getByTestId('source-slip')).toBeVisible();
    await page.getByRole('button', { name: 'Restart' }).click();
    const restored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('parallax.guided.v1')!),
    );
    const key = title === 'Missing Evidence' ? 'missing' : 'conditions';
    expect(restored.cases[key]).toBeUndefined();
    await openStep(page, slug, 4);
    await expect(page.getByTestId('source-slip')).toBeVisible();
  });
}

test('ordinary synthetic JSON import still calculates from its own records', async ({ page }) => {
  const packet = freshCase('DEMO-01');
  packet.case.id = 'CUSTOM-SYNTHETIC';
  for (const row of packet.observations) row.caseId = packet.case.id;
  packet.observations.find((r) => r.measurement === 'force' && r.phase === 'followup')!.value =
    1200;
  await page.goto('/#monitor');
  await importPacket(page, packet);
  await expect(page.getByTestId('scenario-investigation')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Inspect muscular comparison' })).toContainText(
    '+20%',
  );
});

// Redesign: the first-use route is the landing page's single primary action, followed by the
// guided first scenario; Research and the scenario list stay reachable at every width.
test('first-use routes keep the existing experiment shortcut and science access reachable', async ({
  page,
}) => {
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/#discover');
    const shortcut = page.getByRole('link', { name: 'Explore the first scenario' }).first();
    const bounds = await shortcut.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
    await shortcut.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#step-title')).toHaveText(
      'Does more strength mean easier movement?',
    );
    await expect(page.locator('#step-title')).toBeFocused();
    await page.getByRole('link', { name: 'Research', exact: true }).click();
    await expect(page.getByTestId('associations')).toBeVisible();
    await page.getByRole('link', { name: 'Scenarios', exact: true }).click();
    await expect(page.locator('.g-card')).toHaveCount(6);
  }
});

// Redesign: guided Restart replaces the Monitor's "Reset this scenario"; the workspace keeps its
// own "Reset demonstration". Both must return exact fixture origin and clear review state.
test('scenario reset restores fixture origin and clears availability, undo and review state', async ({
  page,
}) => {
  await page.goto('/#scenarios');
  for (const [key, slug, caseId] of [
    ['missing', slugs.missing, 'DEMO-02'],
    ['conditions', slugs.conditions, 'DEMO-05-MISMATCH'],
    ['copy', slugs.copy, 'DEMO-04'],
  ] as const) {
    await page.evaluate(
      ({ key, packet }) => {
        localStorage.setItem(
          'parallax.guided.v1',
          JSON.stringify({
            version: 1,
            cases: {
              [key]: {
                packet,
                unavailable: key === 'copy' ? ['DEMO-04-force-followup'] : [],
                undo: { packet, unavailable: [] },
                note: 'Fictional review question',
                reached: 5,
              },
            },
            completed: [key],
          }),
        );
      },
      { key, packet: freshCase(caseId) },
    );
    await page.reload();
    await openStep(page, slug, 5);
    await expect(page.getByLabel('Question for the reviewer')).toHaveValue(
      'Fictional review question',
    );
    await page.getByRole('button', { name: 'Restart' }).click();
    await expect(page.locator('#step-title')).toBeFocused();
    const reset = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('parallax.guided.v1')!),
    );
    expect(reset.cases[key]).toBeUndefined();
    expect(reset.completed).toEqual([]);
    await openStep(page, slug, 5);
    await expect(page.getByLabel('Question for the reviewer')).toHaveValue('');
  }
  // Workspace reset.
  await page.goto('/#monitor');
  await page.locator('.workspace-configuration > details:first-child > summary').click();
  for (const id of ['DEMO-02', 'DEMO-05-MISMATCH', 'DEMO-04']) {
    await page.getByLabel('SYNTHETIC DEMONSTRATION').selectOption(id);
    await page.evaluate(() => {
      const key = 'parallax.synthetic.session.v1';
      const saved = JSON.parse(localStorage.getItem(key)!);
      saved.note = 'Fictional review question';
      saved.marked = ['force'];
      saved.receipts = { 'force-review': { signature: 'old-review', state: 'Acknowledged' } };
      saved.planCompleted = true;
      saved.undo = { packet: saved.packet, unavailable: [] };
      if (saved.packet.case.id === 'DEMO-04') saved.unavailable = ['DEMO-04-force-followup'];
      localStorage.setItem(key, JSON.stringify(saved));
    });
    await page.reload();
    await page.getByRole('button', { name: 'Reset demonstration' }).click();
    const reset = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('parallax.synthetic.session.v1')!),
    );
    expect(reset.note).toBe('');
    expect(reset.marked).toEqual([]);
    expect(reset.receipts).toEqual({});
    expect(reset.planCompleted).toBe(false);
    expect(reset.undo).toBeNull();
    expect(reset.unavailable).toEqual([]);
    expect(reset.packet).toEqual(freshCase(reset.packet.case.id));
    expect(reset.missionPhase).toBe(
      reset.packet.context.kind === 'inflight-demo' ? 'inflight' : 'transition',
    );
    await page.locator('.workspace-configuration > details:first-child > summary').click();
  }
});
