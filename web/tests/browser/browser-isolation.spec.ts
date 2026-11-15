import { expect, test } from '@playwright/test';
import { realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, isAbsolute, relative } from 'node:path';

test('Chromium uses a temporary test profile and avoids the system credential store', async ({
  browser,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Chromium launch flags do not apply to other engines.');
  const session = await browser.newBrowserCDPSession();
  try {
    const { arguments: args } = await session.send('Browser.getBrowserCommandLine');
    expect(args).toContain('--use-mock-keychain');
    expect(args).toContain('--password-store=basic');
    const profiles = args.filter((arg: string) => arg.startsWith('--user-data-dir='));
    expect(profiles).toHaveLength(1);
    const profile = profiles[0].slice('--user-data-dir='.length);
    const withinTemporaryDirectory = relative(realpathSync(tmpdir()), realpathSync(profile));
    expect(withinTemporaryDirectory).not.toBe('');
    expect(withinTemporaryDirectory.split(/[\\/]/)[0]).not.toBe('..');
    expect(isAbsolute(withinTemporaryDirectory)).toBe(false);
    expect(basename(profile)).toMatch(/^playwright_chromiumdev_profile-/);
  } finally {
    await session.detach();
  }
});
