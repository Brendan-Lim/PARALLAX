# Limitations

PARALLAX is a research and education **prototype** that uses **fictional** data.

**It does not:**
- diagnose, prescribe treatment or perform clinical triage;
- provide medical clearance or decide Mars landing or EVA readiness;
- connect to physical monitoring hardware, vendor services or spacecraft systems;
- implement an official CEVIS machine-readable protocol;
- provide authentic Earth medical communication (the companion is a same-browser demonstration);
- predict individual outcomes from published group studies.

**Validation status:**
- Automated software verification only: 511 unit/scenario tests and 211 Chromium workflows (v0.10.0-alpha.10).
- Human evaluation N = 0. No astronaut, clinician or usability study has been done.
- Verified in Chromium only. Firefox and Safari are not fully validated.

**Technical limits:**
- Browser storage can be edited or evicted, and it is not authentication.
- There is no reliable monitoring while the tab is suspended or closed.
- The first visit, and external paper links, need a connection. Offline use works only after the cache is installed.
- The companion works only in the same browser profile and origin.

**Relation to the challenge:** the challenge mentions guidance on treatments. PARALLAX deliberately stops at information-handling actions and leaves treatment to qualified medical workflows.

**Future work:** integrate physical equipment through validated interfaces; integrate with qualified medical workflows; run human-factors evaluation; carry out clinical and mission-specific validation.
