import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve, relative, extname } from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { sourceHash } from './source-hash.mjs';
const root = resolve('dist');
async function walk(dir) {
  const paths = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = resolve(dir, e.name);
    if (e.isDirectory()) paths.push(...(await walk(p)));
    else paths.push(p);
  }
  return paths;
}
const paths = await walk(root);
assert(
  paths.some((p) => relative(root, p) === 'index.html'),
  'Missing app shell',
);
assert(
  paths.some((p) => relative(root, p) === 'sw.js'),
  'Missing offline shell',
);
const content = (await Promise.all(paths.map((p) => readFile(p, 'utf8')))).join('\n');
const totalBytes = (await Promise.all(paths.map((p) => stat(p)))).reduce((n, s) => n + s.size, 0);
// Public source edition uses three original, disclosed AI-generated illustrations.
// Preserve the original payload limits; this edition does not bundle agency photographs.
// Phase 5 adds a measured bounded telemetry ledger and companion without runtime dependencies.
// Phase 8's 1.51 MB / 820 KB ceilings were explicitly approved after measuring the full candidate; photography, JS and entry limits remain unchanged.
// Phase 6 presentation redesign (no new dependency) measured 1,455,152 total / 749,078
// code/text (with the full evaluation record) after removing dead CSS; within authorised ceilings.
// Phase 9: team explicitly approved only 1.53 MB total / 820 KB code after measured 1,515,480 / 809,406 bytes before the final verification record. All JS/photo gates stay fixed.
assert(totalBytes < 1_530_000, 'Total static budget exceeded (1.53 MB including photography)');
const imageBytes = (
  await Promise.all(paths.filter((p) => extname(p) === '.webp').map((p) => stat(p)))
).reduce((n, s) => n + s.size, 0);
assert(imageBytes <= 750_000, 'V4 photography budget exceeded (750 KB)');
// Phase 3 adds interpretation, snapshot validation and fictional review without dependencies.
assert(totalBytes - imageBytes < 820_000, 'Code/text/graphics budget exceeded (820 KB ceiling)');
for (const p of paths.filter((p) => /assets\/.*\.js$/.test(p)))
  assert((await stat(p)).size < 400_000, 'V4 JavaScript budget exceeded (400 KB)');
for (const p of paths) {
  assert(
    ['.html', '.js', '.css', '.svg', '.txt', '.webp'].includes(extname(p)),
    `Unexpected production file: ${relative(root, p)}`,
  );
  assert(
    !/audit|analysis_cohort|oof_predictions|\.env|\.map$|raw\/|node_modules/.test(
      relative(root, p),
    ),
    'Private or development artifact in dist',
  );
}
for (const marker of [
  'BEDREST_' + 'FTT_CFT70_',
  'GroupName,' + 'Date,Test_Phase',
  'egress_base,' + 'egress_post',
  'force_not_decreased_and_egress_increased',
  'sk-proj-',
  'BEGIN PRIVATE KEY',
  'googletagmanager.com',
  'google-analytics.com',
])
  assert(!content.includes(marker), `Forbidden payload marker: ${marker}`);
const sources = await walk(resolve('src'));
for (const p of sources) {
  const text = await readFile(p, 'utf8');
  assert(
    !/from\s*['"][^'"]*audit|fetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket\s*\(/.test(text),
    `Unexpected external data path in ${relative(process.cwd(), p)}`,
  );
}
const index = await readFile(resolve(root, 'index.html'), 'utf8');
assert(!/(?:src|href)=["']https?:/.test(index), 'External runtime asset');
assert(
  (await readFile(resolve(root, 'sw.js'), 'utf8')).includes('url.origin !== self.location.origin'),
  'Offline cache must be same-origin only',
);
assert(
  (await stat(resolve(root, 'third-party-notices.txt'))).size > 100,
  'Missing licence notices',
);
assert(
  (await readFile(resolve(root, 'evaluation.txt'), 'utf8')).includes(await sourceHash()),
  'Evaluation record does not match the current source and tests',
);
const evaluationRecord = await readFile(resolve(root, 'evaluation.txt'), 'utf8');
assert(
  !evaluationRecord.includes('UNVERIFIED BUILD'),
  'Production verification record is unverified',
);
const unitResults = JSON.parse(await readFile('test-results/unit-results.json', 'utf8'));
const browserResults = JSON.parse(await readFile('test-results/browser-results.json', 'utf8'));
assert(
  evaluationRecord.includes(
    `${unitResults.numPassedTests}/${unitResults.numTotalTests} unit/scenario tests passed.`,
  ) && evaluationRecord.includes(`${browserResults.stats.expected} Chromium workflows passed;`),
  'Production verification record must retain actual source-matched test counts',
);
const provenance = JSON.parse(await readFile('test-results/verified-source.json', 'utf8'));
assert.equal(provenance.sourceHash, await sourceHash(), 'Source verification is stale');
for (const [field, path] of [
  ['unitReport', 'unit-results.json'],
  ['browserReport', 'browser-results.json'],
])
  assert.equal(
    provenance[field],
    createHash('sha256')
      .update(await readFile(resolve('test-results', path)))
      .digest('hex'),
    'Test report provenance mismatch',
  );
console.log(
  JSON.stringify(
    {
      result: 'pass',
      productionFiles: paths.length,
      bytes: (await Promise.all(paths.map((p) => stat(p)))).reduce((n, s) => n + s.size, 0),
      checks: [
        'allowlisted static output only',
        'no audit filenames or known participant-table signatures',
        'no source maps or credentials',
        'no runtime data API or analytics',
        'local assets and licence notices',
        'offline shell included',
      ],
      limits:
        'Static checks and browser network inspection are complementary. These checks cannot prove absence of every conceivable sensitive string.',
    },
    null,
    2,
  ),
);
