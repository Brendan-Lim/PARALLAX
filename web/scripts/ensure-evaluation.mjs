import { readFile, writeFile } from 'node:fs/promises';
import { sourceHash } from './source-hash.mjs';
const hash = await sourceHash();
const previous = await readFile('public/evaluation.txt', 'utf8').catch(() => '');
if (!previous.includes(`Source and test SHA-256: ${hash}`))
  await writeFile(
    'public/evaluation.txt',
    `PARALLAX — Software evaluation record\n\nSource and test SHA-256: ${hash}\n\nUNVERIFIED BUILD: no complete source-matched verification record is available.\nRun npm run verify to generate actual unit/scenario and Chromium workflow results.\nAll individual observations are fictional. No human, clinical or flight validation is claimed.\n`,
  );
