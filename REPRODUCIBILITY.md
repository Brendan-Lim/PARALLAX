# Reproducibility

This is the public portfolio source edition with original generated illustrations. It differs visually from the linked deployed competition build. See [lineage and differences](docs/RELEASE_IDENTITY.md) and [current verification results](PUBLIC_EDITION_VERIFICATION.md).

Use Node.js 24 and the committed npm lockfile:

```sh
cd web
npm ci
npx playwright install chromium
npm run verify
cat public/evaluation.txt
```

The verifier binds its reports to your checkout's public-input SHA-256 and writes a new evaluation record. A standalone build is unverified until the verifier passes. Generated outputs, local test reports and node_modules remain excluded from Git. README, docs and image changes intentionally change the public-input digest.

Source packaging: from web/, run `python3 scripts/package_source.py --check`, then `python3 scripts/package_source.py --output /path/outside/checkout/parallax-source.zip` after committing a clean checkout. The package retains the screened public files and omits development history, build output and local test artifacts.

Automated journey durations are machine timings, not human completion times. Human evaluation N = 0.
