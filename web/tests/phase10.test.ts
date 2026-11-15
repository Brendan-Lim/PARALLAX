import { describe, expect, it } from 'vitest';
import { initialRichMissionState, missionReducer } from '../src/mission/state';
import { archiveRecords } from '../src/mission/archive';
import { guideFacts, guideRecovery, guideStep } from '../src/mission/guideState';
import { acceptBatch, acknowledge, emptyLedger, newRun, transition } from '../src/monitoring/model';
import { ingestAstroskin } from '../src/devices/astroskin';
import { replayFrames, replayAcquisition } from '../src/monitoring/fixture';
import { monitoringSnapshot } from '../src/monitoring/snapshot';
import { persistMission } from '../src/mission/writer';
const at = '2026-11-15T12:00:00.000Z';
async function fixture() {
  let state = missionReducer(initialRichMissionState(), {
    type: 'retrieve-record',
    record: archiveRecords()[0],
  });
  state = missionReducer(state, { type: 'designate-monitoring' });
  const data = emptyLedger(),
    run = newRun(state, at);
  data.runs.push(run);
  for (let i = 0; i < 4; i++) {
    const parsed = await ingestAstroskin(replayFrames[i], replayAcquisition, at);
    if (!parsed.ok) throw Error(parsed.error);
    acceptBatch(data, run, parsed.batch, i, at);
  }
  const review = () => {
    state = missionReducer(state, {
      type: 'save-review',
      selection: {
        disposition: 'findings-reviewed',
        reasons: ['functional-unknown'],
        priority: 'routine-review',
      },
      monitoring: monitoringSnapshot(data, state.sessionId, at),
    });
  };
  return {
    get state() {
      return state;
    },
    data,
    run,
    review,
  };
}
describe('bounded post-review recovery preserves the distinction between a review and a completed guide', () => {
  it('keeps saved snapshots and live actions in the human-review guide context', () => {
    expect(guideStep('#mission/health/saved')).toBe(5);
    expect(guideStep('#mission/health/actions')).toBe(5);
  });
  it('returns the first missing evidence, designation and replay action', () => {
    let state = initialRichMissionState();
    expect(guideRecovery(state, null)?.route).toBe('mission/health/assessments');
    state = missionReducer(state, { type: 'retrieve-record', record: archiveRecords()[0] });
    expect(guideRecovery(state, null)?.route).toBe('mission/health/designation');
    state = missionReducer(state, { type: 'designate-monitoring' });
    expect(guideRecovery(state, null)?.route).toBe('mission/monitoring');
  });
  it('a local saved review without acknowledgment links to its actual run', async () => {
    const f = await fixture();
    f.review();
    expect(f.state.reviews).toHaveLength(1);
    expect(guideFacts(f.state, f.data).saved).toBe(false);
    expect(guideRecovery(f.state, f.data)).toMatchObject({
      title: 'Open companion and acknowledge',
      companion: true,
      route: `mission/companion/${f.state.sessionId}/${f.run.id}`,
    });
  });
  it('a display receipt does not stand in for acknowledgment', async () => {
    const f = await fixture();
    f.review();
    transition(f.data, f.data.events[0], 'displayed-receipt', at, crypto.randomUUID());
    expect(guideRecovery(f.state, f.data)?.title).toBe('Open companion and acknowledge');
  });
  it('acknowledgment after a saved cutoff requires an updated snapshot without rewriting history', async () => {
    const f = await fixture();
    f.review();
    const first = JSON.stringify(f.state.reviews[0]);
    const recipient = crypto.randomUUID();
    transition(f.data, f.data.events[0], 'displayed-receipt', at, recipient);
    acknowledge(f.data, f.data.events[0], at, recipient);
    expect(guideRecovery(f.state, f.data)?.title).toBe('Save an updated review');
    expect(JSON.stringify(f.state.reviews[0])).toBe(first);
    f.review();
    expect(guideRecovery(f.state, f.data)).toBeNull();
    expect(guideFacts(f.state, f.data).saved).toBe(true);
    expect(JSON.stringify(f.state.reviews[0])).toBe(first);
  });
  it('new processed monitoring information requires an updated cutoff', async () => {
    const f = await fixture(),
      recipient = crypto.randomUUID();
    transition(f.data, f.data.events[0], 'displayed-receipt', at, recipient);
    acknowledge(f.data, f.data.events[0], at, recipient);
    f.review();
    const parsed = await ingestAstroskin(replayFrames[4], replayAcquisition, at);
    if (!parsed.ok) throw Error(parsed.error);
    acceptBatch(f.data, f.run, parsed.batch, 4, at);
    expect(guideFacts(f.state, f.data).saved).toBe(false);
    expect(guideRecovery(f.state, f.data)?.title).toBe('Save an updated review');
  });
  it('evidence removal supersedes a formerly complete monitoring pathway', async () => {
    const f = await fixture();
    f.review();
    const changed = missionReducer(f.state, { type: 'remove-retrieved-record' });
    expect(guideRecovery(changed, f.data)?.title).toBe('Retrieve missing evidence');
    expect(changed.reviews).toEqual(f.state.reviews);
  });
  it('a silently dropped storage write cannot confirm persistence', () => {
    const state = initialRichMissionState();
    expect(() => persistMission({ getItem: () => null, setItem: () => {} }, null, state)).toThrow(
      'mission-storage-unconfirmed',
    );
  });
});
