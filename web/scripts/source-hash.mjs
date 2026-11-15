import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';

// Public-input SHA-256 v2: sorted repository-relative path, NUL, bytes, NUL.
// Generated notices/evaluation are excluded to avoid self-reference.
export async function sourceHash() {
  const root = resolve('..');
  async function walk(dir) {
    const result = [];
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = resolve(dir, entry.name);
      if (entry.isDirectory()) result.push(...(await walk(path)));
      else if (entry.isFile()) result.push(path);
      else throw new Error(`Unexpected non-regular source input: ${relative(root, path)}`);
    }
    return result;
  }
  const paths = (
    await Promise.all(
      ['docs', 'web/src', 'web/tests', 'web/scripts', 'web/public'].map((p) =>
        walk(resolve(root, p)),
      ),
    )
  )
    .flat()
    .filter(
      (p) =>
        !['web/public/evaluation.txt', 'web/public/third-party-notices.txt'].includes(
          relative(root, p),
        ),
    );
  for (const name of ['.gitignore', 'README.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md'])
    paths.push(resolve(root, name));
  for (const name of [
    'index.html',
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'vite.config.ts',
    'playwright.config.ts',
    'eslint.config.mjs',
    '.prettierrc.json',
    '.prettierignore',
  ])
    paths.push(resolve(name));
  const hash = createHash('sha256');
  for (const path of paths.sort((a, b) =>
    relative(root, a).localeCompare(relative(root, b), 'en'),
  )) {
    hash.update(relative(root, path));
    hash.update('\0');
    hash.update(await readFile(path));
    hash.update('\0');
  }
  return hash.digest('hex');
}
