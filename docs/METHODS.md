# Methods and reproduction

> Public source edition: three agency photographs and their display captions were replaced with original, disclosed AI-generated illustrations. This snapshot differs visually from the linked live competition build. Historical phase results below describe their named phases; current verification is in [PUBLIC_EDITION_VERIFICATION.md](../PUBLIC_EDITION_VERIFICATION.md).

For a direct baseline `b` and follow-up `f`, absolute change is `f − b`. Force and duration additionally report `100 × (f − b) / b` when `b > 0`. A zero baseline leaves the percentage undefined. Tandem percentages use percentage-point change; signed posture-HR response uses bpm without a relative percentage. Missing values never become zero. Very small nonzero changes retain scientific notation. Recorded equality is not clinical equivalence.

A supported comparison requires exactly one direct record per phase sharing case, measure, canonical unit, protocol, comparison window and source identity, with distinct session IDs. Known follow-up time must be later than baseline. Explicitly unknown times retain their timing limitation. Conflicting quality declarations, duplicate source references, multiple candidates and incompatible protocols cannot be silently repaired or averaged. Derived records retain their dependencies and cannot replace an independent direct pair.

Where acquisition metadata is present, declared setting, activity, workload, timing and device must match. In-flight HR requires bounded acquisition metadata. Matching labels remain demonstration conditions, not scientific validation of the acquisition protocol. The action mapper changes explanations with review context without changing record origin or numerical evidence support. A ground task remains a ground task during an in-flight review.

## Inputs and state

The validator accepts only `schemaVersion: 1`, `origin: "synthetic"` packets, at most 200 observations and 250 KB. Import is atomic. The interface's downloadable template supplies a complete example. Canonical units are N, bpm, %, s and mmHg. Force, duration and percentage cannot be negative; tandem percentage cannot exceed 100. Numeric values must be finite. Unknown fields/units, malformed times and invalid/circular derivations are rejected. These constraints are schema rules, not diagnostic reference ranges.

Each observation has a unique ID, matching case ID, measure, value/unit, baseline/follow-up phase, session, protocol, window, source ID and source-record reference. Optional timestamps are real ISO UTC strings or explicit null. Direct/derived form, dependency IDs, declared issues and acquisition context remain inspectable. Updated records pass the same validator; editing a value does not clear an existing source issue. Invalid persisted state visibly restores the default case. One-step Undo is not a longitudinal clinical record.

## Reproduce calculations

Use Node 24. From `web/`, run `npm ci`, `npx playwright install chromium` and `npm run verify`. The numerical reference cases in [REFERENCE_RUBRIC.md](REFERENCE_RUBRIC.md) specify expected arithmetic independently of engine output. `tests/engine.test.ts`, `challenge.test.ts`, `research.test.ts` and `final.test.ts` check arithmetic, boundary cases and published transcriptions. The rubric and implementation share an author; this is not an independent clinical benchmark.

The science registers preserve exact published facts. Reproduction means matching the transcription and software calculation, not re-estimating a participant-level analysis. No private dataset is required. Public sources, locators, access failures and unavailable numerical bounds are retained in [DATA_SOURCES.md](DATA_SOURCES.md) and [SCIENCE.md](SCIENCE.md).

## Offline and export

Production caches same-origin application files after successful service-worker installation. Browser workflows disable network access, reload, open a new tab, inspect sources, change evidence and inspect a downloaded Markdown review. A never-installed cold start is outside this claim. External sources require connectivity. The development server does not install the production offline shell.

Reviews contain current engine findings, acquisition/provenance, gaps, review context, action state and the typed question. They do not transmit a record or establish encryption/compliance. Question text cannot impersonate generated report metadata. Plan completion and acknowledgements cannot change evidence support.

## Source packaging

After committing and verifying a clean baseline, run:

```sh
python3 web/scripts/package_source.py --output /path/outside-checkout/parallax-source.zip
```

Choose a new filename outside the checkout. The packager requires a clean tracked tree, scans the explicit tracked-file list, creates an archive of the current Git commit, inspects every member and writes a sidecar SHA-256 record. It cannot overwrite an existing archive. Extract to a new directory, install dependencies there and rerun verification. Generated build output, test reports and historical materials are excluded.

The proposed [human-evaluation methods](HUMAN_EVALUATION.md) preserve equal evidence, predeclared scoring and the distinction between unscored discovery and scored comparison. Team administration and any future participant responses are separate private workflows.

## Fictional mission observations

The mission clock opens at 29 June 2040, 12:00 UTC, after 180 days since fictional launch. Landing is a future event on 30 June. Exercise records are from 15 and 28 June at 10:00 UTC, thirteen days apart, during microgravity transit. Both declare 100 W, a final-minute reading and the same fictional monitor/protocol; these are comparison conditions, not exercise recommendations or a scientifically validated protocol. The engine calculates 140 − 125 = +15 bpm. It makes no HR-to-VO2max conversion or health-safety inference.

The 1,000 N preflight reference was acquired on Earth at 1 g on 15 December 2039. It has no follow-up and therefore no numerical change. No current Mars strength, balance or mobility value is supplied. A source-grounded post-landing requirement remains visible even though it is outside the two approach review items (exercise response and aerobic-capacity evidence). Information coverage does not measure health safety. No human review disposition is prefilled.

Fictional mission times, scientific study acquisition/publication dates and real software verification issue times are distinct clocks. The legacy guided exercise fixture retains two timestamps six milliseconds apart. This is not a plausible interval between separate exercise sessions and must not support a scientific longitudinal claim. Those historical records are unchanged; the new mission uses its own coherent fixture.

The mission planner uses schema 2 for review state, independently of the unchanged schema 1 engine packets. Its initial active set contains the 15 June cycling reference and 15 December force reference. The 28 June follow-up exists only in a fictional onboard archive until a validated retrieval command adds its ID. Every source value and metadata field must equal the canonical fictional archive record; no manual transcription is offered. Removal deletes review membership, while exclusion retains membership and withholds comparison. Source fixtures and historical guided data are unchanged.

At approach, the count covers exercise response and aerobic-capacity evidence: 0 of 2 initially, 1 of 2 after retrieval, 0 of 2 after removal. Post-landing mobility stays unresolved outside that count. A new session UUID distinguishes restarted reviews from earlier revisions. This identity does not authenticate provenance or solve concurrent browser writers.

## Revision-bound fictional review

A visitor can open health interpretation after retrieval, inspect the four-domain watchlist, designate a bounded fictional HR monitoring requirement and record a structured fictional CMO disposition. Each designation snapshots the exact evidence/context identity; each review also snapshots the plan set, supported/unknown findings, source references and limits. Evidence/context changes stale every plan conservatively. Changing the plan set stales earlier reviews. Restoring the same visible HR result does not restore currency; restart creates a new session generation.

Local record-creation/export timestamps use actual UTC. Fictional review time remains the mission clock in 2040. A snapshot retains both. The canonical handoff distinguishes current review, superseded historical snapshot and stale historical review. Its HTML and JSON exports are local files, with the same content as the visible preview. All HTML values and embedded JSON are escaped; no visitor-entered prose can impersonate generated headings or metadata. The Advanced workspace’s Markdown handoff remains unchanged.

History is bounded to five reviews and five designations. Oldest entries are explicitly evicted with counts. A download preserves a separate copy but cannot restore a mission. Recursively frozen snapshots prevent accidental application-model mutation; they do not make local storage tamper-proof. The evidence fingerprint is a local equality aid, not cryptographic authentication or clinical provenance.

## Bounded device and aggregate transformations

The original HR adapter validates a bounded per-user commercial JSON subset, maps decoded bpm without binary scaling, aligns quality by exact source tick, preserves source/provenance and applies an explicit conservative demonstration policy. Missing quality is uncertain; all nonzero masks are withheld. The latest source sample controls availability, with earlier usable samples retained only as history. Relative clock declarations avoid the source's conflicting epoch wording. [DEVICE_FORMATS.md](DEVICE_FORMATS.md) specifies all supported rules and limits.

A separate aggregate function reads the attributed Clément 2024 Table 3 tandem register. It matches group, endpoint and eyes condition before supporting after-minus-before arithmetic. Exercise eyes-closed is −21.3 percentage points; eyes-open is −10.6. The constructed closed-before/open-after +4.0 arithmetic is displayed only as misleading, with a null supported result. Those means are Exercise, not Seated. Seated matched differences are −8.8 and −7.6. All are differences of published rounded group means, not relative percentage changes or individual predictions.

## Phase 8 fictional measurement definitions

The evidence-rich Approach requirement denominator contains exercise response, recorded absolute peak oxygen uptake and self-reported sleep duration. Two of three have compatible pairs initially; retrieving the existing 28 June exercise record supplies the third. Current strength and post-landing mobility remain separate unresolved questions; historical references and duplicates do not inflate coverage. The legacy profile keeps its original denominator.

`fictional-health-register-v2` adds seven synthetic records: preflight on 16 December 2039 records 3.0 L/min absolute VO₂peak, 7.5 h reported sleep and 120 bpm at 100 W; transit records on 14 and 27 June 2040 contain 2.8/2.7 L/min and 7.5/6.5 h. These values were authored for the scenario, never transcribed from NASA participants. Original exercise dates/values and the 1,000 N reference are unchanged. Preflight HR has its own endpoint and ground monitor; no cross-gravity comparison is offered.

VO₂peak records are distinct previously collected peak-cycle gas-analysis assessments. Acquisition declares a fictional gas analyser, gas/volume calibration check, protocol, method, qualified operator and medical supervision. These declarations describe the fixture, not hardware authentication or operational validation. Both transit records match declarations and yield a descriptive -0.1 L/min difference. No HR conversion, body-mass-normalised value, VO₂max plateau or NASA requirement satisfaction follows.

Diaries record total self-reported sleep over the preceding 24 hours, ending at each dated entry. Equivalent nonoverlapping reporting periods yield a descriptive -1 h difference. Self-report does not establish actigraphy, a sleep disorder or individual fatigue impairment. Source quality and provenance are retained in the same canonical review as other records.

The surface report at 30 June 2040 17:00 fictional UTC is a descriptive crew diary, with an explicit false validated-performance flag. No numeric surface walking, fall-recovery or balance endpoint is supplied.
