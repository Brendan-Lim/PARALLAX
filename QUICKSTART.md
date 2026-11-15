# Quick start

## Use the hosted app
Open https://parallax-health.brendanlimkh04.workers.dev/ in a current desktop Chrome or Edge.
- **Start guided mission demo** walks you through seven steps (Preflight → Surface) using the app's real controls.
- **Short judging path** has four steps: retrieval, monitoring, companion and review.
- The companion step opens a second tab in the **same browser**. Allow it.
- Data is saved only in your browser. Do not enter real health information.

## Run locally
```sh
git clone https://github.com/Brendan-Lim/PARALLAX parallax && cd parallax/web
npm ci                 # Node.js 24
npm run build          # writes web/dist
npm run preview        # http://127.0.0.1:4173
```
Then open:
- `http://127.0.0.1:4173/?demo=full#mission/preflight`: full guided demo
- `http://127.0.0.1:4173/?demo=short#mission/health`: short judging path
- `http://127.0.0.1:4173/#research`: published research example
- `http://127.0.0.1:4173/evaluation.txt`: build and verification record

## Verify
```sh
npx playwright install chromium
npm run verify         # types, lint, format, unit/scenario tests, build, Chromium workflows, release checks
```
