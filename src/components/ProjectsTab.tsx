import { useState } from "react";
import type { DayData, SessionData } from '../utils/timeclock';
import { fmtDuration } from '../utils/timeclock';

interface ProjectsTabProps {
  theme: string;
  setTheme: (t: string) => void;
  allProjectNames: string[];
  hiddenProjects: Set<string>;
  toggleHidden: (p: string) => void;
  addProject: (p: string) => void;
  doExport: () => void;
  doImport: (text: string) => boolean;
  clearAll: () => void;
  allSessions: SessionData[];
  days: DayData[];
}

declare const __APP_VERSION__: string;

export function ProjectsTab({
  theme, setTheme, allProjectNames, hiddenProjects, toggleHidden,
  addProject, doExport, doImport, clearAll, allSessions, days
}: ProjectsTabProps) {
  const [newProject, setNewProject] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [showHidden, setShowHidden] = useState(false);

  const handleAddProject = () => {
    addProject(newProject);
    setNewProject('');
  };

  const handleImport = () => {
    if (doImport(importText)) {
      setShowImport(false);
      setImportText('');
    }
  };

  return (
    <>
      <div className="settings-section">
        <div className="section-label">Appearance</div>
        <div className="theme-toggle">
          {[
            ['light', '☀ Light'],
            ['system', '⬤ System'],
            ['dark', '☽ Dark']
          ].map(([val, label]) => (
            <button
              key={val}
              className={`theme-opt ${theme === val ? 'active' : ''}`}
              onClick={() => setTheme(val)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-section">
        <div className="section-label">Projects</div>
        <div>
          {allProjectNames.length > 0 ? (() => {
            const sorted = [...allProjectNames].sort();
            const visible = sorted.filter(n => !hiddenProjects.has(n));
            const hidden  = sorted.filter(n =>  hiddenProjects.has(n));

            const renderRow = (name: string) => {
              const parts = name.split(':');
              const root = parts.length > 1 ? parts[0] + ':' : null;
              const mid = parts.length > 2 ? parts.slice(1, -1).join(':') + ':' : null;
              const leaf = parts[parts.length - 1];
              const isHidden = hiddenProjects.has(name);
              return (
                <div key={name} className="project-flat-row">
                  <span className="project-path">
                    {root && <span className="project-path-root">{root}</span>}
                    {mid && <span className="project-path-mid">{mid}</span>}
                    <span className="project-path-leaf">{leaf}</span>
                  </span>
                  <button
                    className={`vis-btn ${isHidden ? 'vis-hidden' : 'vis-visible'}`}
                    onClick={() => toggleHidden(name)}
                    title={isHidden ? 'Show in Clock tab' : 'Hide from Clock tab'}
                  >
                    {isHidden ? 'hidden' : 'visible'}
                  </button>
                </div>
              );
            };

            return (
              <>
                {visible.map(renderRow)}
                {hidden.length > 0 && (
                  <>
                    <button
                      className="hidden-disclosure"
                      onClick={() => setShowHidden(s => !s)}
                    >
                      {showHidden ? '▾' : '▸'} {hidden.length} hidden
                    </button>
                    {showHidden && hidden.map(renderRow)}
                  </>
                )}
              </>
            );
          })() : (
            <div className="hint">No projects yet.</div>
          )}
        </div>
        <div className="add-row" style={{ marginTop: 12 }}>
          <input
            className="add-input"
            value={newProject}
            onChange={e => setNewProject(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddProject()}
            placeholder="Client:Project"
            aria-label="New project name"
          />
          <button className="add-btn" onClick={handleAddProject} aria-label="Add project">＋</button>
        </div>
        <div className="hint">
          Use hledger-style names like Client:ProjectTag. Toggle visibility to show or hide projects in the Clock tab.
        </div>
      </div>

      <div className="settings-section">
        <div className="section-label">Data</div>
        <button className="action-btn" onClick={doExport}>⬇︎  Export timeclock.journal</button>
        <button className="action-btn" onClick={() => setShowImport(!showImport)}>⬆︎  Import timeclock file</button>

        {showImport && (
          <>
            <textarea
              className="import-area"
              value={importText}
              onChange={e => setImportText(e.target.value)}
              placeholder="i 2024/01/15 09:00:00 Client:Project&#10;o 2024/01/15 17:30:00&#10;..."
              aria-label="Import timeclock data"
            />
            <button className="confirm-btn" onClick={handleImport}>Import & Merge</button>
            <button className="cancel-btn" onClick={() => { setShowImport(false); setImportText(''); }}>Cancel</button>
          </>
        )}

        <div className="hint">
          Export produces a standard hledger timeclock file. Import merges with existing data — duplicates are skipped.
        </div>
        <button className="danger-btn" onClick={clearAll}>⚠  Clear all data</button>
      </div>

      <div className="settings-section">
        <div className="section-label">Stats</div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px' }}>
          <div className="stat-row">
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>Sessions logged</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>{allSessions.filter(s => s.ms !== null).length}</span>
          </div>
          <div className="stat-row">
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>Days logged</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>{days.length}</span>
          </div>
          <div className="stat-row">
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>All-time hours</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--amber)' }}>
              {fmtDuration(days.reduce((a, d) => a + d.totalMs, 0))}
            </span>
          </div>
        </div>
      </div>

      <div style={{ textAlign: 'center', margin: '20px 0', fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
        Build: {typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'}
      </div>
    </>
  );
}
