import { useState, useEffect, useMemo, useRef } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { loadData } from './utils/storage';
import type { Entry, SessionData } from './utils/timeclock';
import { parseTimeclockFile, exportTimeclock, exportCsv, fmtDuration, fmtAgo,
  calcSessions, groupByDay, placeSession, mergeEntries, localDateTime, addDays
} from './utils/timeclock';
import type { BackupState } from './utils/gist';
import { useGistSync } from './hooks/useGistSync';
import { conceptFor, themeId } from './utils/themes';

import { Nav } from './components/Nav';
import { ClockTab } from './components/ClockTab';
import { LogTab } from './components/LogTab';
import { ProjectsTab } from './components/ProjectsTab';
import { SessionModal } from './components/SessionModal';
import type { SessionDraft } from './components/SessionModal';
import { ClockOutModal } from './components/ClockOutModal';
import { BackupNudge } from './components/BackupNudge';
import { PreviewBanner } from './components/PreviewBanner';
import { preview, resetPreview, cleanupClosedPreviews } from './utils/preview';

// A session running this long was probably left on by accident.
const STALE_MS = 10 * 3600_000;
const DAY_MS = 24 * 3600_000;

interface BackupInfo {
  /** Last timeclock.journal export. */
  exportedAt?: string;
  /** Hide the backup reminder until then. */
  snoozedUntil?: string;
}

interface ToastState {
  msg: string;
  undo?: () => void;
}

interface ModalState {
  title: string;
  body: string;
  onConfirm: () => void;
  confirmLabel?: string;
}

export function App() {
  const [entries, setEntries] = useLocalStorage<Entry[]>('tc-entries', []);
  const [projects, setProjects] = useLocalStorage<string[]>('tc-projects', []);
  const [hiddenProjects, setHiddenProjects] = useLocalStorage<Set<string>>('tc-hidden-projects', new Set());
  // Migrate the legacy single `tc-theme` key (light/dark/system/daily) to the
  // independent scheme + concept axes when the new keys are absent, so a
  // returning user keeps their prior appearance: their light/dark/system
  // scheme, plus their static base look ('lime') or the daily rotation
  // ('auto'). Fresh installs (no legacy key) get the new 'auto'/'system'
  // defaults. (useLocalStorage uses these only when the key isn't stored yet.)
  const legacyTheme = loadData<string | null>('tc-theme', null);
  const [concept, setConcept] = useLocalStorage<string>(
    'tc-concept', legacyTheme && legacyTheme !== 'daily' ? 'lime' : 'auto'
  );
  const [scheme, setScheme] = useLocalStorage<string>(
    'tc-scheme', legacyTheme === 'light' || legacyTheme === 'dark' ? legacyTheme : 'system'
  );

  // Convert loaded hiddenProjects array back to Set if needed (since JSON.stringify converts Set to Object/Array)
  const actualHiddenProjects = hiddenProjects instanceof Set ? hiddenProjects : new Set(hiddenProjects as unknown as string[]);

  const [tab, setTab] = useState('clock');
  const [modal, setModal] = useState<ModalState | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [now, setNow] = useState(new Date());
  const [draft, setDraft] = useState<SessionDraft | null>(null);
  const [clockOutAt, setClockOutAt] = useState<{ stale: boolean } | null>(null);
  const [backup, setBackup] = useLocalStorage<BackupInfo>('tc-backup', {});
  // Start of the running session the user already told "still working".
  const [staleOk, setStaleOk] = useLocalStorage<string | null>('tc-stale-ok', null);
  const [persisted, setPersisted] = useState<boolean | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Ask the browser not to evict our localStorage (Safari clears data for
  // sites unused for a week unless they're installed or persisted).
  useEffect(() => {
    const s = navigator.storage;
    if (!s?.persisted) return;
    s.persisted()
      .then(p => p || (s.persist ? s.persist() : false))
      .then(setPersisted, () => setPersisted(false));
  }, []);

  // Drop stored copies from PR previews whose PR has since closed.
  useEffect(() => {
    if (import.meta.env.PROD) cleanupClosedPreviews();
  }, []);

  function confirmResetPreview() {
    setModal({
      title: 'Discard preview data?',
      body: 'This preview will go back to reading your live data. Changes made in this preview are lost; live data is untouched.',
      confirmLabel: 'Discard',
      onConfirm: () => { resetPreview(); location.reload(); },
    });
  }

  // Track the OS light/dark preference so 'daily' mode can pick the matching
  // scheme from each day's light/dark pair.
  const [prefersDark, setPrefersDark] = useState(
    () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setPrefersDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Scheme and concept are independent. Concept 'auto' follows the weekday
  // (rolls over at midnight as `now` ticks past it); scheme 'system' follows
  // the OS preference. They resolve together into a `${concept}-${scheme}`
  // data-theme, e.g. "aurora-dark".
  const resolvedConcept = concept === 'auto' ? conceptFor(now).id : concept;
  const resolvedScheme = scheme === 'system' ? (prefersDark ? 'dark' : 'light') : scheme;
  const activeTheme = themeId(resolvedConcept, resolvedScheme as 'light' | 'dark');
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', activeTheme);
  }, [activeTheme]);

  const lastEntry = entries[entries.length - 1];
  const isClockedIn = lastEntry?.type === 'i';
  const currentAccount = isClockedIn ? lastEntry.account! : null;
  const runningMs = isClockedIn ? now.getTime() - new Date(lastEntry.datetime).getTime() : 0;
  const isStale = runningMs > STALE_MS;

  const { allSessions, days, allProjectNames } = useMemo(() => {
    const allSessions = calcSessions(entries);
    const days = groupByDay(allSessions);
    const allProjectNames = Array.from(new Set([...projects, ...allSessions.map(s => s.account)]));
    return { allSessions, days, allProjectNames };
  }, [entries, projects]);

  const todayKey = now.toLocaleDateString('en-CA');
  const todayDay = days.find(d => d.date === todayKey);
  const todayMs = todayDay ? todayDay.totalMs + (isClockedIn ? runningMs : 0) : (isClockedIn ? runningMs : 0);

  function showToast(msg: string, undo?: () => void) {
    clearTimeout(toastTimer.current);
    setToast({ msg, undo });
    toastTimer.current = setTimeout(() => setToast(null), undo ? 5000 : 2500);
  }

  /** Replace the log and offer to put the previous one back. */
  function commit(next: Entry[], msg: string) {
    const before = entries;
    setEntries(next);
    showToast(msg, () => { setEntries(before); showToast('Undone'); });
  }

  function clockIn(account: string) {
    const t = new Date().toISOString();
    commit(
      isClockedIn
        ? [...entries, { type: 'o', datetime: t }, { type: 'i', datetime: t, account }]
        : [...entries, { type: 'i', datetime: t, account }],
      `${isClockedIn ? 'Switched' : 'Clocked in'} to ${account}`
    );
  }

  function clockOut() {
    commit([...entries, { type: 'o', datetime: new Date().toISOString() }], 'Clocked out');
  }

  function clockOutAtTime(date: string, time: string): string | null {
    const end = localDateTime(date, time);
    const start = new Date(lastEntry.datetime);
    if (isNaN(end.getTime())) return 'Enter a valid date and time.';
    if (end <= start) return 'Clock-out must be after the clock-in.';
    if (end > new Date()) return "Clock-out can't be in the future.";
    commit([...entries, { type: 'o', datetime: end.toISOString() }], `Clocked out at ${time}`);
    setClockOutAt(null);
    return null;
  }

  // Ask once per running session whether it was meant to still be running.
  const clockOutPrompt = clockOutAt ?? (isStale && staleOk !== lastEntry.datetime ? { stale: true } : null);

  function dismissClockOutAt() {
    if (clockOutPrompt?.stale) setStaleOk(lastEntry.datetime);
    setClockOutAt(null);
  }

  function openEdit(s: SessionData) {
    // A session missing its clock-out gets one suggested: when the next
    // entry starts, or an hour after it began.
    let endDt = s.endDt;
    if (s.broken) {
      const next = new Date(entries[s.inIdx + 1].datetime);
      endDt = next > s.startDt ? next : new Date(s.startDt.getTime() + 3600_000);
    }
    setDraft({
      inIdx: s.inIdx,
      outIdx: s.outIdx,
      account: s.account,
      date: s.date,
      startTime: fmtInputTime(s.startDt),
      endDate: endDt ? endDt.toLocaleDateString('en-CA') : null,
      endTime: endDt ? fmtInputTime(endDt) : null
    });
  }

  function openAdd() {
    const end = new Date(Math.floor(now.getTime() / 60000) * 60000);
    const start = new Date(end.getTime() - 3600_000);
    setDraft({
      account: projects.find(p => !actualHiddenProjects.has(p)) ?? projects[0] ?? '',
      date: start.toLocaleDateString('en-CA'),
      startTime: fmtInputTime(start),
      endDate: end.toLocaleDateString('en-CA'),
      endTime: fmtInputTime(end),
    });
  }

  function fmtInputTime(dt: Date) {
    return dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  function saveSession(d: SessionDraft): string | null {
    const start = localDateTime(d.date, d.startTime);
    let end: Date | null = null;
    if (d.endTime !== null && d.endDate !== null) {
      // Same-day end at or before the start means it ran past midnight.
      const endDate = d.endDate === d.date && d.endTime <= d.startTime ? addDays(d.endDate, 1) : d.endDate;
      end = localDateTime(endDate, d.endTime);
    }
    const isNew = d.inIdx === undefined;
    const result = placeSession(entries, { account: d.account, start, end },
      isNew ? undefined : { inIdx: d.inIdx!, outIdx: d.outIdx ?? null });
    if ('error' in result) return result.error;
    commit(result.entries, isNew ? 'Entry added' : 'Entry saved');
    setDraft(null);
    return null;
  }

  function deleteSession(inIdx: number, outIdx: number | null) {
    commit(entries.filter((_, i) => i !== inIdx && i !== outIdx), 'Entry deleted');
  }

  function clearAll() {
    setModal({
      title: 'Clear all data?',
      body: 'Every session will be permanently deleted. Export first if you want a backup.',
      onConfirm: () => setEntries([])
    });
  }

  function doImport(importText: string): boolean {
    try {
      const parsed = parseTimeclockFile(importText);
      if (!parsed.length) { showToast('No valid entries found.'); return false; }
      setEntries(prev => mergeEntries(prev, parsed));
      const accs = parsed.filter(e => e.type === 'i').map(e => e.account!);
      setProjects(prev => Array.from(new Set([...prev, ...accs])));
      showToast(`Imported ${parsed.length} entries.`);
      return true;
    } catch (e) {
      showToast('Parse error: ' + (e instanceof Error ? e.message : String(e)));
      return false;
    }
  }

  function download(content: string, type: string, filename: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${filename}`);
  }

  function doExport() {
    download(exportTimeclock(entries), 'text/plain', 'timeclock.journal');
    setBackup(b => ({ ...b, exportedAt: new Date().toISOString() }));
  }

  // Merge a gist backup into local data (never removes anything).
  function restoreBackup(remote: BackupState) {
    const have = new Set(entries.map(e => e.datetime + e.type));
    const added = remote.entries.filter(e => !have.has(e.datetime + e.type)).length;
    setEntries(prev => mergeEntries(prev, remote.entries));
    setProjects(prev => Array.from(new Set([...prev, ...remote.projects])));
    setHiddenProjects(prev => new Set([...(prev instanceof Set ? prev : prev as unknown as string[]), ...remote.hiddenProjects]));
    showToast(added ? `Restored ${added} entries from Gist` : 'Already up to date with Gist');
  }

  const backupState = useMemo<BackupState>(() => ({
    entries,
    projects,
    hiddenProjects: Array.from(hiddenProjects instanceof Set ? hiddenProjects : hiddenProjects as unknown as string[]),
  }), [entries, projects, hiddenProjects]);
  const sync = useGistSync(backupState, restoreBackup);

  // Backed up = the gist mirror is current, or a recent-enough export.
  const syncCurrent = sync.status === 'idle' || sync.status === 'syncing';
  const lastBackupAt = [backup.exportedAt, sync.config?.lastSyncAt].filter(Boolean).sort().pop() ?? null;
  const oldestMs = entries.length ? new Date(entries[0].datetime).getTime() : null;
  const backupAge = now.getTime() - (lastBackupAt ? new Date(lastBackupAt).getTime() : (oldestMs ?? now.getTime()));
  const showBackupNudge = entries.length > 0 && !syncCurrent
    && backupAge > (lastBackupAt ? 14 : 7) * DAY_MS
    && !(backup.snoozedUntil && new Date(backup.snoozedUntil) > now);

  function snoozeBackup() {
    setBackup(b => ({ ...b, snoozedUntil: new Date(Date.now() + 7 * DAY_MS).toISOString() }));
  }

  function doExportCsv() {
    download(exportCsv(allSessions), 'text/csv', 'timeclock.csv');
  }

  function toggleHidden(p: string) {
    setHiddenProjects(prev => {
      // make sure it's a Set
      const prevSet = prev instanceof Set ? prev : new Set(prev as unknown as string[]);
      const next = new Set(prevSet);
      if (next.has(p)) next.delete(p); else next.add(p);
      return next;
    });
  }

  function addProject(newProject: string) {
    const p = newProject.trim();
    if (!p || projects.includes(p)) return;
    setProjects(prev => [...prev, p]);
  }

  function renameProject(oldName: string, newName: string) {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;
    setProjects(prev => Array.from(new Set(prev.map(p => p === oldName ? trimmed : p))));
    setEntries(prev => prev.map(e => e.account === oldName ? { ...e, account: trimmed } : e));
    setHiddenProjects(prev => {
      const prevSet = prev instanceof Set ? prev : new Set(prev as unknown as string[]);
      if (!prevSet.has(oldName)) return prevSet;
      const next = new Set(prevSet);
      next.delete(oldName);
      next.add(trimmed);
      return next;
    });
  }

  function deleteProject(name: string) {
    setModal({
      title: 'Remove project?',
      body: `"${name}" will be removed from your project list. Past sessions logged under it are kept.`,
      onConfirm: () => {
        setProjects(prev => prev.filter(p => p !== name));
        setHiddenProjects(prev => {
          const prevSet = prev instanceof Set ? prev : new Set(prev as unknown as string[]);
          if (!prevSet.has(name)) return prevSet;
          const next = new Set(prevSet);
          next.delete(name);
          return next;
        });
      }
    });
  }

  const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <div className="app">
      {preview && <PreviewBanner pr={preview.pr} onReset={confirmResetPreview} />}

      {draft && <SessionModal
        draft={draft}
        projects={projects}
        onClose={() => setDraft(null)}
        onSave={saveSession}
      />}

      {clockOutPrompt && isClockedIn && <ClockOutModal
        account={currentAccount!}
        startDt={new Date(lastEntry.datetime)}
        initial={{ date: now.toLocaleDateString('en-CA'), time: fmtInputTime(now) }}
        stale={clockOutPrompt.stale}
        onClose={dismissClockOutAt}
        onSave={clockOutAtTime}
      />}

      {modal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-title">{modal.title}</div>
            <div className="modal-body">{modal.body}</div>
            <div className="modal-btns">
              <button className="modal-cancel" onClick={() => setModal(null)}>Cancel</button>
              <button className="modal-confirm" onClick={() => { modal.onConfirm(); setModal(null); }}>{modal.confirmLabel ?? 'Delete'}</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`toast ${toast.undo ? 'has-action' : ''}`} role="status">
          <span>{toast.msg}</span>
          {toast.undo && (
            <button className="toast-action" onClick={() => { toast.undo!(); }}>Undo</button>
          )}
        </div>
      )}

      <div className="content">
        <div className="header">
          <div className={`time-display ${isClockedIn ? 'clocked-in' : ''}`}>{timeStr}</div>
          <div className="date-line">{dateStr}</div>
        </div>

        <div className={`status-bar ${isClockedIn ? 'active' : ''}`}>
          {isClockedIn ? (
            <>
              <div className="status-top-row">
                <div className="status-label">Clocked in</div>
                <div className="running-time">{fmtDuration(runningMs)}</div>
              </div>
              <div className="status-account">{currentAccount}</div>
              {isStale && (
                <button className="stale-note" onClick={() => setClockOutAt({ stale: true })}>
                  Running since {new Date(lastEntry.datetime).toLocaleString('en-US', { weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false })} — forgot to clock out?
                </button>
              )}
              <div className="clock-out-row">
                <button className="clock-out-btn" onClick={clockOut}>Clock Out</button>
                <button className="clock-out-btn clock-out-at" onClick={() => setClockOutAt({ stale: false })}
                  aria-label="Clock out at an earlier time" title="Clock out at an earlier time">at…</button>
              </div>
            </>
          ) : (
            <>
              <div className="status-left">
                <div className="status-label">Status</div>
                <div className="status-idle">— idle —</div>
              </div>
              {todayMs > 0 ? (
                <div style={{ textAlign: 'right' }}>
                  <div className="status-label">Today</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: '18px', color: 'var(--amber)', fontWeight: '600' }}>
                    {fmtDuration(todayMs)}
                  </div>
                </div>
              ) : (
                <div style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--muted)' }}>No entries today</div>
              )}
            </>
          )}
        </div>

        {tab === 'clock' && showBackupNudge && (
          <BackupNudge
            lastBackup={lastBackupAt ? fmtAgo(lastBackupAt, now) : null}
            onExport={doExport}
            onSetUpSync={() => setTab('projects')}
            onSnooze={snoozeBackup}
          />
        )}

        {tab === 'clock' && (
          <ClockTab
            isClockedIn={isClockedIn}
            projects={projects}
            hiddenProjects={actualHiddenProjects}
            currentAccount={currentAccount}
            todayDay={todayDay}
            clockIn={clockIn}
          />
        )}

        {tab === 'log' && (
          <LogTab
            days={days}
            openEdit={openEdit}
            openAdd={openAdd}
            deleteSession={deleteSession}
          />
        )}

        {tab === 'projects' && (
          <ProjectsTab
            concept={concept}
            setConcept={setConcept}
            scheme={scheme}
            setScheme={setScheme}
            allProjectNames={allProjectNames}
            hiddenProjects={actualHiddenProjects}
            toggleHidden={toggleHidden}
            addProject={addProject}
            renameProject={renameProject}
            deleteProject={deleteProject}
            doExport={doExport}
            doExportCsv={doExportCsv}
            doImport={doImport}
            clearAll={clearAll}
            allSessions={allSessions}
            days={days}
            sync={sync}
            lastBackup={lastBackupAt ? fmtAgo(lastBackupAt, now) : null}
            persisted={persisted}
          />
        )}
      </div>

      <Nav tab={tab} setTab={setTab} />
    </div>
  );
}

export default App;
