import { chromium } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { PNG } from 'pngjs';
import gifenc from 'gifenc';
const { GIFEncoder, quantize, applyPalette } = gifenc;

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'shots-pairs');
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

const THEME = process.argv[2] || 'indigo-dark';
const PERIOD = 2.6;       // matches the @keyframes duration
const N = 26;             // frames across one cycle
const CLIP = { x: 0, y: 0, width: 390, height: 300 };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
  timezoneId: 'America/New_York', reducedMotion: 'no-preference',
});
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(SEED);
await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), THEME);
await page.locator('.nav-btn').nth(0).click();
await sleep(400);

const frames = [];
for (let i = 0; i < N; i++) {
  const t = (i / N) * PERIOD;
  // Freeze the breathing animation at phase `t`.
  await page.evaluate((delay) => {
    const el = document.querySelector('.status-bar.active');
    el.style.animationPlayState = 'paused';
    el.style.animationDelay = `-${delay}s`;
  }, t);
  await sleep(40);
  const buf = await page.screenshot({ clip: CLIP });
  frames.push(PNG.sync.read(buf));
}
await browser.close();

const { width, height } = frames[0];
const gif = GIFEncoder();
const delay = Math.round((PERIOD / N) * 1000);
frames.forEach((f, i) => {
  const palette = quantize(f.data, 256, { format: 'rgb565' });
  const index = applyPalette(f.data, palette, 'rgb565');
  gif.writeFrame(index, width, height, { palette, delay, repeat: i === 0 ? 0 : undefined });
});
gif.finish();
const out = join(OUT, `${THEME}-pulse.gif`);
fs.writeFileSync(out, gif.bytes());
console.log('wrote', out, `${width}x${height}`, N, 'frames', Math.round(fs.statSync(out).size/1024)+'KB');
