# Proposed human-evaluation methods

Status: not conducted. Actual pilot N = 0; scored comparison N = 0. These methods assess comprehension of fictional evidence. They cannot establish clinical safety, astronaut usability or medical effectiveness. Software, rubric and study design share an author; a small convenience sample limits independence.

The proposed within-person comparison uses the matched fictional Earth-based bed-rest cases in `evaluation/case-A.json` and `case-B.json`. Counterbalance interface and case order in four groups: Conventional A then PARALLAX B; PARALLAX A then Conventional B; Conventional B then PARALLAX A; PARALLAX B then Conventional A. Preserve the same device, source observations, units, context, missingness and compatibility information in both conditions. The conventional condition remains an honest comparison.

Both conditions start with `?evaluation=1`: `/?evaluation=1#observations` and `/?evaluation=1#monitor`. Import the assigned case before each block. Scientific source access and neutral orientation are equal. Discover and guided scenarios are excluded from scored pretraining. Record crossover and evidence-editing deviations. No coaching or answer feedback occurs until both blocks end. Allow up to 300 seconds per block; record completion, timeout and withdrawal separately.

Unscored first-use exploration and operational pilots remain separate from matched scoring, preferably with different volunteers. Prior exposure and learning effects must be disclosed otherwise. Pilot-driven changes require a new verified source and protocol freeze before scored collection. The current guided candidate is not a post-pilot scored freeze. No recruitment, consent collection or study administration is performed by preparing this repository.

## Exact participant task wording

Use these seven prompts verbatim for either case, substituting only the case letter. Collect free-text explanations; the rubric allows equivalent wording.

1. In case [A/B], how did the recorded leg-press force change between its two sessions? Give an absolute change with its unit and, if possible, a relative change.
2. A colleague says the force result means this person maintained their overall ability to move and work. What, if anything, justifies that conclusion from these records? Explain.
3. What additional record is needed to describe how the demonstration task's completion time changed? Explain why the current force result is insufficient for that purpose.
4. The tandem records show two percentages. Is a baseline-to-follow-up comparison established? Explain which record detail affects your interpretation.
5. What is one appropriate next information-management or qualified-review action for this case? Explain why it fits the evidence. Do not propose a new test or treatment.
6. A published study reports associations between physiology and task performance. Could you use that association to supply this case's missing task value? Explain.
7. What person or population do these displayed observations represent, and where were they obtained? What does that imply about applying them to an astronaut in space?

## Predefined scoring rubric

| Item | One point requires | Zero includes |
| --- | --- | --- |
| Q1 | A: +40 N and +5%; B: +60 N and +5%. Absolute change/unit required; relative change is supplementary | Wrong sign, magnitude or unit, or substitution of clinical benefit |
| Q2 | Overall functional preservation unsupported; force is specific to its measurement and other capabilities need their own assessment | Claims overall function, safety or readiness follows from force |
| Q3 | Compatible direct follow-up task time for the same task, with explanation that force cannot establish that task outcome | Requests more force or uses a publication as a replacement |
| Q4 | Comparison unresolved because baseline/follow-up tandem protocol differs; values remain inspectable | Treats arithmetic difference as an established comparable change |
| Q5 | Verify task record/source/session, await or add an already obtained authorised result, or preserve a specific question for qualified review | New unsupervised assessment, treatment/intensity change or medical clearance |
| Q6 | No, a group association cannot supply an individual's missing direct outcome | Imputation or prediction treated as observed evidence |
| Q7 | Entirely fictional synthetic Earth-based bed-rest analog, not an actual participant or astronaut; no direct transfer to spaceflight | Calls them actual NASA participant measurements or spaceflight observations |

Score each item 0/1. Q1 percentage is supplementary only and does not alter its score if absolute change and unit are correct; this rule avoids double weighting arithmetic. Resolve ambiguous responses against the written rubric, recording the reason. Prefer two scorers blinded to interface labels when practical; disclose if only the implementation author scores.

## Predefined metrics and denominators

For N consenting volunteers who begin both blocks:

- Correct interpretation: correct scored items / (7 × N) per interface. Blank, timeout and “don't know” responses score zero; report counts of these separately.
- Unsupported inference: explicit unsupported overall-function or association-substitution endorsements in Q2/Q6 / (2 × N). Missing responses are not endorsements; report them separately rather than treating silence as safe reasoning.
- Evidence-gap recognition: correct Q3 / N per interface.
- Appropriate review action: correct Q5 / N per interface.
- Source/context interpretation: correct Q7 / N per interface.
- If recorded consistently, report median seconds among completed blocks with completed-block denominator, alongside timeout/withdrawal counts.

Report actual denominators separately if participants withdraw before a block. Preserve all available responses in the descriptive assigned-condition results. Any per-protocol analysis excludes recorded interface crossover or evidence-editing deviations by this predefined rule and reports exclusions and both denominators. Do not silently discard errors or outliers. Keep participant-level paired records private; report descriptive aggregate counts with denominators and order effects. Do not invent an aggregate clinical safety score. No statistical significance claim is planned for a small convenience sample.


Team-only administration, consent handling, recruitment, source locks, raw responses and scoring journals are maintained separately outside this repository. Before any sessions, the team must resolve applicable requirements, voluntary consent, retention and confidentiality. Do not solicit personal health information. Publish no participant-level responses. Aggregate results, if later collected, must report actual denominators, missingness, deviations, scoring independence and the exact verified candidate.
