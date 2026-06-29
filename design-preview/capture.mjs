import { chromium } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });

const CHROME = join(process.env.HOME, '.cache/ms-playwright/chromium-1223/chrome-linux/chrome');
const URL = 'http://localhost:5173/';

// ── Seed data: a realistic state, currently clocked in ──────────────────────
const SEED = () => {
  const projects = [
    'Acme:Website', 'Acme:Mobile', 'Pruning:ClientA',
    'Personal:Admin', 'Garden:Maintenance',
  ];
  const iso = (d) => new Date(d).toISOString();
  const now = Date.now();
  const H = 3600e3, M = 60e3;
  // yesterday + today sessions, ending with an OPEN session (clocked in 47m ago)
  const e = [];
  const y = now - 24 * H;
  e.push({ type: 'i', datetime: iso(y - 9 * H), account: 'Acme:Website' });
  e.push({ type: 'o', datetime: iso(y - 6 * H) });
  e.push({ type: 'i', datetime: iso(y - 5 * H), account: 'Pruning:ClientA' });
  e.push({ type: 'o', datetime: iso(y - 1 * H) });
  e.push({ type: 'i', datetime: iso(now - 6 * H), account: 'Acme:Mobile' });
  e.push({ type: 'o', datetime: iso(now - 4 * H - 20 * M) });
  e.push({ type: 'i', datetime: iso(now - 3 * H), account: 'Personal:Admin' });
  e.push({ type: 'o', datetime: iso(now - 2 * H - 15 * M) });
  e.push({ type: 'i', datetime: iso(now - 47 * M), account: 'Acme:Website' }); // OPEN
  localStorage.setItem('tc-entries', JSON.stringify(e));
  localStorage.setItem('tc-projects', JSON.stringify(projects));
  localStorage.setItem('tc-hidden-projects', JSON.stringify([]));
  localStorage.setItem('tc-theme', 'dark');
};

// ── Design concepts (CSS overrides applied at runtime) ──────────────────────
const VARIANTS = [
  {
    id: '0-original',
    name: 'Original — Lime Terminal',
    css: ``,
  },
  {
    id: '1-aurora-glass',
    name: 'Aurora Glass',
    css: `
      html, body { background: #0b1020 !important; }
      body::before { content:''; position:fixed; inset:-20%; z-index:-1;
        background:
          radial-gradient(40% 35% at 20% 15%, rgba(56,189,248,.35), transparent 60%),
          radial-gradient(45% 40% at 85% 10%, rgba(167,139,250,.40), transparent 60%),
          radial-gradient(50% 45% at 70% 90%, rgba(45,212,191,.30), transparent 60%),
          linear-gradient(160deg, #0b1020, #131a36);
        filter: saturate(1.1); }
      :root {
        --bg: transparent !important; --text:#eef2ff !important; --muted:#9fb0d6 !important;
        --lime:#5eead4 !important; --lime-dim:rgba(94,234,212,.5) !important;
        --amber:#fcd34d !important; --times-color:#7e8bb5 !important;
        --border: rgba(255,255,255,.14) !important;
      }
      .app { background: transparent !important; }
      .status-bar, .project-btn, .day-card, .edit-field, .action-btn, .theme-opt, .add-input {
        background: rgba(255,255,255,.07) !important;
        backdrop-filter: blur(16px) saturate(1.4);
        -webkit-backdrop-filter: blur(16px) saturate(1.4);
        border:1px solid rgba(255,255,255,.16) !important; border-radius:18px !important;
        box-shadow: 0 8px 30px rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.18) !important; }
      .status-bar.active { background: rgba(94,234,212,.10) !important; border-color: rgba(94,234,212,.4) !important; }
      .nav { background: rgba(14,20,40,.55) !important; backdrop-filter: blur(20px); border-top:1px solid rgba(255,255,255,.12) !important; }
      .time-display.clocked-in { color:#5eead4 !important; text-shadow:0 0 24px rgba(94,234,212,.5) !important; }
      .project-badge { background: rgba(94,234,212,.18) !important; color:#5eead4 !important; border-color: rgba(94,234,212,.4) !important; }
    `,
  },
  {
    id: '2-neo-brutalist',
    name: 'Neo-Brutalist',
    theme: 'light',
    css: `
      html, body { background: #ffe14d !important; }
      :root, [data-theme="light"] {
        --bg:#ffe14d !important; --surface:#fff !important; --surface2:#fff !important;
        --border:#111 !important; --text:#111 !important; --muted:#555 !important;
        --lime:#1f6feb !important; --lime-dim:#111 !important; --amber:#e11d48 !important;
        --times-color:#777 !important; --nav-bg:#fff !important;
      }
      .app { background:#ffe14d !important; }
      .time-display { letter-spacing:-1px !important; }
      .status-bar, .project-btn, .day-card, .nav, .action-btn, .theme-opt, .edit-field, .add-input {
        border:3px solid #111 !important; border-radius:0 !important;
        box-shadow:5px 5px 0 #111 !important; }
      .status-bar.active { background:#c6f68d !important; }
      .project-btn:active { transform: translate(2px,2px) !important; box-shadow:2px 2px 0 #111 !important; }
      .section-label, .status-label, .nav-label, .date-line { font-weight:800 !important; color:#111 !important; }
      .project-name, .status-account { color:#111 !important; }
      .project-badge { background:#1f6feb !important; color:#fff !important; border:2px solid #111 !important; border-radius:0 !important; }
      .running-time, .day-total { color:#e11d48 !important; }
      .nav { box-shadow:0 -3px 0 #111 !important; }
      .clock-out-btn { background:#e11d48 !important; color:#fff !important; border:3px solid #111 !important; border-radius:0 !important; box-shadow:3px 3px 0 #111 !important; }
    `,
  },
  {
    id: '3-sunset',
    name: 'Sunset Warmth',
    theme: 'light',
    css: `
      html, body { background:#fff1e6 !important; }
      body::before { content:''; position:fixed; inset:0; z-index:-1;
        background: linear-gradient(165deg,#ffd9a0 0%, #ffb38a 30%, #ff8f9c 70%, #f06595 100%); }
      :root, [data-theme="light"] {
        --bg: transparent !important; --surface: rgba(255,255,255,.72) !important;
        --surface2: rgba(255,255,255,.85) !important; --border: rgba(255,255,255,.6) !important;
        --text:#5a2a3a !important; --muted:#a86b6b !important;
        --lime:#c2410c !important; --lime-dim:#fb923c !important; --amber:#be123c !important;
        --times-color:#c98a8a !important; --nav-bg: rgba(255,241,230,.7) !important;
      }
      .app { background: transparent !important; }
      .status-bar, .project-btn, .day-card, .action-btn, .theme-opt, .edit-field, .add-input {
        backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
        border-radius:20px !important; box-shadow:0 10px 24px rgba(192,64,30,.18) !important; }
      .nav { backdrop-filter: blur(16px); }
      .status-bar.active { background: rgba(255,255,255,.85) !important; border-color: rgba(251,146,60,.7) !important; }
      .project-badge { background: rgba(194,65,12,.14) !important; color:#c2410c !important; border-color: rgba(251,146,60,.6) !important; }
      .time-display.clocked-in { color:#c2410c !important; }
    `,
  },
  {
    id: '4-crt',
    name: 'CRT Terminal',
    css: `
      html, body { background:#020402 !important; }
      :root {
        --bg:#020402 !important; --surface:#06120a !important; --surface2:#0a1c10 !important;
        --border:#10391f !important; --text:#3bff7a !important; --muted:#1f8a45 !important;
        --lime:#54ff8f !important; --lime-dim:#1f8a45 !important; --amber:#aaff00 !important;
        --times-color:#177a3a !important; --nav-bg: rgba(2,4,2,.92) !important;
      }
      .app { font-family:'Azeret Mono',monospace !important; }
      .app::after { content:''; position:fixed; inset:0; pointer-events:none; z-index:60;
        background: repeating-linear-gradient(0deg, rgba(0,0,0,0) 0 2px, rgba(0,0,0,.28) 2px 4px);
        mix-blend-mode: multiply; }
      .app::before { content:''; position:fixed; inset:0; pointer-events:none; z-index:59;
        background: radial-gradient(120% 80% at 50% 50%, transparent 55%, rgba(0,0,0,.55)); }
      .time-display, .project-name, .status-account, .running-time, .day-total, .nav-icon {
        text-shadow:0 0 8px currentColor !important; }
      .section-label, .date-line, .status-label, .nav-label { text-transform:uppercase !important; }
      .status-bar, .project-btn, .day-card, .nav, .action-btn, .edit-field {
        border-radius:2px !important; }
      .time-display.clocked-in { color:#54ff8f !important; text-shadow:0 0 14px #54ff8f !important; }
      .project-badge { background: rgba(84,255,143,.14) !important; color:#54ff8f !important; border-color:#1f8a45 !important; border-radius:2px !important; }
    `,
  },
  {
    id: '5-indigo-pro',
    name: 'Indigo Pro',
    css: `
      html, body { background:#0e1018 !important; }
      :root {
        --bg:#0e1018 !important; --surface:#181b29 !important; --surface2:#1f2336 !important;
        --border:#2a2f45 !important; --text:#e7e9f3 !important; --muted:#8b8fae !important;
        --lime:#818cf8 !important; --lime-dim:#4f46e5 !important; --amber:#f472b6 !important;
        --times-color:#5b6086 !important; --nav-bg: rgba(14,16,24,.9) !important;
      }
      .status-bar, .project-btn, .day-card, .action-btn, .theme-opt, .edit-field, .add-input {
        border-radius:14px !important;
        box-shadow:0 6px 18px rgba(0,0,0,.35) !important; }
      .status-bar.active { background: linear-gradient(135deg, rgba(129,140,248,.14), rgba(99,102,241,.06)) !important; border-color: rgba(129,140,248,.5) !important; }
      .project-btn.current { background: rgba(129,140,248,.12) !important; }
      .time-display.clocked-in { color:#a5b4fc !important; text-shadow:0 0 26px rgba(129,140,248,.55) !important; }
      .project-badge { background: rgba(129,140,248,.18) !important; color:#a5b4fc !important; border-color: rgba(129,140,248,.45) !important; }
      .running-time { color:#a5b4fc !important; }
      .clock-out-btn { background: rgba(244,63,94,.14) !important; }
    `,
  },
  {
    id: '6-clay',
    name: 'Soft Clay',
    theme: 'light',
    css: `
      html, body { background:#e8e6ff !important; }
      :root, [data-theme="light"] {
        --bg:#e8e6ff !important; --surface:#efeefe !important; --surface2:#f6f5ff !important;
        --border: transparent !important; --text:#3a2e6b !important; --muted:#8b83bd !important;
        --lime:#7c5cff !important; --lime-dim:#b9aaff !important; --amber:#ef6aa8 !important;
        --times-color:#a99fd6 !important; --nav-bg: rgba(232,230,255,.85) !important;
      }
      .app { background:#e8e6ff !important; }
      .status-bar, .project-btn, .day-card, .action-btn, .theme-opt, .edit-field, .add-input, .nav {
        border:none !important; border-radius:24px !important;
        box-shadow: 8px 8px 18px rgba(160,150,210,.55), -8px -8px 18px rgba(255,255,255,.9) !important; }
      .status-bar.active { background:#f1ecff !important;
        box-shadow: inset 6px 6px 12px rgba(160,150,210,.4), inset -6px -6px 12px #fff !important; }
      .project-btn:active { box-shadow: inset 5px 5px 12px rgba(160,150,210,.5), inset -5px -5px 12px #fff !important; transform:none !important; }
      .project-badge { background:#7c5cff !important; color:#fff !important; border:none !important;
        box-shadow: 2px 2px 6px rgba(124,92,255,.5) !important; }
      .time-display.clocked-in { color:#7c5cff !important; }
      .nav { border-radius:24px 24px 0 0 !important; }
    `,
  },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  timezoneId: 'America/New_York',
});
const page = await ctx.newPage();

// prime origin then seed
await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(SEED);

const results = [];
for (const v of VARIANTS) {
  for (const tab of ['clock', 'log']) {
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.evaluate((theme) => {
      document.documentElement.setAttribute('data-theme', theme || 'dark');
    }, v.theme);
    // apply variant css
    await page.evaluate((css) => {
      let el = document.getElementById('__variant');
      if (!el) { el = document.createElement('style'); el.id = '__variant'; document.head.appendChild(el); }
      el.textContent = css;
    }, v.css);
    // navigate to tab
    const navIdx = tab === 'clock' ? 0 : 1;
    await page.locator('.nav-btn').nth(navIdx).click();
    await sleep(450);
    const file = join(OUT, `${v.id}-${tab}.png`);
    await page.screenshot({ path: file });
    results.push({ ...v, tab, file });
  }
  console.log('captured', v.id);
}

// ── Build a contact sheet (clock tab) ──────────────────────────────────────
const clockShots = VARIANTS.map((v) => ({
  name: v.name,
  data: fs.readFileSync(join(OUT, `${v.id}-clock.png`)).toString('base64'),
}));
const sheet = await ctx.newPage();
await sheet.setViewportSize({ width: 1380, height: 1400 });
await sheet.setContent(`<!doctype html><html><head><meta charset=utf8><style>
  body{margin:0;background:#15171c;font-family:system-ui,sans-serif;padding:26px;}
  h1{color:#fff;font-size:22px;margin:0 0 4px;}
  p{color:#9aa0ad;font-size:13px;margin:0 0 22px;}
  .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:22px;}
  .card{background:#1e2128;border:1px solid #2c303a;border-radius:12px;padding:12px;}
  .card img{width:100%;border-radius:8px;display:block;}
  .label{color:#e8edf5;font-size:14px;font-weight:600;margin:10px 2px 2px;}
</style></head><body>
  <h1>Timeclock — design concepts</h1>
  <p>Clock tab, active (clocked-in) state · 390×844 phone viewport</p>
  <div class="grid">
  ${clockShots.map((s) => `<div class="card"><img src="data:image/png;base64,${s.data}"><div class="label">${s.name}</div></div>`).join('')}
  </div>
</body></html>`);
await sleep(400);
const sheetH = await sheet.evaluate(() => document.body.scrollHeight);
await sheet.setViewportSize({ width: 1380, height: sheetH + 20 });
await sleep(200);
await sheet.screenshot({ path: join(OUT, 'contact-sheet.png'), fullPage: true });
console.log('contact sheet done');

await browser.close();
console.log('ALL DONE');
