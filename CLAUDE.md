# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development

Serve locally with Python:
```
python3 -m http.server 8000
```

There is no build step, no bundler, no package manager, and no test suite. The entire app is a single file: `index.html`.

After making changes, bump the cache version in `sw.js` (`timeclock-vN`) to force the service worker to reinstall and clear stale cache. Users will see the old version on first load and the new version on the next reload (stale-while-revalidate strategy).

## Architecture

Everything lives in `index.html` — React 18, all CSS, and all app logic in one file. React and fonts are loaded from CDN (no local node_modules). `sw.js` handles caching. `manifest.json` defines the PWA metadata.

**No JSX.** All components use `React.createElement(...)` directly.

**State** (all in `localStorage`):
- `tc-entries` — array of `{ type: 'i'|'o', datetime: ISO string, account?: string }`
- `tc-projects` — array of project name strings (the explicit projects list)
- `tc-hidden-projects` — array of project names to hide from the Clock tab
- `tc-theme` — `'light' | 'dark' | 'system'`

**Data model:** Entries are raw clock-in/out events in chronological order. `calcSessions()` pairs them into sessions. `groupByDay()` groups sessions by date. The `projects` list is separate from entries — a project can exist in entries without being in the list (e.g. from an import), and vice versa. `allProjectNames` (computed in `App`) is the union of both.

**Project names** follow hledger account naming: colon-separated segments like `Client:Project` or `Work:Pruning:ClientA`. The Projects tab renders these as a flat sorted list with prefix segments muted and the leaf segment bold.

**hledger timeclock format** (export/import):
```
i YYYY/MM/DD HH:MM Account:Name
o YYYY/MM/DD HH:MM
```

## Deployment

The app is deployed at `github.com/atonal440/timeclock` and served via GitHub Pages at `/timeclock/`. Push to `main` to deploy.
