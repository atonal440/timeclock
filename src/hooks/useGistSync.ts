import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { preview } from '../utils/preview';
import type { BackupState } from '../utils/gist';
import { backupFiles, createGist, readGist, updateGist, parseGistId } from '../utils/gist';

export interface SyncConfig {
  token: string;
  gistId: string;
  gistUrl: string;
  lastSyncAt?: string;
  /** Hash of the content last pushed, so unchanged data isn't re-sent. */
  pushedHash?: string;
}

export type SyncStatus = 'off' | 'idle' | 'syncing' | 'error';

const PUSH_DELAY = 2000;
// fetch keepalive (used when the app is backgrounded) caps bodies at 64 KiB.
const KEEPALIVE_MAX = 60_000;

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = Math.imul(h, 33) ^ s.charCodeAt(i);
  return (h >>> 0).toString(36) + ':' + s.length;
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Mirrors local data to a secret gist: pushes a couple of seconds after each
 * change (and immediately when the app is backgrounded). Disabled in PR
 * previews so a preview can never overwrite the real backup.
 */
export function useGistSync(state: BackupState, onRestore: (s: BackupState) => void) {
  const [config, setConfig] = useLocalStorage<SyncConfig | null>('tc-sync', null);
  const [status, setStatus] = useState<SyncStatus>(config ? 'idle' : 'off');
  const [error, setError] = useState<string | null>(null);
  const enabled = !!config && !preview;

  const files = useMemo(() => backupFiles(state), [state]);
  const contentHash = useMemo(() => hash(Object.values(files).join('\0')), [files]);

  // Latest values for timers/event handlers.
  const latest = useRef({ config, files, contentHash });
  useEffect(() => { latest.current = { config, files, contentHash }; });
  const inFlight = useRef(false);

  const push = useCallback(async (keepalive = false, force = false) => {
    const { config: c, files: f, contentHash: h } = latest.current;
    if (!c || preview || inFlight.current || (c.pushedHash === h && !force)) return;
    inFlight.current = true;
    setStatus('syncing');
    try {
      const size = Object.values(f).reduce((a, s) => a + s.length, 0);
      await updateGist(c.token, c.gistId, f, keepalive && size < KEEPALIVE_MAX);
      setConfig(prev => prev && prev.gistId === c.gistId
        ? { ...prev, pushedHash: h, lastSyncAt: new Date().toISOString() }
        : prev);
      setError(null);
      setStatus('idle');
    } catch (e) {
      setError(message(e));
      setStatus('error');
    } finally {
      inFlight.current = false;
    }
  }, [setConfig]);

  // Debounced push after each change. Also re-runs once a push lands, which
  // catches changes made while it was in flight.
  useEffect(() => {
    if (!enabled || config!.pushedHash === contentHash) return;
    const id = setTimeout(() => push(), PUSH_DELAY);
    return () => clearTimeout(id);
  }, [enabled, config, contentHash, push]);

  useEffect(() => {
    if (!enabled) return;
    const onHide = () => { if (document.visibilityState === 'hidden') push(true); };
    const onOnline = () => push();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('online', onOnline);
    };
  }, [enabled, push]);

  /**
   * Start syncing. With an existing gist, its data is merged in first so a
   * new or wiped device doesn't overwrite the backup with an empty log.
   */
  const connect = useCallback(async (token: string, gistInput: string): Promise<string | null> => {
    const t = token.trim();
    if (!t) return 'Paste a GitHub token first.';
    try {
      if (gistInput.trim()) {
        const id = parseGistId(gistInput);
        if (!id) return "That doesn't look like a gist ID or URL.";
        const { info, state: remote } = await readGist(t, id);
        if (remote) onRestore(remote);
        setConfig({ token: t, gistId: info.id, gistUrl: info.url });
      } else {
        const info = await createGist(t, files);
        setConfig({ token: t, gistId: info.id, gistUrl: info.url, pushedHash: contentHash, lastSyncAt: new Date().toISOString() });
      }
      setError(null);
      setStatus('idle');
      return null;
    } catch (e) {
      return message(e);
    }
  }, [files, contentHash, onRestore, setConfig]);

  /** Merge the gist's data into local data. Returns an error message or null. */
  const restore = useCallback(async (): Promise<string | null> => {
    if (!config) return 'Sync is not set up.';
    try {
      const { state: remote } = await readGist(config.token, config.gistId);
      if (!remote) return 'The gist has no TimeClock data yet.';
      onRestore(remote);
      return null;
    } catch (e) {
      return message(e);
    }
  }, [config, onRestore]);

  const disconnect = useCallback(() => {
    setConfig(null);
    setError(null);
    setStatus('off');
  }, [setConfig]);

  return {
    config,
    status: enabled ? status : 'off' as SyncStatus,
    error,
    pending: enabled && config!.pushedHash !== contentHash,
    connect,
    restore,
    disconnect,
    syncNow: () => push(false, true),
  };
}
