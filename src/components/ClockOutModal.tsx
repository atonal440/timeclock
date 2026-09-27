import { useState } from 'react';

interface ClockOutModalProps {
  account: string;
  startDt: Date;
  initial: { date: string; time: string };
  /** Shown when the session looks like a forgotten clock-out. */
  stale: boolean;
  onClose: () => void;
  /** Returns an error message to show, or null once clocked out. */
  onSave: (date: string, time: string) => string | null;
}

export function ClockOutModal({ account, startDt, initial, stale, onClose, onSave }: ClockOutModalProps) {
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [error, setError] = useState<string | null>(null);
  const started = startDt.toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  });

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">{stale ? 'Forgot to clock out?' : 'Clock out at…'}</div>
        <div className="modal-body" style={{ marginBottom: 16 }}>
          <strong>{account}</strong> has been running since {started}. When did you stop?
        </div>

        <div className="edit-times">
          <div className="edit-row">
            <label className="edit-label" htmlFor="clockout-date">Date</label>
            <input id="clockout-date" type="date" className="edit-field" value={date}
              onChange={e => { setDate(e.target.value); setError(null); }} />
          </div>
          <div className="edit-row">
            <label className="edit-label" htmlFor="clockout-time">Time</label>
            <input id="clockout-time" type="time" className="edit-field" value={time}
              onChange={e => { setTime(e.target.value); setError(null); }} />
          </div>
        </div>

        {error && <div className="form-error" role="alert">{error}</div>}

        <div className="modal-btns" style={{ marginTop: 14 }}>
          <button className="modal-cancel" onClick={onClose}>{stale ? 'Still working' : 'Cancel'}</button>
          <button className="modal-save" onClick={() => setError(onSave(date, time))}>Clock out</button>
        </div>
      </div>
    </div>
  );
}
