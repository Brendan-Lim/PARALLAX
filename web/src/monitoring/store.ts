import { demoSuffix } from '../mission/demoProfile';
import { ingestAstroskin } from '../devices/astroskin';
import { decodeMission, missionStorageKey, type MissionState } from '../mission/state';
import { requireValid } from '../mission/validation';
import { replayAcquisition, replayFrames } from './fixture';
import {
  acknowledge,
  bindingMatches,
  emptyLedger,
  transition,
  validateLedger,
  type Ledger,
  type Run,
  type DeliveryTransition,
} from './model';
export const databaseName = 'parallax.monitoring.v1' + demoSuffix;
const stores = ['runs', 'samples', 'payloads', 'events', 'transitions', 'acknowledgments'] as const;
let opening: Promise<{ db: IDBDatabase; templates: Awaited<ReturnType<typeof templates>> }> | null =
  null;
async function templates() {
  return Promise.all(
    replayFrames.map(async (raw) => {
      const result = await ingestAstroskin(raw, replayAcquisition, '2026-01-01T00:00:00.000Z');
      if (!result.ok) throw new Error(result.error);
      return result.batch;
    }),
  );
}
function open() {
  if (!opening)
    opening = (async () => {
      const parsed = await templates();
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(databaseName, 1);
        let abandoned = false;
        request.onupgradeneeded = (event) => {
          if (event.oldVersion !== 0) {
            request.transaction?.abort();
            return;
          }
          for (const name of stores) request.result.createObjectStore(name, { keyPath: 'id' });
        };
        request.onerror = () =>
          reject(
            new Error(
              'Monitoring database unavailable or schema unsupported. Existing records were retained.',
            ),
          );
        request.onblocked = () => {
          abandoned = true;
          reject(
            new Error(
              'Monitoring database upgrade blocked by another tab. Close older tabs and reload.',
            ),
          );
        };
        request.onsuccess = () => {
          const database = request.result;
          if (abandoned) {
            database.close();
            return;
          }
          database.onversionchange = () => {
            database.close();
            opening = null;
          };
          if (
            database.objectStoreNames.length !== stores.length ||
            !stores.every((name) => database.objectStoreNames.contains(name))
          ) {
            database.close();
            reject(new Error('Unsupported monitoring database schema.'));
            return;
          }
          resolve(database);
        };
      });
      return { db, templates: parsed };
    })().catch((error: unknown) => {
      opening = null;
      throw error;
    });
  return opening;
}
export function persistedMission(): MissionState {
  const raw = localStorage.getItem(missionStorageKey);
  requireValid(raw !== null, 'No saved mission identity. Monitoring requires browser storage.');
  const decoded = decodeMission(raw);
  requireValid(!decoded.notice, 'Saved mission cannot authorise monitoring. Reload the mission.');
  return decoded.state;
}
export function requireCurrentRun(data: Ledger, runId: string, sessionId: string): Run {
  const run = data.runs.find((r) => r.id === runId);
  const state = persistedMission();
  requireValid(
    run &&
      state.sessionId === sessionId &&
      bindingMatches(run, state) &&
      run.status !== 'stale' &&
      data.runs.filter((r) => r.basis.sessionId === sessionId).at(-1)?.id === runId,
    'Historical or stale replay. Connect to the current mission and designation.',
  );
  return run;
}
/** No async work inside the transaction: all reads finish, validation and mutations enqueue synchronously.
 * Resolve only on transaction completion. Samples and generated events commit or abort together.
 */
export async function ledgerTransaction(
  mutator?: (data: Ledger) => void,
  guard?: () => void,
): Promise<Ledger> {
  const { db, templates } = await open();
  return new Promise((resolve, reject) => {
    let result = emptyLedger();
    let failure: unknown;
    const tx = db.transaction([...stores], mutator ? 'readwrite' : 'readonly', {
      durability: 'strict',
    });
    const loaded = emptyLedger();
    let count = 0;
    tx.oncomplete = () => resolve(result);
    tx.onabort = () =>
      reject(
        failure ?? new Error('Monitoring transaction failed. No save or delivery is confirmed.'),
      );
    tx.onerror = () => {
      /* onabort reports the final transaction outcome. */
    };
    for (const name of stores) {
      // A corrupted database must not cause an unbounded allocation.
      const request = tx.objectStore(name).getAll(undefined, 129);
      request.onsuccess = () => {
        Object.assign(loaded, { [name]: request.result });
        if (++count !== stores.length) return;
        try {
          loaded.runs.sort((a, b) => a.sequence - b.sequence);
          loaded.samples.sort((a, b) => a.runId.localeCompare(b.runId) || a.frame - b.frame);
          loaded.events.sort(
            (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
          );
          validateLedger(loaded, templates);
          if (mutator) {
            guard?.();
            const before = structuredClone(loaded);
            mutator(loaded);
            validateLedger(loaded, templates);
            for (const key of stores) {
              const store = tx.objectStore(key);
              const nextRows = loaded[key];
              for (const row of before[key])
                if (!nextRows.some((n) => n.id === row.id)) store.delete(row.id);
              for (const row of nextRows) {
                const previous = before[key].find((r) => r.id === row.id);
                if (!previous) store.add(row);
                else if (JSON.stringify(previous) !== JSON.stringify(row)) {
                  requireValid(key === 'runs', 'Append-only ledger record cannot be overwritten.');
                  store.put(row);
                }
              }
            }
            guard?.();
          }
          result = loaded;
        } catch (error) {
          failure = error;
          tx.abort();
        }
      };
    }
  });
}
export async function deliveryAction(
  runId: string,
  sessionId: string,
  eventId: string,
  kind: DeliveryTransition['kind'] | 'ack',
  companionId: string | null,
) {
  return ledgerTransaction((data) => {
    requireCurrentRun(data, runId, sessionId);
    const event = data.events.find((e) => e.id === eventId && e.runId === runId);
    requireValid(event, 'Event does not belong to the selected replay.');
    const at = new Date().toISOString();
    if (kind === 'ack') {
      requireValid(companionId, 'Companion identity required.');
      acknowledge(data, event, at, companionId);
    } else transition(data, event, kind, at, companionId);
  });
}
