interface BackupNudgeProps {
  /** e.g. "23 days ago"; null if never backed up. */
  lastBackup: string | null;
  onExport: () => void;
  onSetUpSync: () => void;
  onSnooze: () => void;
}

export function BackupNudge({ lastBackup, onExport, onSetUpSync, onSnooze }: BackupNudgeProps) {
  return (
    <div className="backup-nudge" role="note">
      <div className="backup-nudge-text">
        <strong>{lastBackup ? `Last backup ${lastBackup}.` : 'Not backed up yet.'}</strong>{' '}
        Your log only lives in this browser, which can clear it.
      </div>
      <div className="backup-nudge-btns">
        <button className="nudge-btn primary" onClick={onExport}>Export</button>
        <button className="nudge-btn" onClick={onSetUpSync}>Set up sync</button>
        <button className="nudge-btn" onClick={onSnooze}>Later</button>
      </div>
    </div>
  );
}
