import { readFile, writeFile } from 'node:fs/promises';
const names = ['react', 'react-dom', 'scheduler', 'lucide-react'];
const notices = [
  'PARALLAX — licence and third-party runtime notices',
  '',
  'Original PARALLAX software: Apache-2.0. NASA resources and scientific publications retain their own rights. No NASA endorsement is implied.',
  await readFile('../LICENSE', 'utf8'),
  '',
];
for (const name of names) {
  const pkg = JSON.parse(await readFile(`node_modules/${name}/package.json`, 'utf8'));
  const licence = await readFile(`node_modules/${name}/LICENSE`, 'utf8');
  notices.push(`${name} ${pkg.version} — ${pkg.license}`, licence, '\n---\n');
}
const images = JSON.parse(await readFile('../docs/IMAGE_ATTRIBUTIONS.json', 'utf8'));
notices.push(
  'Original illustration provenance and SI disclosure',
  JSON.stringify(images, (key, value) => (key === 'http_verification' ? undefined : value)),
);
const aggregate = JSON.parse(await readFile('../docs/science/CLEMENT2024_TANDEM.json', 'utf8'));
notices.push(
  'Licensed scientific aggregate',
  aggregate.authors,
  aggregate.title,
  aggregate.doi,
  aggregate.url,
  aggregate.license + ': ' + aggregate.licenseUrl,
  aggregate.transformation,
  'No publication images or participant records are distributed.',
);
await writeFile('public/third-party-notices.txt', notices.join('\n'));
console.log('Runtime licence notices prepared.');
