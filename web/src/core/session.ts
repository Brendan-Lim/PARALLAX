import { freshCase } from '../data/cases';
import { validatePacket } from './validate';
import type { CasePacket } from './model';
import { isMissionPhase, type MissionPhase } from './context';
import { actionStates, type ActionReceipt } from './actions';

export const storageKey = 'parallax.synthetic.session.v1';
export interface Session {
  packet: CasePacket;
  unavailable: string[];
  marked: string[];
  note: string;
  missionPhase: MissionPhase;
  receipts: Record<string, ActionReceipt>;
  planCompleted: boolean;
  undo: { packet: CasePacket; unavailable: string[] } | null;
}
export const initialSession = (): Session => ({
  packet: freshCase(),
  unavailable: [],
  marked: [],
  note: '',
  missionPhase: 'transition',
  receipts: {},
  planCompleted: false,
  undo: null,
});
export function decodeSession(raw: string | null): { session: Session; notice: string } {
  if (!raw) return { session: initialSession(), notice: '' };
  try {
    if (raw.length > 600_000) throw new Error();
    const data = JSON.parse(raw);
    const packet = validatePacket(data.packet);
    if (
      data.version !== 1 ||
      !Array.isArray(data.unavailable) ||
      !data.unavailable.every((s: unknown) => typeof s === 'string') ||
      !Array.isArray(data.marked) ||
      !data.marked.every((s: unknown) => typeof s === 'string') ||
      typeof data.note !== 'string' ||
      data.note.length > 1000 ||
      (data.missionPhase !== undefined && !isMissionPhase(data.missionPhase)) ||
      (data.planCompleted !== undefined && typeof data.planCompleted !== 'boolean')
    )
      throw new Error();
    const receipts: Record<string, ActionReceipt> = {};
    if (data.receipts !== undefined) {
      if (
        !data.receipts ||
        typeof data.receipts !== 'object' ||
        Array.isArray(data.receipts) ||
        Object.keys(data.receipts).length > 32
      )
        throw new Error();
      for (const [key, value] of Object.entries(data.receipts)) {
        const r = value as ActionReceipt;
        if (
          !/^[a-z-]{1,50}$/.test(key) ||
          !r ||
          typeof r.signature !== 'string' ||
          r.signature.length > 100_000 ||
          !actionStates.includes(r.state)
        )
          throw new Error();
        receipts[key] = { signature: r.signature, state: r.state };
      }
    }
    const ids = new Set(packet.observations.map((r) => r.id));
    const undo = data.undo
      ? { packet: validatePacket(data.undo.packet), unavailable: data.undo.unavailable }
      : null;
    if (
      undo &&
      (!Array.isArray(undo.unavailable) ||
        !undo.unavailable.every((v: unknown) => typeof v === 'string'))
    )
      throw new Error();
    return {
      session: {
        packet,
        unavailable: [...new Set<string>(data.unavailable)].filter((id) => ids.has(id)),
        marked: [...new Set<string>(data.marked)].filter((id) =>
          ['force', 'cardio', 'tandem', 'task', 'hr', 'map', 'overall', 'clearance'].includes(id),
        ),
        note: data.note,
        missionPhase: data.missionPhase ?? 'transition',
        receipts,
        planCompleted: data.planCompleted ?? false,
        undo,
      },
      notice: '',
    };
  } catch {
    return {
      session: initialSession(),
      notice: 'The saved demonstration was invalid. The default synthetic case has been restored.',
    };
  }
}
export const encodeSession = (session: Session) => JSON.stringify({ version: 1, ...session });
