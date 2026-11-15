# Reference rubric — written before the engine

This is a software/scientific scope rubric, not medical validation. Expected outcomes below are specified directly from measurement arithmetic and the product's narrow scientific scope. The production engine must not generate its own expected answers.

## Numerical reference cases

- Force 1000 N → 1050 N: +50 N, +5%; supports recorded increase only.
- Task 20 s → 26 s: +6 s, +30%; completion took longer, no impairment or readiness inference.
- Tandem 95% → 80%: −15 percentage points, not −15% relative change.
- Posture HR response 20 bpm → 35 bpm: +15 bpm; relative percentage suppressed.
- Force 0 N → 10 N: +10 N; relative change undefined, never Infinity.
- Equal values: zero absolute and relative change where defined; no claim of clinical equivalence.
- Negative force, out-of-range percentage, nonfinite numbers, malformed date and unknown units: reject import.

## Evidence reference cases

1. One compatible direct baseline and follow-up: support the narrowly recorded change.
2. Hide follow-up task: task comparison insufficient; force remains supported; source records retained.
3. Restore follow-up task: comparison returns exactly to its original result.
4. Missing baseline: insufficient; never use zero as a replacement.
5. Mixed protocol, comparison window, unit, source or case: no compatible pair.
6. Follow-up timestamp precedes baseline: unresolved; never reorder or silently repair.
7. Unknown timestamps with explicit valid phase roles: describe nominal session comparison and expose unknown timing.
8. Two direct baselines or follow-ups for one measure: unresolved until selection is explicit.
9. Derived record with no direct pair: insufficient. Derivation does not make an independent observation.
10. Exact duplicate ID: invalid import. Distinct IDs referring to the same source record cannot double evidence.
11. Declared conflicting timestamp or quality issue: unresolved.
12. Complete muscle observations plus NASA scientific context, no task measurements: task remains insufficient.
13. Complete four-domain observations: overall functional preservation and EVA clearance remain outside scope.
14. Changed imported synthetic values: comparisons and review export must change.
15. Invalid persisted state: restore the documented default safely and tell the user.

## Challenge set

A separate frozen fixture file will contain eight boundary scenarios: zero baseline, negative signed HR response, missing task baseline, mismatched protocol, reversed dates, duplicate provenance, a derived-only follow-up and an entirely empty observation set. Expected statuses and arithmetic are specified without calling the production engine. The same author creates both rubric and implementation; these fixtures are a reserved challenge set, not an independent external review or unbiased clinical benchmark.

## Conventional comparison

Both interfaces show the same legitimate values, units, baseline/follow-up context, missingness and quality flags. Only PARALLAX adds claim-specific requirements and interpretation. Human questions should ask for transfer of understanding using comparable distinct cases, counterbalanced order and paraphrased tasks, not verbatim matching of UI wording. No human participants or outcomes may be invented.
