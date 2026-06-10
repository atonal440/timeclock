import type { DayData } from "../utils/timeclock";
import { fmtDuration } from '../utils/timeclock';

interface ClockTabProps {
  isClockedIn: boolean;
  projects: string[];
  hiddenProjects: Set<string>;
  currentAccount: string | null;
  todayDay: DayData | undefined;
  clockIn: (account: string) => void;
}

export function ClockTab({ isClockedIn, projects, hiddenProjects, currentAccount, todayDay, clockIn }: ClockTabProps) {
  return (
    <>
      <div className="section-label" style={{ marginTop: 4 }}>
        {isClockedIn ? 'Switch to' : 'Clock in to'}
      </div>
      <div className="project-grid">
        {projects.filter(p => !hiddenProjects.has(p)).map(p => {
          const isCurrent = p === currentAccount;
          const accountMs = todayDay?.sessions.filter((s: any) => s.account === p && s.ms).reduce((a: number, s: any) => a + s.ms, 0) || 0;
          return (
            <button
              key={p}
              className={`project-btn ${isCurrent ? 'current' : ''}`}
              onClick={() => clockIn(p)}
            >
              <div>
                <div className="project-name">{p}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                {isCurrent && <span className="project-badge">● NOW</span>}
                {accountMs > 0 && !isCurrent && (
                  <span style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--muted)' }}>
                    {fmtDuration(accountMs)} today
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
      {projects.length === 0 && (
        <div className="empty-state">
          <span className="icon">⚙️</span>
          No projects yet. Add some in the Projects tab.
        </div>
      )}
      {projects.length > 0 && !isClockedIn && (
        <div className="tap-hint">Tap a project to clock in</div>
      )}
    </>
  );
}
