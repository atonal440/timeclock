import { useState } from 'react';
import { addDays, daysBetween } from '../utils/timeclock';

export interface SessionDraft {
  /** Entry indices of the session being edited; absent when adding one. */
  inIdx?: number;
  outIdx?: number | null;
  account: string;
  /** Start date. */
  date: string;
  startTime: string;
  /** Both null for a running session, which has no end yet. */
  endDate: string | null;
  endTime: string | null;
}

interface SessionModalProps {
  draft: SessionDraft;
  projects: string[];
  onClose: () => void;
  /** Returns an error message to show, or null once saved. */
  onSave: (d: SessionDraft) => string | null;
}

export function SessionModal({ draft: initial, projects, onClose, onSave }: SessionModalProps) {
  const [d, setD] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const isNew = initial.inIdx === undefined;
  const set = (patch: Partial<SessionDraft>) => { setD(p => ({ ...p, ...patch })); setError(null); };
  const endsNextDay = d.endDate === d.date && !!d.endTime && d.endTime <= d.startTime;
  // Moving the start date carries the end date along, keeping the duration.
  const setStartDate = (date: string) => {
    const shift = date && d.date ? daysBetween(d.date, date) : 0;
    set({ date, endDate: d.endDate && shift ? addDays(d.endDate, shift) : d.endDate });
  };
  const options = Array.from(new Set([...projects, ...(d.account ? [d.account] : [])]));

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title" style={{ marginBottom: 16 }}>{isNew ? 'Add Entry' : 'Edit Entry'}</div>

        <div className="edit-row">
          <label className="edit-label" htmlFor="edit-account">Client / Project</label>
          <select
            id="edit-account"
            className="edit-field"
            value={d.account}
            onChange={e => set({ account: e.target.value })}
          >
            {!d.account && <option value="" disabled>Choose a project</option>}
            {options.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div className="edit-row">
          <label className="edit-label" htmlFor="edit-date">Start</label>
          <div className="edit-pair">
            <input
              id="edit-date"
              type="date"
              className="edit-field"
              aria-label="Start date"
              value={d.date}
              onChange={e => setStartDate(e.target.value)}
            />
            <input
              id="edit-start-time"
              type="time"
              className="edit-field"
              aria-label="Start time"
              value={d.startTime}
              onChange={e => set({ startTime: e.target.value })}
            />
          </div>
        </div>

        {d.endTime !== null && d.endDate !== null && (
          <div className="edit-row">
            <label className="edit-label" htmlFor="edit-end-date">
              End{endsNextDay && <span className="edit-label-note"> · next day</span>}
            </label>
            <div className="edit-pair">
              <input
                id="edit-end-date"
                type="date"
                className="edit-field"
                aria-label="End date"
                value={d.endDate}
                onChange={e => set({ endDate: e.target.value })}
              />
              <input
                id="edit-end-time"
                type="time"
                className="edit-field"
                aria-label="End time"
                value={d.endTime}
                onChange={e => set({ endTime: e.target.value })}
              />
            </div>
          </div>
        )}

        {error && <div className="form-error" role="alert">{error}</div>}

        <div className="modal-btns" style={{ marginTop: 14 }}>
          <button className="modal-cancel" onClick={onClose}>Cancel</button>
          <button className="modal-save" onClick={() => setError(onSave(d))}>Save</button>
        </div>
      </div>
    </div>
  );
}
