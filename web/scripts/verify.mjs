import { spawnSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { sourceHash } from './source-hash.mjs';
const before = await sourceHash();
function run(args) {
  const r = spawnSync('npm', args, { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
run(['run', 'check']);
run(['run', 'lint']);
run(['run', 'format:check']);
run(['test', '--', '--reporter=json', '--outputFile=test-results/unit-results.json']);
run(['run', 'build']);
run(['run', 'test:browser']);
if (before !== (await sourceHash()))
  throw new Error('Source changed during verification. Rerun the complete checks.');
const digest = async (path) =>
  createHash('sha256')
    .update(await readFile(path))
    .digest('hex');
await mkdir('test-results', { recursive: true });
await writeFile(
  'test-results/verified-source.json',
  JSON.stringify(
    {
      sourceHash: before,
      unitReport: await digest('test-results/unit-results.json'),
      browserReport: await digest('test-results/browser-results.json'),
    },
    null,
    2,
  ),
);
run(['run', 'evaluation:record']);
run(['run', 'build']);
run(['run', 'release:check']);
console.log(
  'Verified unchanged source, matching test reports, regenerated evaluation and final production build.',
);
