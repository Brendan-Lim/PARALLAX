/** Independently authored synthetic measurements. No vendor examples or participant recordings. */
import { syntheticUser } from './astroskin';
export const fixtureVersion = 'astro-synthetic-hr-1';
const body = (hr: number[][], quality?: number[][]) =>
  JSON.stringify(
    [
      {
        user: syntheticUser,
        data: { '19': hr, ...(quality ? { '1000': quality } : {}) },
      },
    ],
    null,
    2,
  );
export const syntheticFixtures = {
  usable: {
    label: 'Usable reported quality',
    raw: body(
      [
        [0, 72],
        [256, 72],
      ],
      [
        [0, 0],
        [256, 0],
      ],
    ),
  },
  retained: {
    label: 'Later disconnected sample',
    raw: body(
      [
        [0, 72],
        [256, 72],
      ],
      [
        [0, 0],
        [256, 2],
      ],
    ),
  },
  artifacts: {
    label: 'Multiple quality conditions',
    raw: body(
      [
        [0, 72],
        [256, 74],
      ],
      [
        [0, 0],
        [256, 60],
      ],
    ),
  },
  missing: {
    label: 'Missing aligned quality',
    raw: body(
      [
        [0, 72],
        [256, 73],
      ],
      [
        [0, 0],
        [512, 0],
      ],
    ),
  },
} as const;
export type FixtureId = keyof typeof syntheticFixtures;
