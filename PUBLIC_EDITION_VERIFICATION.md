# Public source edition verification

**Replacement visuals, static checks, unit tests and build passed. The full browser run has documented guide-automation failures; no full-verifier pass is claimed.** Checked 16 November 2026.

| Check | Actual result |
|---|---|
| Checked source commit | `7ab9c2cc2999da1f2c933baccaa7c29e882ed969` |
| Checked public-input SHA-256 v2 | `2f815a45449f6ee199b32f637ff8399b207f280293c08b644f582406d3edb3a9` |
| TypeScript, ESLint, Prettier | Passed |
| Unit/scenario tests | 511/511 passed |
| Chromium workflows | 205 passed; 6 failed; 0 skipped or flaky |
| Production build | Passed; generated evaluation remains unverified because the complete verifier did not pass |
| Measured standalone-build payload | 40 files / 1,106,891 bytes; illustrations 290,268 bytes |
| Desktop and phone image checks | All three original illustrations decoded at 1440px and 390px; captions and compact-guide layouts inspected; no page errors |
| Source packaging and sensitive-pattern screening | Passed |
| Scientific, mission, monitoring, device and review logic | Byte-identical to the accepted compact-guide application |

The existing full and short guided journeys passed, including the installed-offline full journey, genuine separate companion acknowledgment, canonical review downloads and offline image loading. These checks do not imply every browser test passed.

## Known inherited guide test expectations

The compact-guide hotfix moves secondary controls behind **Guide details** and changes the primary-action container. The following older automation cases still expect the former always-expanded controls or action container and time out. They were retained rather than weakened or represented as passes. No application behavior was changed in response to these failures during this publication task.

- `phase10.spec.ts`: completed replay without companion recovers at the actual event and requires an updated cutoff
- `phase9.spec.ts`: guided Back, forward, reload, exit, resume and explicit walkthrough restart preserve evidence
- `phase9.spec.ts`: guided and unrestricted rendered layouts, keyboard and accessibility at 320px
- `phase9.spec.ts`: guided and unrestricted rendered layouts, keyboard and accessibility at 390px
- `phase9.spec.ts`: guided and unrestricted rendered layouts, keyboard and accessibility at 768px
- `phase9.spec.ts`: guided and unrestricted rendered layouts, keyboard and accessibility at 1440px

The complete verifier stops at browser failures, so final source-bound evaluation generation and final release checks were not reached. Existing historical 511/211 results belong to the earlier base candidate; they must not be copied into this edition's generated evaluation. A future maintenance task can update the guide tests for the compact controls and repeat verification.

The first attempt completed static checks, unit tests and build, then the sandbox denied binding the local preview server. The workflow was repeated with local-server/isolated-browser permission. The separate visual-check script was corrected to wait for lazy route mounting before inspecting each page; the final checks inspect the intended pages and all three images.

Final publication adds this results record, updates README and SI metadata, and adds the inventory. Those documentation-only changes alter the whole-public-input digest because it includes README and docs. Every tracked web source, test, script, lockfile and image is unchanged from the checked commit above.

This is software evidence on synthetic examples in Chromium on the local machine. It is not fresh-machine, Safari/Firefox, clinical, flight, hardware or independent human-usability validation. **Human evaluation N = 0.** The separately linked competition build has its own [release identity and historical verification](docs/RELEASE_IDENTITY.md).
