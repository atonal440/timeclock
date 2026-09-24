// Resolve a Chromium binary for Playwright scripts and tests.
//
// Returns undefined when Playwright's own pinned browser is installed (CI, or
// after `npx playwright install`), so the default is used. Otherwise falls
// back to a preinstalled Chromium, such as the one Claude Code on the web
// ships at /opt/pw-browsers/chromium, or $CHROMIUM_PATH.
import { chromium } from '@playwright/test';
import fs from 'node:fs';

export function chromiumExecutable() {
  if (fs.existsSync(chromium.executablePath())) return undefined;
  const candidates = [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium'].filter(Boolean);
  return candidates.find(p => fs.existsSync(p));
}
