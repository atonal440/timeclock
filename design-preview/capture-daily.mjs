import { chromium } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'shots-daily');
fs.mkdirSync(OUT, { recursive: true });
const CHROME = join(process.env.HOME, '.cache/ms-playwright/chromium-1223/chrome-linux/chrome');
const URL = 'http://localhost:5173/';

const SEED = () => {
  const projects = ['Acme:Website','Acme:Mobile','Pruning:ClientA','Personal:Admin','Garden:Maintenance'];
  const iso = (d) => new Date(d).toISOString();
  const now = Date.now(); const H = 3600e3, M = 60e3; const e = [];
  const y = now - 24 * H;
  e.push({ type:'i', datetime: iso(y-9*H), account:'Acme:Website' });
  e.push({ type:'o', datetime: iso(y-6*H) });
  e.push({ type:'i', datetime: iso(y-5*H), account:'Pruning:ClientA' });
  e.push({ type:'o', datetime: iso(y-1*H) });
  e.push({ type:'i', datetime: iso(now-6*H), account:'Acme:Mobile' });
  e.push({ type:'o', datetime: iso(now-4*H-20*M) });
  e.push({ type:'i', datetime: iso(now-3*H), account:'Personal:Admin' });
  e.push({ type:'o', datetime: iso(now-2*H-15*M) });
  e.push({ type:'i', datetime: iso(now-47*M), account:'Acme:Website' });
  localStorage.setItem('tc-entries', JSON.stringify(e));
  localStorage.setItem('tc-projects', JSON.stringify(projects));
  localStorage.setItem('tc-hidden-projects', JSON.stringify([]));
  localStorage.setItem('tc-theme', 'daily');
};

// data-theme id → (weekday, friendly name) per src/utils/themes.ts
const DAYS = [
  { id:'clay',   day:'Sunday',    name:'Soft Clay' },
  { id:'indigo', day:'Monday',    name:'Indigo Pro' },
  { id:'aurora', day:'Tuesday',   name:'Aurora Glass' },
  { id:'sunset', day:'Wednesday', name:'Sunset Warmth' },
  { id:'crt',    day:'Thursday',  name:'CRT Terminal' },
  { id:'brutal', day:'Friday',    name:'Neo-Brutalist' },
  { id:'lime',   day:'Saturday',  name:'Lime Terminal' },
];
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, timezoneId:'America/New_York' });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil:'networkidle' });
await page.evaluate(SEED);

for (const d of DAYS) {
  await page.goto(URL, { waitUntil:'networkidle' });
  // 'daily' mode reads the weekday; force the rendered theme directly to preview each day
  await page.evaluate((id) => document.documentElement.setAttribute('data-theme', id), d.id);
  await page.locator('.nav-btn').nth(0).click();
  await sleep(400);
  await page.screenshot({ path: join(OUT, `${d.day.toLowerCase()}-${d.id}.png`) });
  console.log('captured', d.day, d.name);
}

// Projects → Appearance panel in daily mode (real, unforced — actual weekday)
await page.goto(URL, { waitUntil:'networkidle' });
await page.locator('.nav-btn').nth(2).click();
await sleep(400);
await page.screenshot({ path: join(OUT, 'projects-daily-panel.png') });
console.log('captured projects panel');

// Contact sheet
const shots = DAYS.map(d => ({ ...d, data: fs.readFileSync(join(OUT, `${d.day.toLowerCase()}-${d.id}.png`)).toString('base64') }));
const sheet = await ctx.newPage();
await sheet.setViewportSize({ width: 1720, height: 1000 });
await sheet.setContent(`<!doctype html><meta charset=utf8><style>
  body{margin:0;background:#15171c;font-family:system-ui,sans-serif;padding:26px}
  h1{color:#fff;font-size:22px;margin:0 0 4px} p{color:#9aa0ad;font-size:13px;margin:0 0 22px}
  .grid{display:grid;grid-template-columns:repeat(7,1fr);gap:16px}
  .card{background:#1e2128;border:1px solid #2c303a;border-radius:12px;padding:10px}
  .card img{width:100%;border-radius:7px;display:block}
  .d{color:#fff;font-size:13px;font-weight:700;margin:9px 2px 1px}
  .n{color:#9aa0ad;font-size:11px;margin:0 2px}
</style>
<h1>Daily themes — a different look every weekday</h1>
<p>Clock tab, clocked-in · 390×844 phone viewport</p>
<div class="grid">${shots.map(s=>`<div class="card"><img src="data:image/png;base64,${s.data}"><div class="d">${s.day}</div><div class="n">${s.name}</div></div>`).join('')}</div>`);
await sleep(400);
const h = await sheet.evaluate(() => document.body.scrollHeight);
await sheet.setViewportSize({ width: 1720, height: h + 20 });
await sleep(200);
await sheet.screenshot({ path: join(OUT, 'contact-sheet.png'), fullPage: true });
console.log('contact sheet done');
await browser.close();
console.log('ALL DONE');
