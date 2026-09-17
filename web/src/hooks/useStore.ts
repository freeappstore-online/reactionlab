import { useCallback, useSyncExternalStore } from 'react';
import * as storage from '../services/storage';
import type { SessionRecord, Settings } from '../types';

/**
 * `services/storage` caches each parsed value, so these snapshots are
 * referentially stable between mutations — exactly what
 * `useSyncExternalStore` needs to avoid re-render loops.
 */
export function useSessions(): readonly SessionRecord[] {
  return useSyncExternalStore(storage.subscribe, storage.loadSessions, storage.loadSessions);
}

export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const settings = useSyncExternalStore(
    storage.subscribe,
    storage.loadSettings,
    storage.loadSettings,
  );
  const update = useCallback((patch: Partial<Settings>) => {
    storage.saveSettings(patch);
  }, []);
  return [settings, update];
}

export function useStreak(): number {
  const read = useCallback(() => storage.currentStreak(), []);
  return useSyncExternalStore(storage.subscribe, read, read);
}
