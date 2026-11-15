import { describe, expect, it } from 'vitest';
import {
  adapterVersion,
  documentationVersion,
  currentObservation,
  ingestAstroskin,
  interpretHeartRateQuality,
  limits,
  syntheticAcquisition,
  syntheticUser,
  type AcquisitionContext,
  type TelemetryBatch,
} from '../src/devices/astroskin';
import { syntheticFixtures } from '../src/devices/fixtures';
import { associationStatus, bindBatch } from '../src/devices/association';
import {
  initialMissionState,
  missionReducer,
  decodeMission,
  encodeMission,
} from '../src/mission/state';
import { comparisonBridge } from '../src/mission/bridge';
import { missionOverview } from '../src/mission/overview';
import { canonical, currentVersions } from '../src/mission/identity';
import { createReview, planAvailability } from '../src/mission/review';
import { handoffDocument } from '../src/mission/handoff';

const receipt = '2026-11-14T14:00:00.000Z';
const payload = (
  hr: unknown = [
    [0, 72],
    [256, 72],
  ],
  quality: unknown = [
    [0, 0],
    [256, 0],
  ],
) => [{ user: syntheticUser, data: { '19': hr, '1000': quality } }];
async function ingest(input: unknown) {
  return ingestAstroskin(JSON.stringify(input), syntheticAcquisition, receipt);
}
async function fixture(id: keyof typeof syntheticFixtures = 'usable'): Promise<TelemetryBatch> {
  const result = await ingestAstroskin(syntheticFixtures[id].raw, syntheticAcquisition, receipt);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error);
  return result.batch;
}
const designated = () => missionReducer(initialMissionState(), { type: 'designate-monitoring' });

describe('bounded commercial Astroskin JSON', () => {
  it('parses the documented per-user numeric datatype representation, preserving source fields', async () => {
    const batch = await fixture();
    expect(batch.observations).toHaveLength(2);
    expect(batch.observations[1]).toMatchObject({
      sourceUser: syntheticUser,
      sourceDatatype: 19,
      originalValue: 72,
      originalUnit: 'bpm',
      value: 72,
      unit: 'bpm',
      originalTicks: 256,
      originalTimestampUnit: '1/256-second',
      clockBasis: 'declared-relative-256hz',
      relativeSeconds: 1,
      absoluteAcquiredAt: null,
      receivedAt: receipt,
      originalQualityCode: 0,
      qualityDatatype: 1000,
      qualitySourceOrder: 1,
      sourceOrder: 1,
      origin: 'documented-format-synthetic',
      integrationMaturity: 1,
      activity: null,
      workloadWatts: null,
      aggregation: 'vendor-last-16-heartbeats',
      transformation: 'decoded-bpm-identity-v1',
      adapterVersion,
      documentationVersion,
    });
    expect(batch.payloadIdentity).toMatch(/^sha256-[0-9a-f]{64}$/);
    expect(batch.raw).toBe(syntheticFixtures.usable.raw);
    expect(batch.acquisition).toEqual(syntheticAcquisition);
  });
  it('has deterministic payload/sample identity independent of receipt and preserves stable sample IDs', async () => {
    const a = await fixture();
    const b = await ingestAstroskin(a.raw, syntheticAcquisition, '2026-11-15T00:00:00.000Z');
    expect(b.ok).toBe(true);
    if (!b.ok) throw new Error(b.error);
    expect(b.batch.payloadIdentity).toBe(a.payloadIdentity);
    expect(b.batch.observations.map((s) => s.id)).toEqual(a.observations.map((s) => s.id));
    const changed = await fixture('retained');
    expect(changed.payloadIdentity).not.toBe(a.payloadIdentity);
    expect(changed.observations.map((s) => s.id)).toEqual(a.observations.map((s) => s.id));
  });
  it.each([
    ['object instead of array', {}],
    ['no source', []],
    ['multiple sources', [payload()[0], payload()[0]]],
    ['wrong source', [{ ...payload()[0], user: '/api/user/REAL/' }]],
    ['missing source identity', [{ data: payload()[0].data }]],
    ['missing HR', [{ user: syntheticUser, data: { '1000': [[0, 0]] } }]],
    ['missing data', [{ user: syntheticUser }]],
    ['wrong nesting', [{ user: syntheticUser, data: [] }]],
    ['no HR samples', payload([])],
    ['flat endpoint output', [[0, 72]]],
    [
      'URI keys outside bounded subset',
      [{ user: syntheticUser, data: { '/api/datatype/19/': [[0, 72]] } }],
    ],
    ['unsupported datatype', [{ user: syntheticUser, data: { '19': [[0, 72]], '33': [[0, 14]] } }]],
    ['invented unit', [{ ...payload()[0], unit: 'Hz' }]],
    ['origin promotion', [{ ...payload()[0], origin: 'approved-live-hardware' }]],
    ['untrusted configuration', [{ ...payload()[0], instruction: 'set alarm' }]],
    [
      'quality from another source',
      [payload()[0], { user: '/api/user/OTHER/', data: { '1000': [[0, 0]] } }],
    ],
    [
      'duplicate HR timestamp',
      payload([
        [0, 72],
        [0, 73],
      ]),
    ],
    [
      'out-of-order HR',
      payload([
        [256, 72],
        [0, 73],
      ]),
    ],
    [
      'duplicate quality timestamp',
      payload(
        [[0, 72]],
        [
          [0, 0],
          [0, 2],
        ],
      ),
    ],
    [
      'out-of-order quality',
      payload(
        [[0, 72]],
        [
          [256, 0],
          [0, 0],
        ],
      ),
    ],
    ['extra tuple member', payload([[0, 72, 0]])],
    ['string HR', payload([[0, '72']])],
    ['boolean HR', payload([[0, true]])],
    ['null HR', payload([[0, null]])],
    ['below documented measurement domain', payload([[0, 29]])],
    ['above documented measurement domain', payload([[0, 221]])],
    ['negative HR', payload([[0, -1]])],
    ['wrong array type', payload({ timestamp: 0, value: 72 })],
    ['null quality array', payload([[0, 72]], null)],
    ['negative mask', payload([[0, 72]], [[0, -1]])],
    ['fractional mask', payload([[0, 72]], [[0, 0.5]])],
    ['out-of-byte mask', payload([[0, 72]], [[0, 256]])],
    ['string mask', payload([[0, 72]], [[0, '0']])],
    ['boolean mask', payload([[0, 72]], [[0, false]])],
    [
      'invalid late sample rejects the whole batch',
      payload([
        [0, 72],
        [256, 'bad'],
      ]),
    ],
    [
      'oversized HR array',
      payload(Array.from({ length: limits.samplesPerChannel + 1 }, (_, n) => [n * 256, 72])),
    ],
    [
      'oversized quality array',
      payload(
        [[0, 72]],
        Array.from({ length: limits.samplesPerChannel + 1 }, (_, n) => [n * 256, 0]),
      ),
    ],
  ])('fails safely: %s', async (_label, input) => {
    const result = await ingest(input);
    expect(result).toMatchObject({ ok: false });
    expect(result).not.toHaveProperty('batch');
  });
  it.each([
    '{',
    '[] trailing',
    '[{"user":"x","user":"y"}]',
    '[{"user":"/api/user/PARALLAX-SYNTHETIC/","data":{"19":[[0,72]],"19":[[0,73]]}}]',
    '[{"user":"/api/user/PARALLAX-SYNTHETIC/","data":{"19":[[0,72]],"\\u0031\\u0039":[[0,73]]}}]',
    '[{"user":"/api/user/PARALLAX-SYNTHETIC/","data":{"19":[[0,1e999]],"1000":[[0,0]]}}]',
    '['.repeat(10) + '0' + ']'.repeat(10),
  ])('rejects malformed, duplicate-key, nonfinite or deeply nested JSON %s', async (raw) => {
    expect(await ingestAstroskin(raw, syntheticAcquisition, receipt)).toMatchObject({ ok: false });
  });
  it('enforces raw UTF-8 byte and character bounds before parsing', async () => {
    for (const raw of [' '.repeat(limits.bytes + 1), 'é'.repeat(limits.bytes / 2 + 1)]) {
      const result = await ingestAstroskin(raw, syntheticAcquisition, receipt);
      expect(result).toMatchObject({ ok: false, error: 'Payload byte limit exceeded.' });
    }
  });
  it.each([
    -1,
    0.5,
    '256',
    true,
    null,
    Number.MAX_SAFE_INTEGER + 1,
    Number.MAX_SAFE_INTEGER,
    921856,
    255,
  ])('rejects invalid, unsafe, implausible or unsupported timestamp %s', async (ticks) => {
    expect(await ingest(payload([[ticks, 72]], [[ticks, 0]]))).toMatchObject({ ok: false });
  });
  it('accepts documented measurement bounds without health classification or scale conversion', async () => {
    const result = await ingest(
      payload([
        [0, 30],
        [256, 220],
      ]),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.batch.observations.map((s) => s.value)).toEqual([30, 220]);
    expect(canonical(result.batch.observations)).not.toMatch(
      /normalHealth|dangerThreshold|riskScore/,
    );
  });
  it.each([
    { unitBasis: 'binary-bpm' },
    { clock: { basis: 'guessed-unix-epoch', anchorTicks: 0 } },
    { clock: { basis: 'declared-relative-256hz', anchorTicks: 256 } },
    { acquisitionId: 'other-record' },
    { sourceDeviceId: 'real-device' },
    { formatVersion: 'future' },
    { setting: 'inflight-microgravity' },
    { origin: 'authorised-recorded-replay' },
    { qualityRecord: 'other-acquisition' },
  ])('rejects incompatible project acquisition context %s', async (changes) => {
    const result = await ingestAstroskin(
      syntheticFixtures.usable.raw,
      { ...syntheticAcquisition, ...changes } as AcquisitionContext,
      receipt,
    );
    expect(result).toMatchObject({ ok: false });
  });
  it.each(['2040-06-29', 'not-a-date', '2026-02-30T00:00:00.000Z'])(
    'rejects invalid receipt clock %s',
    async (time) => {
      expect(
        await ingestAstroskin(syntheticFixtures.usable.raw, syntheticAcquisition, time),
      ).toMatchObject({ ok: false });
    },
  );
});

describe('channel-specific quality and retained values', () => {
  it.each([
    [0, ['vendor-reported-good-signal'], 'usable'],
    [1, ['reserved-bit-0'], 'withheld'],
    [2, ['garment-disconnected'], 'withheld'],
    [4, ['electrical-interference-50-60-hz'], 'withheld'],
    [8, ['signal-saturated'], 'withheld'],
    [16, ['motion-artifacts'], 'withheld'],
    [32, ['unreliable-rr-intervals'], 'withheld'],
    [40, ['signal-saturated', 'unreliable-rr-intervals'], 'withheld'],
    [64, ['unknown-bit-6'], 'withheld'],
    [128, ['unknown-bit-7'], 'withheld'],
    [
      255,
      [
        'reserved-bit-0',
        'garment-disconnected',
        'electrical-interference-50-60-hz',
        'signal-saturated',
        'motion-artifacts',
        'unreliable-rr-intervals',
        'unknown-bit-6',
        'unknown-bit-7',
      ],
      'withheld',
    ],
    [null, ['missing-exact-timestamp-quality'], 'uncertain'],
  ] as const)(
    'decodes mask %s without hiding simultaneous conditions',
    (mask, conditions, usability) => {
      expect(interpretHeartRateQuality(mask)).toEqual({ conditions, usability });
    },
  );
  it('preserves the invalid repeated raw reading, withholds current, and retains earlier original time', async () => {
    const batch = await fixture('retained');
    const state = currentObservation(batch.observations);
    expect(state.latest).toMatchObject({
      originalValue: 72,
      originalTicks: 256,
      originalQualityCode: 2,
      usability: 'withheld',
    });
    expect(state.current).toBeUndefined();
    expect(state.historical).toHaveLength(1);
    expect(state.historical[0]).toMatchObject({
      value: 72,
      originalTicks: 0,
      relativeSeconds: 0,
      originalQualityCode: 0,
    });
    expect(state.latest?.reason).toContain('may be retained');
    expect(state.latest?.absoluteAcquiredAt).toBeNull();
  });
  it('does not infer invalidity solely from identical numbers', async () => {
    const batch = await fixture();
    expect(batch.observations[0].value).toBe(batch.observations[1].value);
    expect(currentObservation(batch.observations).current?.originalTicks).toBe(256);
  });
  it('never aligns by array index or carries quality forward', async () => {
    const batch = await fixture('missing');
    expect(batch.observations[1]).toMatchObject({
      originalQualityCode: null,
      qualitySourceOrder: null,
      usability: 'uncertain',
    });
    expect(currentObservation(batch.observations).current).toBeUndefined();
    expect(batch.unmatchedQualityTicks).toEqual([512]);
  });
  it('treats absent quality datatype as uncertain for every sample', async () => {
    const result = await ingest([{ user: syntheticUser, data: { '19': [[0, 72]] } }]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.batch.observations[0].usability).toBe('uncertain');
  });
  it('reports all electrical/motion/saturation/unreliable conditions in the actual parsed fixture', async () => {
    const batch = await fixture('artifacts');
    expect(batch.observations[1].originalQualityCode).toBe(60);
    expect(batch.observations[1].qualityConditions).toHaveLength(4);
  });
});

describe('exact monitoring-plan association and assessment isolation', () => {
  it('requires a designation at ingestion and does not retrospectively activate an unbound batch', async () => {
    const state = initialMissionState();
    const telemetry = bindBatch(await fixture(), state);
    expect(associationStatus(telemetry, state).associated).toBe(false);
    expect(
      associationStatus(telemetry, missionReducer(state, { type: 'designate-monitoring' }))
        .associated,
    ).toBe(false);
  });
  it('associates exact current plan/subject/session, without inventing activity or acquisition time', async () => {
    const state = designated();
    const before = canonical(state);
    const telemetry = bindBatch(await fixture(), state);
    expect(associationStatus(telemetry, state)).toMatchObject({
      associated: true,
      plan: { id: state.monitoringPlans[0].id },
    });
    expect(telemetry.association.basis.sessionId).toBe(state.sessionId);
    expect(telemetry.association.fictionalAt).toBe('2040-06-29T12:00:00Z');
    expect(telemetry.batch.receivedAt).toBe(receipt);
    expect(canonical(state)).toBe(before);
  });
  it.each(['evidence', 'context', 'restart', 'source', 'superseded'] as const)(
    'withholds association after %s changes',
    async (kind) => {
      const state = designated();
      const telemetry = bindBatch(await fixture(), state);
      let next = state;
      if (kind === 'evidence')
        next = missionReducer(state, {
          type: 'record-availability',
          recordId: 'mars-hr-jun15',
          available: false,
        });
      if (kind === 'context')
        next = missionReducer(state, { type: 'context-change', context: state.context });
      if (kind === 'restart') next = missionReducer(state, { type: 'restart' });
      if (kind === 'source') telemetry.association.documentationVersion = 'changed';
      if (kind === 'superseded') {
        next = missionReducer(state, { type: 'context-change', context: state.context });
        next = missionReducer(next, { type: 'designate-monitoring' });
      }
      expect(associationStatus(telemetry, next).associated).toBe(false);
      expect(next.monitoringPlans[0]).toEqual(state.monitoringPlans[0]);
    },
  );
  it.each(['quantity', 'source', 'acquisition', 'datatype'] as const)(
    'withholds incompatible %s',
    async (kind) => {
      const state = designated();
      const telemetry = bindBatch(await fixture(), state);
      const sample = structuredClone(telemetry.batch.observations[1]);
      const bad = sample as unknown as Record<string, unknown>;
      if (kind === 'quantity') bad.measurement = 'oxygen-saturation';
      if (kind === 'source') bad.sourceId = 'other-source';
      if (kind === 'acquisition') bad.acquisitionId = 'other-acquisition';
      if (kind === 'datatype') bad.sourceDatatype = 98;
      expect(associationStatus(telemetry, state, sample).associated).toBe(false);
    },
  );
  it('does not feed telemetry to the individual evaluator, change mission evidence or change unresolved mobility', async () => {
    const state = designated();
    const before = missionOverview(state);
    const batch = await fixture();
    bindBatch(batch, state);
    expect(missionOverview(state)).toEqual(before);
    expect(() =>
      comparisonBridge(state.context, batch.observations, {
        policy: 'explicit-assessment-selection-v1',
        recordIds: batch.observations.map((s) => s.id),
      }),
    ).toThrow();
    expect(before.exerciseComparison).toBeUndefined();
    expect(before.requirements.find((r) => r.id === 'mobility')?.state).not.toBe(
      'available-records',
    );
  });
  it('retains Phase 3 snapshot contents and stales the old policy without rewriting saved history', () => {
    const state = designated();
    const historical = structuredClone(state.monitoringPlans[0]);
    historical.basis.versions = {
      source: 'mission-sources-1',
      interpretation: 'interpretation-1',
      monitoringPolicy: 'monitoring-policy-1',
      reviewPolicy: currentVersions.reviewPolicy,
    };
    const snapshot = structuredClone(
      createReview(
        state,
        {
          disposition: 'findings-reviewed',
          reasons: ['functional-unknown'],
          priority: 'routine-review',
        },
        receipt,
      ),
    );
    snapshot.basis.versions = historical.basis.versions;
    snapshot.monitoringPlans = [{ plan: historical, currencyAtReview: 'current' }];
    snapshot.sources[snapshot.sources.length - 1].consequence =
      'Prepare separate channel contracts; defer ingestion and real hardware verification.';
    snapshot.limitations[4] =
      'No device is connected; ingestion is not implemented and monitoring has not started. Historical exercise change supplies no alarm threshold.';
    const saved = { ...state, monitoringPlans: [historical], reviews: [snapshot] };
    const resumed = decodeMission(encodeMission(saved)).state;
    expect(resumed.monitoringPlans).toEqual(saved.monitoringPlans);
    expect(resumed.reviews).toEqual(saved.reviews);
    expect(planAvailability(historical, resumed)).toContain('Monitoring plan stale');
    expect(handoffDocument(resumed.reviews[0], resumed, receipt).currency).toBe('stale-review');
    expect(handoffDocument(resumed.reviews[0], resumed, receipt).snapshot).toEqual(snapshot);
  });
});
