# Architecture

PARALLAX is a static single-page application (TypeScript, React 19, Vite 7). It has no backend, accounts, analytics or runtime AI. All state lives in the browser.

```
Fictional observation register ──► Acquisition-aware comparison engine ──► Findings (supported / withheld + reason)
 (typed acquisition declarations)                │
                                                  ▼
                                   Requirements model ──► Named information coverage (e.g. 2/3 → 3/3)
                                                  │        + unresolved items (strength, mobility)
Synthetic Astroskin-format JSON ──► Documented-format adapter (HR 19 + quality 1000, exact-time alignment)
                                                  │
                                                  ▼
                       Replay controller ──► IndexedDB event ledger ──► BroadcastChannel ──► Companion tab
                                                  │                         (+ durable reconciliation)
                                                  ▼
                          Immutable review snapshot ──► canonical HTML + JSON handoff
Service worker: caches same-origin production assets for offline use after successful production-cache installation.
```

## Components

- **Observation register.** Each record declares its measurement, unit, gravity context, equipment, workload, timing, protocol and origin (fictional). Archive membership and active-review membership are separate.
- **Comparison engine.** It compares two records only when measurement identity and acquisition conditions match. Otherwise the result is "withheld" with a stated reason. It calculates descriptive arithmetic only: no clinical significance, scores or colour-coded health status.
- **Requirements and coverage.** Each review has named information items. Coverage counts those items and is labelled "never readiness". Historical references and future-phase requirements stay outside the denominator.
- **Documented-format adapter.** Parses the public Astroskin API JSON subset (datatype 19 heart rate, datatype 1000 quality) from original synthetic frames. A sample whose aligned quality is unusable is withheld, while its raw value is retained for inspection.
- **Monitoring ledger and companion.** Transactional IndexedDB stores samples, events, delivery receipts and acknowledgments. A same-origin companion tab is woken by BroadcastChannel and reconciles from storage. One tab owns editing through Web Locks, and other tabs are read-only.
- **Review snapshots.** Saved reviews do not change. Later evidence changes mark them as outdated, never rewritten. Preview, HTML and JSON are built from one canonical object.
- **Offline.** A content-hashed service worker caches the application shell and assets.

## Limits of the architecture

Browser storage can be edited or evicted, and it is not authentication. There is no reliable monitoring while a tab is suspended or closed. There is no multi-device consistency. There is no physical device or network transport.
