# Documented-format ingestion

PARALLAX implements an original, offline commercial Astroskin HR/quality JSON subset using independently authored synthetic fixtures. Integration maturity is **Level 1: documented-format compatibility**. No physical device, authorised recording, commercial service, vendor SDK, flight-system interface or clinical interoperability has been tested. CSA Bio-Monitor supplies spaceflight context; it does not define this commercial interface or endorse PARALLAX.

## Supported subset

The [commercial API reference](https://astro.hexoskin.com/docs/index.html) identifies its version as 3.3.x. Definitions were checked on 14 November 2026. Adapter astro-hr-json-1 uses source definition commercial-api-3.3.x-reviewed-2026-11-14 and fixtures astro-synthetic-hr-1.

The [data endpoint](https://astro.hexoskin.com/docs/resource/data/) describes an array of per-user objects with datatype-keyed timestamp/value arrays. The subset accepts exactly one object, exactly user and data fields, the bundled synthetic user URI, numeric key "19" and optional "1000". HR must contain at least one sample. Missing quality is accepted as uncertain, never good. URI keys, flattened/no-timestamp/seconds exports, other channels, metadata fields, source identities and versions are rejected. This deliberately narrow subset does not claim complete API conformance.

Input limits: 32,768 UTF-8 bytes; 128 pairs per channel; nesting depth eight; finite numeric values; integer byte quality masks; safe integer, strictly increasing source ticks. The project declaration supports a relative one-hour window (0–921,600 ticks), on a 256-tick sampling grid. Duplicate JSON keys, duplicate/out-of-order timestamps, unknown fields and malformed tuples reject the whole batch. No coercion or partial ingestion occurs.

The separate parallax.synthetic-acquisition/1 declaration is project-defined. Its synthetic source/device/record/acquisition identities, decoded-unit basis and relative clock are supplied by bundled application code. They are not native endpoint fields. Unknown activity/workload and hardware/firmware remain unknown. There is no public import control or personal-record entry.

## Mapping and quality

| Input                     | Canonical output                                                | Rule                                                                              |
| ------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Per-user user             | sourceUser                                                      | Exact bundled synthetic URI; no authentication implied                            |
| "19"                      | sourceDatatype, measurement                                     | 19; device-heart-rate, separate from exercise assessment                          |
| HR tuple value            | originalValue, originalUnit, value, unit                        | Decoded JSON bpm → bpm; identity transform; no binary scaling                     |
| HR tuple timestamp        | originalTicks, unit, clock, relativeSeconds                     | Preserve integer; declared relative ticks / 256; absolute acquisition time null   |
| Array position            | sourceOrder                                                     | Preserve source order; reject unordered/duplicate ticks                           |
| "1000" at the same tick   | originalQualityCode, qualitySourceOrder, conditions             | Exact timestamp, same source/record/context; no carry-forward or positional match |
| Missing/unmatched quality | uncertain; unmatched quality ticks                              | No usable current sample; extra quality remains visible in raw input              |
| System ingestion call     | receivedAt                                                      | Actual system receipt ISO time, independent of source or fictional time           |
| Project acquisition       | Source/device/record/acquisition IDs; activity/workload/setting | Synthetic context; no invented exercise workload                                  |
| Raw payload bytes         | SHA-256 payload identity and retained raw body                  | Change detection and reproduction, not clinical authenticity                      |
| Explicit mission binding  | Plan ID/revision; exact evidence identity; fictional time       | Separate from source/acquisition data                                             |

[Datatype definitions](https://astro.hexoskin.com/docs/resource/datatype/) describe HR 19 as a 1 Hz output averaged over the last 16 beats, initialised to 70 bpm, with a 30–220 bpm measurement range. Invalid detection can preserve the preceding valid HR. This range is a device domain, never a health or alarm classification.

Quality 1000 is channel-specific. Its documented bit meanings and the application policy are separate:

| Mask                  | Reported condition                        | PARALLAX policy                           |
| --------------------- | ----------------------------------------- | ----------------------------------------- |
| 0                     | Vendor reports good ECG signal            | Usable for the bounded demonstration only |
| 1                     | Reserved bit 0                            | Withheld                                  |
| 2                     | Shirt/garment disconnected                | Withheld                                  |
| 4                     | Dominant 50/60 Hz interference            | Withheld                                  |
| 8                     | ECG saturation                            | Withheld                                  |
| 16                    | Movement artifacts affecting RR precision | Withheld                                  |
| 32                    | Unreliable RR intervals                   | Withheld                                  |
| 64 / 128              | Undefined by reviewed HR definitions      | Preserve as unknown flags; withhold       |
| No exact-time quality | Quality unknown                           | Uncertain; no usable current value        |

All simultaneous flags are exposed. Values outside the byte representation reject the batch. Good reported signal does not prove placement, independent accuracy, physiological freshness, medical safety or good health.

The latest source sample determines current demonstration availability. If it is withheld/uncertain, an earlier usable observation remains historical at its original time. Repeated identical numbers alone do not prove retention. Fixtures demonstrate good repeated HR, later disconnection, four simultaneous conditions and misaligned/missing quality.

## Clocks, plans and ownership

The reference's HexoTimestamp text names a noon epoch while also describing UNIX seconds multiplied by 256 and giving a numerical example consistent with that calculation. This implementation makes no absolute-epoch choice. Its synthetic project declaration explicitly uses relative ticks anchored at zero. A real recording would require independently established clock metadata. Receipt time establishes neither acquisition time nor freshness. The fictional 2040 mission clock appears only in the separate association.

The plan association requires the exact current designation, mission/astronaut/session, evidence/context identity, plan revision, source/adapter version, HR quantity/unit/datatype and synthetic acquisition context. No designation at ingestion remains unbound even after a later designation. Evidence/context changes, restart and replacement plans cannot reactivate earlier batches. Quality usability and plan association are reported separately. Unknown activity/workload prevent any exercise-assessment comparison.

Mission source, interpretation and monitoring-policy identities advance to version 2. Historical plans/reviews keep their original fields and become stale; sourceAvailable false continues to mean no live/recorded acquisition source. Synthetic compatibility is disclosed separately. Historical handoffs retain their original snapshot and historical limitations.

One finite batch is held in the mission source view's memory, replaced on processing and cleared on close/reload. Only the existing authoritative mission writer can enable processing. Telemetry never writes mission storage, assessment membership or the legacy evaluator. A follower cannot ingest through its disabled controls. This Phase 4 finite-batch surface remains independent. Phase 5 adds a separate bounded synthetic replay and event ledger described below. No continuous background medical monitoring is supported.

## Rights and remaining channels

Implementation uses documented technical facts and original code/fixtures. No proprietary source, SDK, documentation capture, official sample recording or participant data is redistributed. Public accessibility is not treated as a licence grant. [API terms](https://api.hexoskin.com/docs/page/terms-and-conditions/) govern API/service use and returned content; the [developer platform](https://hexoskin.com/pages/developers) describes project/year licensing. This offline synthetic parser accesses neither. Service access, recordings, brand use, public release and competition eligibility require their own applicable rights review.

Breathing rate 33/1001, SpO₂ 66/1002 and systolic estimate 98/1005 remain unimplemented mapping contracts. No MAP substitution, clinical threshold, real medical alarm, exercise exchange or participant replay is provided. The [FDA pulse-oximetry overview](https://www.fda.gov/medical-devices/products-and-medical-procedures/pulse-oximeters) remains relevant to any later oxygen channel's accuracy limitations; no oxygen accuracy claim is made here.

## Bounded synthetic replay and companion

`#mission/monitoring` consumes eight original one-sample commercial-format JSON frames through `ingestAstroskin()`. The separate allowlisted declaration uses record `SYNTHETIC-HR-REPLAY-01`, acquisition `synthetic-relative-replay-01`, fixture `astro-coherent-replay-1`; it cannot be supplied by an ordinary payload. The existing Phase 4 batches are unchanged alternatives, never concatenated. Replay source ticks are 0–1792 in 256-tick steps. Raw HR is 72, 73, 72, 72, 72, 73, 73, 72 bpm; quality is 0, 0, 0, 2, 2, 0, missing, 0. The repeated 72 with disconnected mask 2 is withheld. Missing quality is uncertain. Usable values resume without erasing interruption history.

Replay starts only under the current fictional HR designation and mission owner. A run preserves exact mission, astronaut, session, context/evidence identity, designation/revision and adapter/source/fixture/policy versions. Replacing evidence, restoring the same numbers, replacing a plan or restarting cannot reactivate old observations. Identity is checked after asynchronous parsing and inside the persistence transaction. Physical hardware remains disconnected.

Foreground replay advances one source second per 1.2 local seconds, without catch-up. Pause, resume, next sample, stop and restart are deterministic. Hidden pages pause. More than five seconds of delayed local execution pauses with an availability interruption after usable data; no missing observations are invented. Paused, stopped, completed or expired observations are historical. These are demonstration recency rules, never physiological freshness or clinical alarm thresholds. Source time, local processing, replay progress and fictional mission time stay separate.

IndexedDB `parallax.monitoring.v1`, schema 1, has distinct runs, samples, payloads, events, transitions and acknowledgments stores. Maximums are four runs, eight samples/run, 16,384 raw payload bytes, 24 events, 96 delivery transitions and 24 acknowledgment records. Payload bytes are shared by digest; exact evidence identity is held per run. One read/write transaction commits sample, source reference, run progress and generated events together. Success is reported only after transaction completion, using strict durability hints. Quota, denial, incompatible schema and invalid recovered records stop new work visibly; existing records are not silently reset. Browser storage remains editable, evictable and unauthenticated.

An inactive run is eligible for live-history eviction only when its review-request events are acknowledged and included in retained human reviews. Otherwise capacity blocks new work; no unresolved notification is silently removed. Reviews preserve their own bounded snapshot independently of live-history eviction. A storage reset by the browser/user can still remove both stores; downloads are separate copies. New schema versions require explicit reviewed migration; unknown schemas fail closed.

A transition from previously usable data to nonusable aligned quality creates one PARALLAX monitoring-interruption event per episode. Further invalid samples do not repeat it. A usable sample ends that episode with an informational recovery event. A separate button emits one fictional PARALLAX upstream review request per run; it is neither an official Astroskin alarm nor derived from an HR threshold. Event policy is `monitoring-events-1`; recency policy is `foreground-replay-recency-1`.

The companion route `#mission/companion/<session>/<run>` opens in another tab. BroadcastChannel sends bounded identity wake-ups/heartbeats, with one-second ledger reconciliation for missed messages or missing BroadcastChannel. A send is a delivery attempt. A committed receiving render in a foreground document schedules an idempotent persisted display receipt, bound to the event identity. The check requires the notification container, not the event card to intersect the viewport. It establishes neither viewport visibility nor human attention. The interface names it a foreground render receipt. Acknowledgment is a separate validated transaction by the fictional demo recipient. Duplicate actions serialize safely. The companion never writes mission localStorage, evidence, designations or dispositions. It can acknowledge the current saved event after the owner closes, while reporting the lost owner connection. Old generations and stale plans cannot issue new active receipts or acknowledgments. Switching runs requires explicit reconnect.

New human reviews include the latest retained run in their mission generation, compact original observation values/ticks/masks, raw payload references, event meanings, actual receipts and acknowledgments, source versions and a local cutoff. Prior reviews gain no telemetry. Later ordinary samples create an information update; new interruption/upstream events create a further-monitoring-review requirement without invalidating the designation. Later receipt/ack changes are described in a separate current envelope. Preview and both downloads use the same canonical handoff object. Acknowledgment, recovery and human review never establish medical resolution or clearance.

Core local operation works after complete service-worker installation without a network. Cold first use, external papers, cleared storage, different devices/browsers/profiles/origins and reliable suspended/closed-tab delivery remain unsupported. This is an engineering demonstration, not a validated medical alarm system.

## Two simulated source concepts in Phase 9

The wearable panel processes original synthetic commercial Astroskin-format HR/quality records through the existing adapter. [CSA Bio-Monitor](https://www.asc-csa.gc.ca/eng/sciences/bio-monitor.asp) supplies spaceflight context, not flight-system compatibility. No hardware, commercial API service or unimplemented biometric channel is connected.

The cycle-ergometer panel represents separate stored fictional exercise sessions inspired by CEVIS equipment context. [NASA astronaut exercise](https://www.nasa.gov/missions/station/iss-research/astronaut-exercise/) and [Exercise Overview](https://www.nasa.gov/ochmo-tb-031-exercise-overview-2/) describe exercise workload/parameters. PARALLAX uses its existing validated exercise records, not an official CEVIS schema, vendor export, SDK, telemetry feed or equipment-control interface. Active membership and archive-only records remain explicitly distinct. Only the evaluator supplies a supported difference.

Wearable activity/workload and absolute acquisition time remain unknown. Its 72 bpm is never treated as resting HR or compared with the separate 100 W exercise pair. Gas-analysis oxygen uptake and diary sleep remain other sources. State-derived recommendations concern evidence inspection, acquisition quality, notification acknowledgment and human review. They contain no clinical thresholds, diagnosis, treatment, medical triage or clearance decision.
