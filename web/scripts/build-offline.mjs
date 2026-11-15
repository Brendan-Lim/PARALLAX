import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, relative } from 'node:path';
const root = resolve('dist');
async function files(dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) result.push(...(await files(path)));
    else if (entry.name !== 'sw.js') result.push(path);
  }
  return result.sort();
}
const paths = await files(root);
const hash = createHash('sha256');
for (const p of paths) {
  hash.update(relative(root, p));
  hash.update(await readFile(p));
}
const cache = `parallax-shell-${hash.digest('hex').slice(0, 16)}`;
const urls = ['/', ...paths.map((p) => '/' + relative(root, p).split('\\').join('/'))];
const worker = `// Generated from the exact production asset bytes. No external requests are cached.
const CACHE = ${JSON.stringify(cache)};
const ASSETS = ${JSON.stringify(urls)};
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('parallax-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.open(CACHE).then(async cache => (await cache.match(url.pathname)) || cache.match('/index.html'))));
  } else if (ASSETS.includes(url.pathname)) {
    event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(url.pathname)) || fetch(event.request)));
  }
});
`;
await writeFile(resolve(root, 'sw.js'), worker);
console.log(
  `Offline shell: ${cache}; ${urls.length} local URLs. First installation requires a connection.`,
);
