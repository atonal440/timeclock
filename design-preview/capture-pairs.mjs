import { chromium } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'shots-pairs');
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

const CONCEPTS = [
  { day:'Sunday',    id:'clay',   name:'Soft Clay' },
  { day:'Monday',    id:'indigo', name:'Indigo Pro' },
  { day:'Tuesday',   id:'aurora', name:'Aurora Glass' },
  { day:'Wednesday', id:'sunset', name:'Sunset Warmth' },
  { day:'Thursday',  id:'crt',    name:'CRT Terminal' },
  { day:'Friday',    id:'brutal', name:'Neo-Brutalist' },
  { day:'Saturday',  id:'lime',   name:'Lime Terminal' },
];
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, timezoneId:'America/New_York' });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil:'networkidle' });
await page.evaluate(SEED);

for (const c of CONCEPTS) {
  for (const scheme of ['light','dark']) {
    await page.goto(URL, { waitUntil:'networkidle' });
    await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), `${c.id}-${scheme}`);
    await page.locator('.nav-btn').nth(0).click();
    await sleep(400);
    await page.screenshot({ path: join(OUT, `${c.id}-${scheme}.png`) });
  }
  console.log('captured', c.day, c.name);
}

// Contact sheet: rows = concepts, columns = Light | Dark
const rows = CONCEPTS.map(c => ({
  ...c,
  light: fs.readFileSync(join(OUT, `${c.id}-light.png`)).toString('base64'),
  dark:  fs.readFileSync(join(OUT, `${c.id}-dark.png`)).toString('base64'),
}));
const sheet = await ctx.newPage();
await sheet.setViewportSize({ width: 980, height: 1200 });
await sheet.setContent(`<!doctype html><meta charset=utf8><style>
  body{margin:0;background:#15171c;font-family:system-ui,sans-serif;padding:28px}
  h1{color:#fff;font-size:22px;margin:0 0 4px}
  p{color:#9aa0ad;font-size:13px;margin:0 0 20px}
  table{border-collapse:separate;border-spacing:18px 22px}
  th{color:#cbd2e0;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:1px}
  .rowlabel{text-align:left;vertical-align:middle;width:150px}
  .rd{color:#fff;font-size:16px;font-weight:700}
  .rn{color:#9aa0ad;font-size:12px;margin-top:2px}
  img{width:300px;border-radius:10px;display:block;border:1px solid #2c303a}
</style>
<h1>Paired day themes — shared treatment, light + dark schemes</h1>
<p>Each weekday is one button/card treatment with a light and a dark palette · 390×844 · clocked-in state</p>
<table>
<tr><th></th><th>Light</th><th>Dark</th></tr>
${rows.map(r=>`<tr>
  <td class="rowlabel"><div class="rd">${r.day}</div><div class="rn">${r.name}</div></td>
  <td><img src="data:image/png;base64,${r.light}"></td>
  <td><img src="data:image/png;base64,${r.dark}"></td>
</tr>`).join('')}
</table>`);
await sleep(400);
const h = await sheet.evaluate(() => document.body.scrollHeight);
await sheet.setViewportSize({ width: 980, height: h + 20 });
await sleep(200);
await sheet.screenshot({ path: join(OUT, 'contact-sheet.png'), fullPage: true });
console.log('contact sheet done');
await browser.close();
console.log('ALL DONE');
