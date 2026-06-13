import { chromium } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'shots-pairs');
const CHROME = join(process.env.HOME, '.cache/ms-playwright/chromium-1223/chrome-linux/chrome');
const URL = 'http://localhost:5173/';
const TARGETS = process.argv.slice(2); // e.g. indigo-dark indigo-light

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
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, timezoneId:'America/New_York' });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil:'networkidle' });
await page.evaluate(SEED);

for (const t of TARGETS) {
  await page.goto(URL, { waitUntil:'networkidle' });
  await page.evaluate((th) => document.documentElement.setAttribute('data-theme', th), t);
  await page.locator('.nav-btn').nth(0).click();
  await sleep(450);
  await page.screenshot({ path: join(OUT, `${t}.png`) });
  console.log('captured', t);
}
await browser.close();
console.log('done');
