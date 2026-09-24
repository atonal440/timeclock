#!/usr/bin/env node
// Phone-size screenshots of the built app with realistic seed data.
//
//   npm run shots -- [--themes today|all|aurora-dark,lime-light] [--tabs clock,log,projects]
//                    [--device "iPhone 14"] [--url http://…] [--out shots] [--empty] [--no-sheet]
//
// With no --url it serves ./dist (building first if missing) on a spare port.
// Writes one PNG per theme × tab plus sheet.png, a contact sheet of all of them.
import { chromium, devices } from '@playwright/test';
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromiumExecutable } from './chromium-path.mjs';

const CONCEPTS = ['clay', 'indigo', 'aurora', 'sunset', 'crt', 'brutal', 'lime']; // by weekday, see src/utils/themes.ts
const TABS = { clock: 'Clock', log: 'Log', projects: 'Projects' };

function parseArgs(argv) {
  const opts = { themes: 'today', tabs: 'clock', device: 'iPhone 14', out: 'shots', url: null, empty: false, sheet: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--empty') opts.empty = true;
    else if (a === '--no-sheet') opts.sheet = false;
    else if (a.startsWith('--')) opts[a.slice(2)] = argv[++i];
  }
  return opts;
}

function resolveThemes(spec) {
  if (spec === 'all') return CONCEPTS.flatMap(c => [`${c}-light`, `${c}-dark`]);
  if (spec === 'today') {
    const c = CONCEPTS[new Date().getDay()];
    return [`${c}-light`, `${c}-dark`];
  }
  return spec.split(',').map(s => s.trim()).filter(Boolean);
}

// A realistic state: yesterday + today, currently clocked in for 47 minutes.
function seed() {
  const projects = ['Acme:Website', 'Acme:Mobile', 'Pruning:ClientA', 'Personal:Admin', 'Garden:Maintenance'];
  const iso = d => new Date(d).toISOString();
  const now = Date.now(), H = 3600e3, M = 60e3, y = now - 24 * H;
  const e = [
    { type: 'i', datetime: iso(y - 9 * H), account: 'Acme:Website' }, { type: 'o', datetime: iso(y - 6 * H) },
    { type: 'i', datetime: iso(y - 5 * H), account: 'Pruning:ClientA' }, { type: 'o', datetime: iso(y - 1 * H) },
    { type: 'i', datetime: iso(now - 6 * H), account: 'Acme:Mobile' }, { type: 'o', datetime: iso(now - 4 * H - 20 * M) },
    { type: 'i', datetime: iso(now - 3 * H), account: 'Personal:Admin' }, { type: 'o', datetime: iso(now - 2 * H - 15 * M) },
    { type: 'i', datetime: iso(now - 47 * M), account: 'Acme:Website' },
  ];
  return { 'tc-entries': e, 'tc-projects': projects, 'tc-hidden-projects': [] };
}

async function waitFor(url, ms = 20000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { if ((await fetch(url)).ok) return; } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function startServer() {
  if (!fs.existsSync('dist/index.html')) execSync('npm run build', { stdio: 'inherit' });
  const port = 4300 + Math.floor(Math.random() * 500);
  const proc = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true });
  const url = `http://localhost:${port}/`;
  await waitFor(url);
  return { url, stop: () => { try { process.kill(-proc.pid); } catch { /* already gone */ } } };
}

async function contactSheet(browser, files, out) {
  const imgs = files.map(f => `<figure><img src="data:image/png;base64,${fs.readFileSync(f).toString('base64')}"><figcaption>${path.basename(f, '.png')}</figcaption></figure>`).join('');
  const page = await browser.newPage({ viewport: { width: 1200, height: 100 } });
  await page.setContent(`<style>
    body { margin: 0; padding: 16px; background: #222; font: 13px system-ui; color: #ddd;
      display: grid; grid-template-columns: repeat(${Math.min(files.length, 4)}, 1fr); gap: 16px; }
    figure { margin: 0; } img { width: 100%; border-radius: 8px; display: block; } figcaption { padding-top: 6px; }
  </style>${imgs}`);
  await page.waitForLoadState('load');
  await page.screenshot({ path: out, fullPage: true });
  await page.close();
}

const opts = parseArgs(process.argv.slice(2));
const themes = resolveThemes(opts.themes);
const tabs = opts.tabs === 'all' ? Object.keys(TABS) : opts.tabs.split(',');
const device = devices[opts.device];
if (!device) throw new Error(`Unknown device "${opts.device}" (see Playwright's devices list)`);
fs.mkdirSync(opts.out, { recursive: true });

const server = opts.url ? { url: opts.url, stop() {} } : await startServer();
const browser = await chromium.launch({ executablePath: chromiumExecutable() });
const written = [];
try {
  const { defaultBrowserType: _ignored, ...contextOpts } = device;
  const context = await browser.newContext({ ...contextOpts, serviceWorkers: 'block' });
  const data = opts.empty ? {} : seed();
  for (const theme of themes) {
    const [concept, scheme] = theme.split('-');
    const page = await context.newPage();
    await page.addInitScript(({ data, concept, scheme }) => {
      localStorage.clear();
      for (const [k, v] of Object.entries(data)) localStorage.setItem(k, JSON.stringify(v));
      localStorage.setItem('tc-concept', JSON.stringify(concept));
      localStorage.setItem('tc-scheme', JSON.stringify(scheme));
    }, { data, concept, scheme });
    await page.goto(server.url);
    await page.waitForSelector('.app');
    await page.evaluate(() => document.fonts.ready);
    for (const tab of tabs) {
      await page.locator('.nav-btn', { hasText: TABS[tab] }).click();
      await page.waitForTimeout(400);
      const file = path.join(opts.out, `${theme}-${tab}.png`);
      await page.screenshot({ path: file });
      written.push(file);
    }
    await page.close();
  }
  if (opts.sheet && written.length > 1) {
    const sheet = path.join(opts.out, 'sheet.png');
    await contactSheet(browser, written, sheet);
    written.push(sheet);
  }
} finally {
  await browser.close();
  server.stop();
}
console.log(written.join('\n'));
