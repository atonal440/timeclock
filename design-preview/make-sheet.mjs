import { chromium } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIR = join(__dirname, 'shots-pairs');
const CHROME = join(process.env.HOME, '.cache/ms-playwright/chromium-1223/chrome-linux/chrome');

const CONCEPTS = [
  { day:'Sunday',    id:'clay',   name:'Soft Clay' },
  { day:'Monday',    id:'indigo', name:'Indigo Pro' },
  { day:'Tuesday',   id:'aurora', name:'Aurora Glass' },
  { day:'Wednesday', id:'sunset', name:'Sunset Warmth' },
  { day:'Thursday',  id:'crt',    name:'CRT Terminal' },
  { day:'Friday',    id:'brutal', name:'Neo-Brutalist' },
  { day:'Saturday',  id:'lime',   name:'Lime Terminal' },
];
const b64 = (f) => fs.readFileSync(join(DIR, f)).toString('base64');
const cols = CONCEPTS.map(c => ({ ...c, light: b64(`${c.id}-light.png`), dark: b64(`${c.id}-dark.png`) }));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setViewportSize({ width: 1180, height: 800 });
await page.setContent(`<!doctype html><meta charset=utf8><style>
  body{margin:0;background:#15171c;font-family:system-ui,sans-serif;padding:26px}
  h1{color:#fff;font-size:21px;margin:0 0 3px}
  p{color:#9aa0ad;font-size:12.5px;margin:0 0 18px}
  .grid{display:grid;grid-template-columns:46px repeat(7,1fr);gap:12px 12px;align-items:center}
  .col-h{text-align:center}
  .col-h .d{color:#fff;font-size:13px;font-weight:700}
  .col-h .n{color:#9aa0ad;font-size:10.5px;margin-top:1px}
  .rowlab{color:#cbd2e0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;
          writing-mode:vertical-rl;transform:rotate(180deg);justify-self:center}
  img{width:100%;border-radius:8px;display:block;border:1px solid #2c303a}
</style>
<h1>Timeclock — 14 paired day themes</h1>
<p>Columns = weekday treatment · Rows = Light / Dark color scheme · clocked-in state, phone size</p>
<div class="grid">
  <div></div>
  ${cols.map(c=>`<div class="col-h"><div class="d">${c.day.slice(0,3)}</div><div class="n">${c.name}</div></div>`).join('')}
  <div class="rowlab">Light</div>
  ${cols.map(c=>`<img src="data:image/png;base64,${c.light}">`).join('')}
  <div class="rowlab">Dark</div>
  ${cols.map(c=>`<img src="data:image/png;base64,${c.dark}">`).join('')}
</div>`);
await page.waitForTimeout(400);
const dims = await page.evaluate(() => ({ w: document.body.scrollWidth, h: document.body.scrollHeight }));
await page.setViewportSize({ width: dims.w + 8, height: dims.h + 8 });
await page.waitForTimeout(200);
const out = join(DIR, 'contact-sheet.png');
await page.screenshot({ path: out });
console.log('wrote', out, dims.w + 'x' + dims.h);
await browser.close();
