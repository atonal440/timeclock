import { useState } from 'react';
import type { useGistSync } from '../hooks/useGistSync';
import { fmtAgo } from '../utils/timeclock';
import { preview } from '../utils/preview';

const TOKEN_URL = 'https://github.com/settings/tokens/new?scopes=gist&description=TimeClock%20backup';

interface SyncSectionProps {
  sync: ReturnType<typeof useGistSync>;
  lastBackup: string | null;
  persisted: boolean | null;
}

export function SyncSection({ sync, lastBackup, persisted }: SyncSectionProps) {
  const [token, setToken] = useState('');
  const [gist, setGist] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { config } = sync;

  async function run(action: () => Promise<string | null>) {
    setBusy(true);
    setError(null);
    const err = await action();
    setBusy(false);
    setError(err);
    return err;
  }

  async function connect() {
    if (!(await run(() => sync.connect(token, gist)))) {
      setToken('');
      setGist('');
    }
  }

  let statusText: string;
  if (preview) statusText = 'Off in PR previews, so a preview can never overwrite your real backup.';
  else if (sync.status === 'syncing') statusText = 'Syncing…';
  else if (sync.status === 'error') statusText = `Not synced: ${sync.error}`;
  else if (sync.pending) statusText = 'Changes waiting to sync…';
  else statusText = config?.lastSyncAt ? `Up to date · synced ${fmtAgo(config.lastSyncAt)}` : 'Up to date';

  return (
    <div className="settings-section">
      <div className="section-label">Backup &amp; sync</div>

      <div className="stat-card">
        <div className="stat-row">
          <span className="stat-key">Last backup</span>
          <span className="stat-val">{lastBackup ?? 'never'}</span>
        </div>
        <div className="stat-row">
          <span className="stat-key">Browser storage</span>
          <span className="stat-val">{persisted === null ? '—' : persisted ? 'persistent' : 'may be cleared'}</span>
        </div>
      </div>
      {persisted === false && (
        <div className="hint">
          The browser may wipe data for sites you don't visit for a while. Adding TimeClock to
          your home screen helps; a Gist backup keeps a copy off the device.
        </div>
      )}

      {config ? (
        <>
          <div className={`sync-status ${sync.status === 'error' ? 'error' : ''}`}>
            <div>
              Syncing to{' '}
              <a href={config.gistUrl} target="_blank" rel="noreferrer">gist {config.gistId.slice(0, 8)}…</a>
            </div>
            <div className="sync-status-line">{statusText}</div>
          </div>
          {!preview && (
            <>
              <button className="action-btn" disabled={busy} onClick={() => sync.syncNow()}>⟳  Sync now</button>
              <button className="action-btn" disabled={busy} onClick={() => run(sync.restore)}>⬇︎  Restore from Gist</button>
            </>
          )}
          {error && <div className="form-error" role="alert">{error}</div>}
          <div className="hint">
            Every change is pushed to the gist as <code>timeclock.journal</code> (hledger) and{' '}
            <code>timeclock.json</code>. To follow it from a computer, clone it once and <code>git pull</code>:
            <code className="cmd-block">git clone https://gist.github.com/{config.gistId}.git</code>
            Restore merges the gist's entries into this device; nothing here is deleted.
          </div>
          <button className="cancel-btn" onClick={sync.disconnect}>Disconnect (keeps the gist)</button>
        </>
      ) : preview ? (
        <div className="hint">Gist sync is off in PR previews.</div>
      ) : (
        <>
          <div className="hint" style={{ paddingTop: 12 }}>
            Mirror your log to a secret GitHub Gist. Create a{' '}
            <a href={TOKEN_URL} target="_blank" rel="noreferrer">token with only the <code>gist</code> scope</a>{' '}
            and paste it below. It's stored in this browser only.
          </div>
          <input
            className="add-input sync-input"
            type="password"
            value={token}
            onChange={e => setToken(e.target.value)}
            placeholder="GitHub token (ghp_…)"
            aria-label="GitHub token"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          <input
            className="add-input sync-input"
            value={gist}
            onChange={e => setGist(e.target.value)}
            placeholder="Existing gist URL (optional)"
            aria-label="Existing gist URL or ID"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          <button className="confirm-btn" disabled={busy || !token.trim()} onClick={connect}>
            {busy ? 'Connecting…' : gist.trim() ? 'Connect & restore' : 'Create secret gist'}
          </button>
          {error && <div className="form-error" role="alert">{error}</div>}
          <div className="hint">
            Leave the gist blank to create a new one. Paste an existing gist on a new device to pull its
            data in first, then keep it in sync.
          </div>
        </>
      )}
    </div>
  );
}
