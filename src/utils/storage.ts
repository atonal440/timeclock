import { preview, isForked, fork } from './preview';

// Sets are stored as arrays (JSON can't serialize Set).
function serialize(value: unknown): string {
  return JSON.stringify(value, (_k, v) => (v instanceof Set ? Array.from(v) : v));
}

// In a PR preview, the last value handed out per key. useLocalStorage writes
// every key back on mount; comparing against this lets those no-op writes
// through without forking the preview off the live data.
const lastRead = new Map<string, string>();

function storageKey(key: string): string {
  return preview && isForked() ? preview.prefix + key : key;
}

export function loadData<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(storageKey(key));
    const result = v ? JSON.parse(v) : fallback;
    if (preview) lastRead.set(key, serialize(result));
    return result;
  } catch {
    return fallback;
  }
}

export function saveData<T>(key: string, value: T): void {
  try {
    const json = serialize(value);
    if (preview && !isForked()) {
      if (lastRead.get(key) === json) return;
      fork();
    }
    localStorage.setItem(storageKey(key), json);
  } catch {
    // Storage full or unavailable: keep running on in-memory state.
  }
}
