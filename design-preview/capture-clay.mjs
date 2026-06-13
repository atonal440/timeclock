import { chromium } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'shots-clay');
fs.mkdirSync(OUT, { recursive: true });
const CHROME = join(process.env.HOME, '.cache/ms-playwright/chromium-1223/chrome-linux/chrome');
const URL = 'http://localhost:5173/';

const SEED = () => {
  const projects = ['Acme:Website','Acme:Mobile','Pruning:ClientA','Personal:Admin','Garden:Maintenance'];
  const iso = (d) => new Date(d).toISOString();
  const now = Date.now(); const H = 3600e3, M = 60e3; const e = [];
  e.push({ type:'i', datetime: iso(now-6*H), account:'Acme:Mobile' });
  e.push({ type:'o', datetime: iso(now-4*H-20*M) });
  e.push({ type:'i', datetime: iso(now-47*M), account:'Acme:Website' });
  localStorage.setItem('tc-entries', JSON.stringify(e));
  localStorage.setItem('tc-projects', JSON.stringify(projects));
  localStorage.setItem('tc-hidden-projects', JSON.stringify([]));
  localStorage.setItem('tc-theme', 'daily');
};

// Each candidate is a box-shadow/border override on the active session card.
const CANDS = [
  { id: 'current', name: 'Current (baseline)', css: `` },
  { id: 'A', name: 'A · Inset accent ring', css: `
    .status-bar.active { box-shadow:
      inset 6px 6px 12px var(--neu-d),
      inset -6px -6px 12px rgba(255,255,255,0.07),
      inset 0 0 0 1.5px var(--lime-dim) !important; }` },
  { id: 'B', name: 'B · Tinted recess + bright ring', css: `
    .status-bar.active { background:#30293f !important; box-shadow:
      inset 6px 6px 12px var(--neu-d),
      inset -6px -6px 12px rgba(255,255,255,0.08),
      inset 0 0 0 1.5px var(--lime) !important; }` },
  { id: 'C', name: 'C · Outer hairline', css: `
    .status-bar.active { border:1px solid var(--lime-dim) !important; box-shadow:
      inset 6px 6px 12px var(--neu-d),
      inset -6px -6px 12px rgba(255,255,255,0.07) !important; }` },
  { id: 'D', name: 'D · Contrast only (no border)', css: `
    .status-bar.active { background:#31343f !important; box-shadow:
      inset 7px 7px 15px rgba(0,0,0,0.6),
      inset -6px -6px 13px rgba(255,255,255,0.09) !important; }` },
];

const CLIP = { x: 0, y: 84, width: 390, height: 200 };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, timezoneId:'America/New_York' });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil:'networkidle' });
await page.evaluate(SEED);

const panels = [];
for (const c of CANDS) {
  await page.goto(URL, { waitUntil:'networkidle' });
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'clay-dark'));
  await page.locator('.nav-btn').nth(0).click();
  await page.evaluate((css) => {
    let el = document.getElementById('__cand'); if (!el) { el = document.createElement('style'); el.id='__cand'; document.head.appendChild(el); }
    el.textContent = css;
  }, c.css);
  await sleep(350);
  const buf = await page.screenshot({ clip: CLIP });
  panels.push({ ...c, data: buf.toString('base64') });
}

const sheet = await ctx.newPage();
await sheet.setViewportSize({ width: 1480, height: 600 });
await sheet.setContent(`<!doctype html><meta charset=utf8><style>
  body{margin:0;background:#15171c;font-family:system-ui,sans-serif;padding:24px}
  h1{color:#fff;font-size:20px;margin:0 0 4px} p{color:#9aa0ad;font-size:12.5px;margin:0 0 18px}
  .grid{display:grid;grid-template-columns:repeat(5,1fr);gap:16px}
  .card{background:#1e2128;border:1px solid #2c303a;border-radius:10px;padding:10px}
  .card img{width:100%;border-radius:6px;display:block}
  .l{color:#e8edf5;font-size:12.5px;font-weight:600;margin:9px 2px 1px}
</style>
<h1>Soft Clay · dark — active session card edge treatments</h1>
<p>Goal: clear edge without losing the recessed (inset) feel · clay-dark</p>
<div class="grid">${panels.map(p=>`<div class="card"><img src="data:image/png;base64,${p.data}"><div class="l">${p.name}</div></div>`).join('')}</div>`);
await sleep(400);
const h = await sheet.evaluate(() => document.body.scrollHeight);
await sheet.setViewportSize({ width: 1480, height: h + 16 });
await sleep(150);
await sheet.screenshot({ path: join(OUT, 'clay-dark-edges.png'), fullPage: true });
await browser.close();
console.log('done');
