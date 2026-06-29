import { useState, useEffect, useMemo } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import type { Entry } from './utils/timeclock';
import { parseTimeclockFile, exportTimeclock, fmtDuration,
  calcSessions, groupByDay
} from './utils/timeclock';
import { conceptFor, themeId } from './utils/themes';

import { Nav } from './components/Nav';
import { ClockTab } from './components/ClockTab';
import { LogTab } from './components/LogTab';
import { ProjectsTab } from './components/ProjectsTab';
import { EditModal } from './components/EditModal';

interface ModalState {
  title: string;
  body: string;
  onConfirm: () => void;
}

export function App() {
  const [entries, setEntries] = useLocalStorage<Entry[]>('tc-entries', []);
  const [projects, setProjects] = useLocalStorage<string[]>('tc-projects', []);
  const [hiddenProjects, setHiddenProjects] = useLocalStorage<Set<string>>('tc-hidden-projects', new Set());
  const [concept, setConcept] = useLocalStorage<string>('tc-concept', 'auto');
  const [scheme, setScheme] = useLocalStorage<string>('tc-scheme', 'system');

  // Convert loaded hiddenProjects array back to Set if needed (since JSON.stringify converts Set to Object/Array)
  const actualHiddenProjects = hiddenProjects instanceof Set ? hiddenProjects : new Set(hiddenProjects as unknown as string[]);

  const [tab, setTab] = useState('clock');
  const [modal, setModal] = useState<ModalState | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  const [editSession, setEditSession] = useState<any>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

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

  const { allSessions, days, allProjectNames } = useMemo(() => {
    const allSessions = calcSessions(entries);
    const days = groupByDay(allSessions);
    const allProjectNames = Array.from(new Set([...projects, ...allSessions.map(s => s.account)]));
    return { allSessions, days, allProjectNames };
  }, [entries, projects]);

  const todayKey = now.toLocaleDateString('en-CA');
  const todayDay = days.find(d => d.date === todayKey);
  const todayMs = todayDay ? todayDay.totalMs + (isClockedIn ? runningMs : 0) : (isClockedIn ? runningMs : 0);

  function clockIn(account: string) {
    if (isClockedIn) {
      const now2 = new Date().toISOString();
      setEntries(p => [...p, { type: 'o', datetime: now2 }, { type: 'i', datetime: new Date().toISOString(), account }]);
    } else {
      setEntries(p => [...p, { type: 'i', datetime: new Date().toISOString(), account }]);
    }
  }

  function clockOut() {
    setEntries(p => [...p, { type: 'o', datetime: new Date().toISOString() }]);
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  function openEdit(s: any) {
    setEditSession({
      inIdx: s.inIdx,
      outIdx: s.outIdx,
      account: s.account,
      date: s.date,
      startTime: fmtInputTime(s.startDt),
      endTime: s.endDt ? fmtInputTime(s.endDt) : null
    });
  }

  function fmtInputTime(dt: Date) {
    return dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  function saveEdit() {
    if (!editSession) return;
    const { inIdx, outIdx, account, date, startTime, endTime } = editSession;
    setEntries(prev => {
      const next = [...prev];
      next[inIdx] = { ...next[inIdx], account, datetime: new Date(`${date}T${startTime}:00`).toISOString() };
      if (outIdx !== null && endTime) {
        next[outIdx] = { ...next[outIdx], datetime: new Date(`${date}T${endTime}:00`).toISOString() };
      }
      return next;
    });
    setEditSession(null);
  }

  function deleteSession(inIdx: number, outIdx: number | null) {
    setModal({
      title: 'Delete entry?',
      body: 'This session will be removed from your log.',
      onConfirm: () => setEntries(prev => prev.filter((_, i) => i !== inIdx && i !== outIdx))
    });
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
      setEntries(prev => {
        const existing = new Set(prev.map(e => e.datetime + e.type));
        const merged = [...prev, ...parsed.filter(e => !existing.has(e.datetime + e.type))]
          .sort((a, b) => a.datetime.localeCompare(b.datetime));
        return merged;
      });
      const accs = parsed.filter(e => e.type === 'i').map(e => e.account!);
      setProjects(prev => Array.from(new Set([...prev, ...accs])));
      showToast(`Imported ${parsed.length} entries.`);
      return true;
    } catch (e: any) {
      showToast('Parse error: ' + e.message);
      return false;
    }
  }

  function doExport() {
    const blob = new Blob([exportTimeclock(entries)], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'timeclock.journal'; a.click();
    URL.revokeObjectURL(url);
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

  const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <div className="app">

      {editSession && <EditModal
        editSession={editSession}
        setEditSession={setEditSession}
        projects={projects}
        saveEdit={saveEdit}
      />}

      {modal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-title">{modal.title}</div>
            <div className="modal-body">{modal.body}</div>
            <div className="modal-btns">
              <button className="modal-cancel" onClick={() => setModal(null)}>Cancel</button>
              <button className="modal-confirm" onClick={() => { modal.onConfirm(); setModal(null); }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}

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
            <button className="clock-out-btn" onClick={clockOut}>Clock Out</button>
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

      <div className="content">
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
            doExport={doExport}
            doImport={doImport}
            clearAll={clearAll}
            allSessions={allSessions}
            days={days}
          />
        )}
      </div>

      <Nav tab={tab} setTab={setTab} />
    </div>
  );
}

export default App;
