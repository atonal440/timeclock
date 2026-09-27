import { useState } from 'react';

export interface SessionDraft {
  /** Entry indices of the session being edited; absent when adding one. */
  inIdx?: number;
  outIdx?: number | null;
  account: string;
  date: string;
  startTime: string;
  /** null for a running session, which has no end yet. */
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
  const endsNextDay = d.endTime !== null && d.endTime !== '' && d.endTime <= d.startTime;
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
          <label className="edit-label" htmlFor="edit-date">Date</label>
          <input
            id="edit-date"
            type="date"
            className="edit-field"
            value={d.date}
            onChange={e => set({ date: e.target.value })}
          />
        </div>

        <div className="edit-times">
          <div className="edit-row">
            <label className="edit-label" htmlFor="edit-start-time">Start</label>
            <input
              id="edit-start-time"
              type="time"
              className="edit-field"
              value={d.startTime}
              onChange={e => set({ startTime: e.target.value })}
            />
          </div>
          {d.endTime !== null && (
            <div className="edit-row">
              <label className="edit-label" htmlFor="edit-end-time">
                End{endsNextDay && <span className="edit-label-note"> · next day</span>}
              </label>
              <input
                id="edit-end-time"
                type="time"
                className="edit-field"
                value={d.endTime}
                onChange={e => set({ endTime: e.target.value })}
              />
            </div>
          )}
        </div>

        {error && <div className="form-error" role="alert">{error}</div>}

        <div className="modal-btns" style={{ marginTop: 14 }}>
          <button className="modal-cancel" onClick={onClose}>Cancel</button>
          <button className="modal-save" onClick={() => setError(onSave(d))}>Save</button>
        </div>
      </div>
    </div>
  );
}
