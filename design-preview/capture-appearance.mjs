import { chromium } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'shots-pairs');
const CHROME = join(process.env.HOME, '.cache/ms-playwright/chromium-1223/chrome-linux/chrome');
const URL = 'http://localhost:5173/';
const THEME = process.argv[2] || 'indigo-dark';        // e.g. brutal-dark
const [concept, scheme] = THEME.split(/-(?=dark$|light$)/);

const SEED = (concept, scheme) => {
  localStorage.setItem('tc-projects', JSON.stringify(['Acme:Website','Acme:Mobile','Pruning:ClientA']));
  localStorage.setItem('tc-entries', JSON.stringify([]));
  localStorage.setItem('tc-hidden-projects', '[]');
  localStorage.setItem('tc-concept', JSON.stringify(concept));
  localStorage.setItem('tc-scheme', JSON.stringify(scheme));
};
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, timezoneId:'America/New_York' });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil:'networkidle' });
await page.evaluate(({c,s}) => {
  localStorage.setItem('tc-projects', JSON.stringify(['Acme:Website','Acme:Mobile','Pruning:ClientA']));
  localStorage.setItem('tc-entries', JSON.stringify([]));
  localStorage.setItem('tc-hidden-projects', '[]');
  localStorage.setItem('tc-concept', JSON.stringify(c));
  localStorage.setItem('tc-scheme', JSON.stringify(s));
}, {c: concept, s: scheme});
await page.goto(URL, { waitUntil:'networkidle' });
await page.locator('.nav-btn').nth(2).click();
await sleep(400);
await page.screenshot({ path: join(OUT, `appearance-${THEME}.png`) });
console.log('done', THEME);
await browser.close();
