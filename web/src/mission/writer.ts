import { demoSuffix } from './demoProfile';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  decodeMission,
  initialRichMissionState,
  encodeMission,
  missionReducer,
  missionStorageKey,
  type MissionCommand,
  type MissionState,
} from './state';

export interface MissionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
/** Synchronous pre-write check is defence against noncooperating/old writers, not atomic CAS. */
export function persistMission(
  storage: MissionStorage,
  expectedRaw: string | null,
  next: MissionState,
) {
  if (storage.getItem(missionStorageKey) !== expectedRaw) throw new Error('mission-write-conflict');
  const raw = encodeMission(next);
  storage.setItem(missionStorageKey, raw);
  if (storage.getItem(missionStorageKey) !== raw) throw new Error('mission-storage-unconfirmed');
  return raw;
}
function readMission() {
  try {
    const raw = localStorage.getItem(missionStorageKey);
    return {
      ...(raw === null && !new URLSearchParams(location.search).has('legacy')
        ? { state: initialRichMissionState(), notice: '' }
        : decodeMission(raw)),
      raw,
    };
  } catch {
    return {
      ...decodeMission(null),
      raw: null,
      notice: 'Browser storage is unavailable. This mission will continue in memory only.',
    };
  }
}
export function useMissionWriter(health: boolean) {
  const [loaded] = useState(readMission);
  const [state, setState] = useState({ ...loaded.state, entered: loaded.state.entered || health });
  const current = useRef(state);
  const raw = useRef(loaded.raw);
  const owns = useRef(false);
  const release = useRef<(() => void) | null>(null);
  const [editable, setEditable] = useState(false);
  const [notice, setNotice] = useState(loaded.notice);
  const [storageFailed, setStorageFailed] = useState(loaded.notice.startsWith('Browser storage'));
  const failConflict = useCallback(() => {
    owns.current = false;
    release.current?.();
    setEditable(false);
    setNotice(
      'Saved mission changed outside this writer. Your pending action was not saved. Reload to review the saved evidence before editing.',
    );
  }, []);
  useEffect(() => {
    let disposed = false;
    const follow = (event: StorageEvent) => {
      if (
        event.storageArea !== localStorage ||
        (event.key !== missionStorageKey && event.key !== null)
      )
        return;
      if (owns.current) {
        failConflict();
        return;
      }
      const next = decodeMission(event.newValue);
      current.current = next.state;
      raw.current = event.newValue;
      setState(next.state);
    };
    window.addEventListener('storage', follow);
    if (!navigator.locks) {
      queueMicrotask(() => {
        if (!disposed)
          setNotice(
            'Mission editing needs browser single-writer support. This view is read-only; use a supported secure local or HTTPS address.',
          );
      });
    } else {
      void navigator.locks
        .request(
          'parallax.mission.authoritative-writer.v1' + demoSuffix,
          { ifAvailable: true },
          async (lock) => {
            if (disposed) return;
            if (!lock) {
              const latest = readMission();
              current.current = latest.state;
              raw.current = latest.raw;
              setState(latest.state);
              setNotice(
                'Another tab owns mission editing. This view follows saved information. Close the editing tab and reload here to edit.',
              );
              return;
            }
            owns.current = true;
            // Refresh under ownership before the first write, including after a route remount.
            const latest = readMission();
            const refreshed = latest.raw === raw.current ? current.current : latest.state;
            const next = { ...refreshed, entered: refreshed.entered || health };
            current.current = next;
            raw.current = latest.raw;
            setState(next);
            try {
              raw.current = persistMission(localStorage, raw.current, next);
            } catch (error) {
              if (error instanceof Error && error.message === 'mission-write-conflict') {
                failConflict();
                return;
              }
              setStorageFailed(true);
            }
            setEditable(true);
            await new Promise<void>((resolve) => {
              release.current = resolve;
              if (disposed) resolve();
            });
            owns.current = false;
          },
        )
        .catch(() => {
          if (!disposed)
            setNotice('Mission writer ownership could not be acquired. Reload before editing.');
        });
    }
    return () => {
      disposed = true;
      owns.current = false;
      release.current?.();
      window.removeEventListener('storage', follow);
    };
    // Ownership lasts until this mission surface unmounts; health navigation shares the owner.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [failConflict]);
  const dispatch = useCallback(
    (command: MissionCommand) => {
      if (!owns.current) return;
      const previous = current.current;
      const next = missionReducer(previous, command);
      if (next === previous) return;
      let persisted = true;
      try {
        raw.current = persistMission(localStorage, raw.current, next);
      } catch (error) {
        if (error instanceof Error && error.message === 'mission-write-conflict') {
          failConflict();
          return;
        }
        persisted = false;
        setStorageFailed(true);
      }
      current.current = next;
      setState(next);
      return { state: next, persisted };
    },
    [failConflict],
  );
  const isOwner = useCallback(() => owns.current, []);
  return { state, dispatch, notice, setNotice, storageFailed, editable, isOwner };
}

export type MissionDispatch = ReturnType<typeof useMissionWriter>['dispatch'];
