
interface EditSessionData {
  inIdx: number;
  outIdx: number | null;
  account: string;
  date: string;
  startTime: string;
  endTime: string | null;
}

interface EditModalProps {
  editSession: EditSessionData;
  setEditSession: React.Dispatch<React.SetStateAction<EditSessionData | null>>;
  projects: string[];
  saveEdit: () => void;
}

export function EditModal({ editSession, setEditSession, projects, saveEdit }: EditModalProps) {
  if (!editSession) return null;

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setEditSession(null)}>
      <div className="modal">
        <div className="modal-title" style={{ marginBottom: 16 }}>Edit Entry</div>

        <div className="edit-row">
          <label className="edit-label" htmlFor="edit-account">Client / Project</label>
          <select
            id="edit-account"
            className="edit-field"
            value={editSession.account}
            onChange={e => setEditSession(p => p ? { ...p, account: e.target.value } : null)}
          >
            {Array.from(new Set([...projects, editSession.account])).map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div className="edit-times">
          <div className="edit-row">
            <label className="edit-label" htmlFor="edit-start-time">Start</label>
            <input
              id="edit-start-time"
              type="time"
              className="edit-field"
              value={editSession.startTime}
              onChange={e => setEditSession(p => p ? { ...p, startTime: e.target.value } : null)}
            />
          </div>
          {editSession.outIdx !== null && (
            <div className="edit-row">
              <label className="edit-label" htmlFor="edit-end-time">End</label>
              <input
                id="edit-end-time"
                type="time"
                className="edit-field"
                value={editSession.endTime || ''}
                onChange={e => setEditSession(p => p ? { ...p, endTime: e.target.value } : null)}
              />
            </div>
          )}
        </div>

        <div className="modal-btns" style={{ marginTop: 6 }}>
          <button className="modal-cancel" onClick={() => setEditSession(null)}>Cancel</button>
          <button className="modal-save" onClick={saveEdit}>Save</button>
        </div>
      </div>
    </div>
  );
}
