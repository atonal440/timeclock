import type { DayData, SessionData } from '../utils/timeclock';
import { fmtDate, fmtDuration, fmtTime } from '../utils/timeclock';

interface LogTabProps {
  days: DayData[];
  openEdit: (s: SessionData) => void;
  openAdd: () => void;
  deleteSession: (inIdx: number, outIdx: number | null) => void;
}

export function LogTab({ days, openEdit, openAdd, deleteSession }: LogTabProps) {
  const broken = days.flatMap(d => d.sessions.filter(s => s.broken));
  return (
    <>
      <div className="section-head">
        <div className="section-label" style={{ marginTop: 4 }}>Sessions</div>
        <button className="add-entry-btn" onClick={openAdd}>＋ Add entry</button>
      </div>
      {broken.length > 0 && (
        <div className="broken-notice" role="note">
          <div className="broken-notice-title">
            {broken.length === 1 ? '1 session is' : `${broken.length} sessions are`} missing a clock-out
          </div>
          {broken.map(s => (
            <div key={s.inIdx} className="broken-notice-row">
              <span>{fmtDate(s.date)} · {fmtTime(s.startDt)} · {s.account}</span>
              <button className="nudge-btn primary" onClick={() => openEdit(s)}>Fix</button>
            </div>
          ))}
        </div>
      )}
      {days.length === 0 ? (
        <div className="empty-state">
          <span className="icon">📋</span>
          No entries yet. Clock in to start tracking, or add a past session.
        </div>
      ) : (
        days.slice(0, 60).map(day => (
          <div key={day.date} className="day-card">
            <div className="day-header">
              <div className="day-date">{fmtDate(day.date)}</div>
              <div className="day-total">{fmtDuration(day.totalMs)}</div>
            </div>
            <div className="day-rows">
              {day.sessions.map((s, si) => (
                <div key={si} className={`day-row ${s.broken ? 'broken' : ''}`}>
                  <div className="day-row-left">
                    <div className="day-row-account">{s.account}</div>
                    <div className="day-row-times">
                      {s.endDt
                        ? `${fmtTime(s.startDt)} → ${fmtTime(s.endDt)}`
                        : s.broken
                          ? `${fmtTime(s.startDt)} → ? · no clock-out`
                          : `${fmtTime(s.startDt)} → now`}
                    </div>
                  </div>
                  <div className="day-row-right">
                    <div className="day-row-dur">
                      {s.ms ? fmtDuration(s.ms) : '—'}
                    </div>
                    <button
                      className="session-edit"
                      onClick={() => openEdit(s)}
                      title="Edit entry"
                      aria-label="Edit session"
                    >
                      ✎
                    </button>
                    <button
                      className="session-del"
                      onClick={() => deleteSession(s.inIdx, s.outIdx)}
                      title="Delete entry"
                      aria-label="Delete session"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </>
  );
}
