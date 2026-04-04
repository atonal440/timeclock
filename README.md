# TimeClock

A single-file progressive web app for tracking time in [hledger timeclock format](https://hledger.org/hledger.html#timeclock-format). Built for personal use — works offline, installs to your home screen, and exports data you can use in hledger time-tracking.

## Features

### Time Tracking
- Clock in/out with one tap
- Switch projects instantly — automatically clocks out of the current one
- Live running timer while clocked in
- Today's hours per project shown on each button

### Log & Editing
- Session history grouped by day (up to 60 days)
- Daily total hours per day
- Edit any session: change project, start time, or end time
- Delete accidental sessions

### Projects
- Add and remove projects freely
- Supports hledger account naming convention (e.g. `Client:Project`)
- New projects found in imported files are added automatically

### Import / Export
- Export all data as a `timeclock.journal` file in standard hledger format
- Import journal files and merge them in (duplicates are skipped)
- Clear all data with a confirmation prompt

### Stats
- Total sessions, total days logged, and all-time hours on the Projects tab

### Appearance
- Light, dark, and system theme modes

### PWA / Offline
- Installs to home screen on iOS and Android
- Works fully offline — loads from cache instantly, updates in the background when online
- Optimized for mobile with safe area support for notched devices

### Cloud Sync (Optional)
- Sync entries to Cloudflare Workers KV for backup and cross-device access
- Auto-push new entries on clock in/out
- Manual sync button in header for on-demand pull/push
- Works offline — retries sync automatically when back online
- Last-write-wins conflict resolution for edits
- See [CLOUDFLARE_SYNC_SETUP.md](./CLOUDFLARE_SYNC_SETUP.md) for deployment

## Data Storage

All data is stored locally in `localStorage` — nothing is sent to a server by default. Export your `timeclock.journal` regularly as a backup.

If you set up the optional cloud sync, entries are also stored in Cloudflare KV (see setup guide).

## hledger Format

Exported files use standard hledger timeclock format and can be included directly in your hledger journal:

```
i 2025/06/01 09:00 Client:Project
o 2025/06/01 12:30
```
