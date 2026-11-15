import { useState } from 'react';
import type { MissionState } from '../mission/state';
import { currentObservation, ingestAstroskin, syntheticAcquisition } from './astroskin';
import { associationStatus, bindBatch, type MissionTelemetry } from './association';
import { syntheticFixtures, type FixtureId } from './fixtures';

export default function DeviceDemo({
  state,
  editable,
}: {
  state: MissionState;
  editable: boolean;
}) {
  const [fixture, setFixture] = useState<FixtureId>('usable');
  const [telemetry, setTelemetry] = useState<MissionTelemetry | null>(null);
  const [notice, setNotice] = useState(
    'Synthetic source available. Choose a fixture and process its JSON.',
  );
  const [busy, setBusy] = useState(false);
  const summary = currentObservation(telemetry?.batch.observations ?? []);
  const association = telemetry ? associationStatus(telemetry, state) : null;
  const observations = telemetry?.batch.observations ?? [];
  const rejected = notice.startsWith('Batch rejected');
  async function process() {
    if (!editable || busy) return;
    setBusy(true);
    setTelemetry(null);
    const result = await ingestAstroskin(
      syntheticFixtures[fixture].raw,
      syntheticAcquisition,
      new Date().toISOString(),
    );
    if (result.ok) {
      setTelemetry(bindBatch(result.batch, state));
      setNotice('Fixture processed. Inspect the adapter output and quality conditions below.');
    } else setNotice('Batch rejected. ' + result.error + ' No current usable observation.');
    setBusy(false);
  }
  return (
    <section
      className="m-device-demo"
      aria-labelledby="device-demo-title"
      data-testid="device-demo"
    >
      <h4 id="device-demo-title">Process a synthetic Astroskin-format batch</h4>
      <p>
        Documented commercial Astroskin-format compatibility demonstrated using synthetic
        measurements. Level 1 · documented-format compatibility. Device not connected. Monitoring
        has not started.
      </p>
      <p>
        CSA Bio-Monitor establishes spaceflight relevance. This commercial format does not establish
        a flight-system interface, ISS telemetry, clinical interoperability or agency/manufacturer
        endorsement.
      </p>
      <ol className="m-pipeline" aria-label="Adapter pipeline for the selected fixture">
        <li className="is-done">
          <span>Source format</span>
          <strong>Commercial Astroskin JSON</strong>
        </li>
        <li className={telemetry ? 'is-done' : rejected ? 'is-failed' : ''}>
          <span>Validation and parsing</span>
          <strong>
            {telemetry
              ? `${observations.length} observation${observations.length === 1 ? '' : 's'} parsed`
              : rejected
                ? 'Batch rejected'
                : 'Not yet processed'}
          </strong>
        </li>
        <li className={telemetry ? 'is-done' : ''}>
          <span>Normalised observation</span>
          <strong>
            {observations.length
              ? `${observations.at(-1)!.value} bpm at ${observations.at(-1)!.relativeSeconds} s`
              : 'None'}
          </strong>
        </li>
        <li className={telemetry ? 'is-done' : ''}>
          <span>Quality interpretation</span>
          <strong>
            {observations.length
              ? (['usable', 'withheld', 'uncertain'] as const)
                  .map((u) => [observations.filter((o) => o.usability === u).length, u] as const)
                  .filter(([n]) => n > 0)
                  .map(([n, u]) => `${n} ${u}`)
                  .join(' · ')
              : 'None'}
          </strong>
        </li>
        <li className="is-absent">
          <span>Hardware</span>
          <strong>Physical device not connected</strong>
        </li>
      </ol>
      <label htmlFor="device-fixture">Bundled synthetic input</label>
      <select
        id="device-fixture"
        value={fixture}
        disabled={busy}
        onChange={(event) => {
          // Earlier output belongs to the earlier fixture; never show it under a new selection.
          setFixture(event.target.value as FixtureId);
          setTelemetry(null);
          setNotice('Fixture changed. Process it to inspect its adapter output.');
        }}
      >
        {Object.entries(syntheticFixtures).map(([id, item]) => (
          <option key={id} value={id}>
            {item.label}
          </option>
        ))}
      </select>
      <details className="m-details">
        <summary>Inspect selected source JSON and project context</summary>
        <p>
          The JSON below follows the documented data endpoint. The separate acquisition declaration
          is PARALLAX-defined. There is no upload or personal-record entry.
        </p>
        <pre tabIndex={0} data-testid="selected-source-json">
          {syntheticFixtures[fixture].raw}
        </pre>
        <pre tabIndex={0}>{JSON.stringify(syntheticAcquisition, null, 2)}</pre>
      </details>
      <button className="s-button" disabled={!editable || busy} onClick={() => void process()}>
        {busy ? 'Processing fixture…' : 'Process synthetic payload'}
      </button>
      <p role="status" aria-live="polite" aria-atomic="true">
        {notice}
      </p>
      {telemetry && (
        <>
          <p data-testid="device-association" role="status">
            <strong>
              {association?.associated
                ? 'Current plan associated. '
                : 'Plan association withheld. '}
            </strong>
            {association?.reason}
          </p>
          <p className="m-fine">
            Fictional astronaut association: {telemetry.association.basis.astronautId}; mission
            session {telemetry.association.basis.sessionId}; plan revision{' '}
            {telemetry.association.planRevision}. Fictional mission time{' '}
            {telemetry.association.fictionalAt} is separate from source time and receipt time.
          </p>
          <div data-testid="device-current" role="status" aria-live="polite" aria-atomic="true">
            <strong>
              {summary.current
                ? 'Latest sample usable for this demonstration: ' +
                  summary.current.value +
                  ' ' +
                  summary.current.unit
                : 'Current usable observation unavailable.'}
            </strong>
            <p>
              Source-relative time: {summary.latest?.relativeSeconds} s. Absolute acquisition time
              unknown. Receipt time does not establish physiological freshness.
            </p>
          </div>
          <p data-testid="device-historical">
            Earlier usable observations:
            {summary.historical.length
              ? summary.historical
                  .map(
                    (sample) =>
                      ' ' +
                      sample.value +
                      ' ' +
                      sample.unit +
                      ' at relative ' +
                      sample.relativeSeconds +
                      ' s.',
                  )
                  .join('')
              : ' none in this batch.'}{' '}
            Earlier values remain historical.
          </p>
          <div aria-label="Normalised adapter observations" data-testid="device-observations">
            {telemetry.batch.observations.map((sample) => (
              <article key={sample.id} className="m-requirement">
                <h5>
                  Source sample {sample.sourceOrder + 1} · relative {sample.relativeSeconds} s
                </h5>
                <dl className="m-option-resources">
                  <dt>Reported raw → normalised</dt>
                  <dd>
                    {sample.originalValue} {sample.originalUnit} → {sample.value} {sample.unit}
                  </dd>
                  <dt>Original timestamp</dt>
                  <dd>
                    {sample.originalTicks} ticks; 1/256-second; {sample.clockBasis}
                  </dd>
                  <dt>Quality datatype {sample.qualityDatatype}</dt>
                  <dd>
                    Mask {sample.originalQualityCode ?? 'missing'} ·{' '}
                    {sample.qualityConditions.join(', ')}
                  </dd>
                  <dt>PARALLAX usability policy</dt>
                  <dd>
                    {sample.usability}. {sample.reason}
                  </dd>
                  <dt>Actual system receipt</dt>
                  <dd>{sample.receivedAt}</dd>
                </dl>
                {sample.usability !== 'usable' && (
                  <p>
                    The raw value may be retained or otherwise unreliable. Repeated numbers alone do
                    not establish retention. It is withheld as a current usable observation.
                  </p>
                )}
              </article>
            ))}
          </div>
          {telemetry.batch.unmatchedQualityTicks.length > 0 && (
            <p>
              Unmatched quality ticks: {telemetry.batch.unmatchedQualityTicks.join(', ')}. No HR
              sample inherits them.
            </p>
          )}
          <details className="m-details">
            <summary>Inspect processed payload and canonical output</summary>
            <p>
              Both the measurements above and this inspector come from the same adapter result.
              Payload identity detects byte changes; it establishes no clinical authenticity.
            </p>
            <pre tabIndex={0} data-testid="processed-source-json">
              {telemetry.batch.raw}
            </pre>
            <pre tabIndex={0} data-testid="canonical-device-output">
              {JSON.stringify(telemetry, null, 2)}
            </pre>
          </details>
        </>
      )}
      <p>
        Decoded JSON HR uses bpm; no binary scale factor is applied. The vendor describes a 1 Hz
        output averaged over the last 16 beats, initialised at 70 bpm, with a 30–220 bpm measurement
        range. That range is not a medical safety range. Invalid detection may retain the preceding
        value.
      </p>
      <p>
        Only mask 0 with an exact-time quality entry is usable under this conservative demonstration
        policy. Missing quality is uncertain; all nonzero masks, including reserved/unknown bits,
        are withheld. Good reported signal quality does not establish good health or independently
        verified accuracy.
      </p>
      <p>
        Activity and workload are unknown. These samples cannot replace the final-minute 100 W
        exercise pair, establish aerobic capacity or resolve post-landing mobility. No clinical
        thresholds are configured.
      </p>
      <p className="m-fine">
        One finite batch is held in this view's memory and replaced on processing. Closing this view
        or reloading clears it. No recording replay, continuous monitoring, background processing or
        event delivery occurs. Respiratory rate, SpO₂ and pressure remain unimplemented.
      </p>
      <a href="https://astro.hexoskin.com/docs/resource/datatype/" target="_blank" rel="noreferrer">
        Commercial datatype definitions
      </a>
      {' · '}
      <a href="https://astro.hexoskin.com/docs/resource/data/" target="_blank" rel="noreferrer">
        Documented JSON endpoint
      </a>
    </section>
  );
}
