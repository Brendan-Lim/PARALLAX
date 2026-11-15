import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { sourceHash } from './source-hash.mjs';
const unit = JSON.parse(await readFile('test-results/unit-results.json', 'utf8'));
const browser = JSON.parse(await readFile('test-results/browser-results.json', 'utf8'));
if (
  !unit.success ||
  unit.numFailedTests !== 0 ||
  unit.numPassedTests !== unit.numTotalTests ||
  browser.stats.unexpected ||
  browser.stats.skipped ||
  browser.stats.flaky ||
  !browser.stats.expected
)
  throw new Error('Evaluation summary requires complete passing run reports.');
const provenance = JSON.parse(await readFile('test-results/verified-source.json', 'utf8'));
const digest = async (path) =>
  createHash('sha256')
    .update(await readFile(path))
    .digest('hex');
if (
  provenance.sourceHash !== (await sourceHash()) ||
  provenance.unitReport !== (await digest('test-results/unit-results.json')) ||
  provenance.browserReport !== (await digest('test-results/browser-results.json'))
)
  throw new Error('Verification provenance mismatch. Run npm run verify for the current source.');
const issued = new Date().toISOString();
const hash = await sourceHash();
const report = `PARALLAX — Software evaluation record

Issued: ${issued}
Source and test SHA-256: ${hash}

${unit.numPassedTests}/${unit.numTotalTests} unit/scenario tests passed.
${browser.stats.expected} Chromium workflows passed; zero skipped, flaky or unexpected results.
TypeScript, lint, formatting, unchanged-source/report provenance and production build checks passed. The complete verifier runs release/privacy/size checks after generating this record; consult its final exit status.

Verified behavior and limits: the source-matched tests, docs/VALIDATION.md and docs/DEVICE_FORMATS.md. Coverage includes persisted reviews, navigation, guide recovery, immutable cutoffs, local planning, ownership, accessibility and installed offline use. Equipment sources are simulated; never-installed offline use is outside scope.

All individual observations are fictional. Human evaluation N = 0 (pilot and scored). Shared engineering, rubric and transcription authorship limits independence. No human comprehension benefit, astronaut usability, physical-device integration, clinical/flight validation, readiness or medical safety is established. No participant-level NASA data or private audit results are used.

Reproduce with Node 24 from web/: npm ci; CI=1 npm run verify. Browser installation may be required. Standalone builds remain unverified until source-matched checks pass. Publication rights and competition eligibility remain unresolved.
`;
await writeFile('public/evaluation.txt', report);
console.log(
  `Evaluation record: ${unit.numPassedTests} unit/scenario tests; ${browser.stats.expected} browser tests; source ${hash}`,
);
