# Third-party notices

The pre-existing Apache-2.0 licence in `LICENSE` covers original PARALLAX software. Repository preparation does not select a new licence or expand third-party permissions.

The production runtime includes React, React DOM and Scheduler (MIT), and Lucide (ISC/MIT notices as shipped). `web/scripts/notices.mjs` reads their installed, lockfile-resolved licence texts and combines them with the project licence and original-illustration provenance register. `npm run build` generates `web/public/third-party-notices.txt` and copies it into the production build. The source repository retains the generator and lockfile; generated copies remain untracked.

The public source edition bundles three original AI-generated fictional illustrations in place of the original development photographs. Their generation, hashes and scope are documented in [IMAGE_ATTRIBUTIONS.json](docs/IMAGE_ATTRIBUTIONS.json). No agency photographs or identifiable people are bundled.

Scientific publications are cited in [DATA_SOURCES.md](docs/DATA_SOURCES.md) and the per-value manifests. PARALLAX distributes attributed numerical facts and original charts, without journal figures, full articles or participant data. Apache-2.0 does not relicense those publications or agency marks.

The PARALLAX mark and interface graphics are code-native assets. The procedural Mars SVG was authored with Claude assistance and is distributed under the project licence; this does not establish exclusive copyright or additional third-party rights. The app uses system fonts. AI assistance in engineering, documentation, fictional examples and evaluation design is disclosed in the app and README.

Clément, Moudy, Macaulay, Mulder and Wood (2024), Frontiers in Physiology 15:1442239, [DOI](https://doi.org/10.3389/fphys.2024.1442239), supplies the Table 3 tandem numerical register under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). PARALLAX transcribes selected group means, SDs and reported p cells and calculates rounded-mean percentage-point differences; it redistributes no publication image or participant records. The register and Research interface retain attribution, original group labels and limitations.
