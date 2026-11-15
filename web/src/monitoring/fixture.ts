/** Original coherent synthetic recording. Phase 4 alternative batches remain independent. */
import { syntheticUser, replayAcquisition } from '../devices/astroskin';
export { replayAcquisition };
export const replayFixtureVersion = 'astro-coherent-replay-1';
export const replayScheduleMs = 1200;
export const replayRecencyMs = 5000;
export const replaySequence = [
  [0, 72, 0],
  [256, 73, 0],
  [512, 72, 0],
  [768, 72, 2],
  [1024, 72, 2],
  [1280, 73, 0],
  [1536, 73, null],
  [1792, 72, 0],
] as const;
export const replayFrames = replaySequence.map(([ticks, value, mask]) =>
  JSON.stringify([
    {
      user: syntheticUser,
      data: {
        '19': [[ticks, value]],
        ...(mask === null ? {} : { '1000': [[ticks, mask]] }),
      },
    },
  ]),
);
