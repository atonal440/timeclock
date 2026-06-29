import { chromium } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'shots-pairs');
const CHROME = join(process.env.HOME, '.cache/ms-playwright/chromium-1223/chrome-linux/chrome');
const URL = 'http://localhost:5173/';

const SEED = () => {
  localStorage.setItem('tc-projects', JSON.stringify(['Acme:Website','Acme:Mobile','Pruning:ClientA']));
  localStorage.setItem('tc-entries', JSON.stringify([]));
  localStorage.setItem('tc-hidden-projects', '[]');
  localStorage.setItem('tc-concept', JSON.stringify('indigo'));
  localStorage.setItem('tc-scheme', JSON.stringify('dark'));
};
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, timezoneId:'America/New_York' });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil:'networkidle' });
await page.evaluate(SEED);
await page.goto(URL, { waitUntil:'networkidle' });
await page.locator('.nav-btn').nth(2).click();   // Projects
await sleep(400);
await page.screenshot({ path: join(OUT, 'appearance-ui.png') });
console.log('done');
await browser.close();
