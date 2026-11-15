# Data provenance

| Data | Origin | Notes |
|---|---|---|
| Alex Morgan, Aster mission, DEMO-MARS-01, all individual measurements (force, VO₂peak, exercise HR, sleep), reviewer actions | **Fictional**, written by the team with SI assistance | Typed `origin` provenance in `web/src/mission/observations.ts` and `richEvidence.ts`. Not NASA, CSA or participant data |
| Synthetic wearable frames (HR 72, 73, 72, 72, 72, 73, 73, 72 bpm; quality 0, 0, 0, 2, 2, 0, missing, 0) | **Synthetic**, original, written in the documented Astroskin JSON format with SI assistance | No device recording or vendor data |
| Fictional CEVIS-inspired exercise records (125, 140 bpm at 100 W) | **Fictional**, PARALLAX-defined model | No official CEVIS schema |
| Clément et al. 2024, Table 3 group means and SDs | Published, CC BY 4.0 | `docs/science/CLEMENT2024_TANDEM.json`, with attribution |
| Mulavara et al. 2018 group findings | Published | Attributed numerical facts; no figures copied |
| NASA, CSA and vendor documentation | Public web resources | Used as design input and context. No dataset ingested |
| Habitat/equipment illustrations (3) | Original OpenAI-generated scenes | Fictional educational visuals; generation disclosed. No agency photographs bundled. |

Group research never fills an individual's missing record, never sets weights and never predicts individual outcomes. Do not enter real health information. A "synthetic" label cannot de-identify real data.
