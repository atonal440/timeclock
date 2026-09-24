---
name: shots
description: Take phone-size screenshots of the TimeClock app (seeded with realistic data, in any theme and tab) and send them to the user. Use after UI changes, when asked to show/screenshot/preview the app, or to compare themes — the user usually develops from their phone and can't run the app locally.
---

# Phone screenshots

1. Build the current code: `npm run build` (the script only builds when `dist/` is missing, so rebuild after changes).
2. Run the script:

   ```bash
   npm run shots -- --themes <spec> --tabs <tabs>
   ```

   - `--themes`: `today` (default: today's weekday concept, light + dark), `all` (all 14), or a list like `aurora-dark,lime-light`. Concepts: clay, indigo, aurora, sunset, crt, brutal, lime.
   - `--tabs`: `clock` (default), `log`, `projects`, a comma list, or `all`.
   - `--device`: a Playwright device name, default `"iPhone 14"`.
   - `--empty`: no seed data (first-run state). Otherwise the app is seeded with five projects and two days of sessions, clocked in for 47 minutes.
   - `--url`: screenshot an already-running server instead of serving `dist/`.
   - `--out`: output directory, default `shots/` (gitignored).

3. The script prints the PNG paths. When there's more than one it also writes `sheet.png`, a contact sheet of all of them. Send the sheet, or the one or two most relevant shots, with `SendUserFile` (`display: "render"`) and a one-line caption saying what changed. Look at the images yourself first and point out anything that looks off.

Notes:
- Google Fonts may be blocked in the cloud container, so text falls back to system fonts. Mention this if typography is what's being reviewed.
- Chromium resolves through `scripts/chromium-path.mjs`, which uses the preinstalled `/opt/pw-browsers/chromium` in Claude Code on the web.
