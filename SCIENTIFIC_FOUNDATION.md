# Scientific foundation

PARALLAX uses NASA and partner resources to decide **which questions to ask, which measurements answer them, and what must never be claimed**. It ingests no NASA participant data. The full resource-to-feature mapping, with direct URLs, is in the project's NASA Data section (reproduced in `docs/NASA_DATA.md`).

## Core principle

A mathematically correct difference is not necessarily a scientifically meaningful comparison. Two observations are compared only when their measurement identity and acquisition conditions match: gravity, equipment, workload, timing and protocol.

## How the sources shape the product

| Product behaviour | Source |
|---|---|
| Health domains: aerobic capacity, cardiovascular response, muscle strength, sensorimotor function and sleep kept separate | NASA HRP Risks; NASA Human-Systems Standards 4.0 Human Performance (4.1, 4.2, 4.6) |
| Mission framing: distance from Earth and gravity transitions move health review onto the crew | NASA HRP Five Hazards; Hazard: Distance From Earth |
| Post-landing mobility kept as an open, named requirement | NASA Human Research Roadmap, sensorimotor gap SM-204 |
| Exercise acquisition context (cycle ergometer, workload, final-minute HR) | NASA Astronaut Exercise (CEVIS); OCHMO-TB-031 Exercise Overview |
| VO₂peak kept as separate gas analysis, never estimated from HR | NTRS 20140003747 (Downs et al.) |
| Human review step; no clearance generated | NASA Human-Systems Standards 6.0 Medical Operations and 3.0 Health and Medical Care |
| Local, offline, structured handoff | NASA Ames, Earth-independent medical operations; NTRS 20220017856 (catalogue scope) |
| Wearable HR plus signal-quality context | CSA Bio-Monitor; Astroskin public API documentation |
| Physiological and functional measures can diverge | Mulavara et al. (2018) |
| Matched vs. cross-condition comparison demonstration | Clément et al. (2024), Table 3 (CC BY 4.0) |

## Worked research example

Clément et al. (2024), Exercise group, tandem walking (% correct steps), 30-day head-down-tilt bed rest:

- Eyes closed: 83.9% → 62.6% (−21.3 percentage points)
- Eyes open: 98.5% → 87.9% (−10.6 percentage points)
- Eyes-closed baseline paired with eyes-open follow-up: +4.0 points of arithmetic. **Withheld**, because the conditions differ.

These are ground-study group means. They are not individual astronaut data, they do not predict Mars outcomes, and they do not validate PARALLAX clinically.

## What the descriptive findings do not establish

- Exercise HR +15 bpm does not establish fitness decline or disease.
- VO₂peak −0.1 L/min does not establish a true VO₂max plateau or readiness.
- Sleep −1 h does not establish a sleep disorder or fatigue impairment.
- The historical 1,000 N force reading does not establish current strength.
- A quality interruption does not indicate physiological danger, and restored quality does not indicate recovery.
