import { chromium } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { PNG } from 'pngjs';
import gifenc from 'gifenc';
const { GIFEncoder, quantize, applyPalette } = gifenc;

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'shots-clay');
fs.mkdirSync(OUT, { recursive: true });
const CHROME = join(process.env.HOME, '.cache/ms-playwright/chromium-1223/chrome-linux/chrome');
const URL = 'http://localhost:5173/';
const THEME = process.argv[2] || 'clay-dark';

const NEU = 'inset 6px 6px 12px var(--neu-d), inset -6px -6px 12px var(--neu-l)';
const RING = 'inset 0 0 0 1.5px var(--inset-edge)';

const ANIMS = [
  { id: 'depth', name: 'Depth breathe', period: 3.2, css: `
    @keyframes clayA {
      0%,100% { box-shadow: ${NEU}, ${RING}; }
      50%     { box-shadow: inset 10px 10px 20px var(--neu-d), inset -10px -10px 20px var(--neu-l), ${RING}; }
    }
    .status-bar.active { animation: clayA 3.2s ease-in-out infinite !important; }` },
  { id: 'ring', name: 'Ring breathe', period: 2.8, css: `
    @keyframes clayA {
      0%,100% { box-shadow: ${NEU}, inset 0 0 0 1.5px var(--inset-edge); }
      50%     { box-shadow: ${NEU}, inset 0 0 0 2.8px var(--lime); }
    }
    .status-bar.active { animation: clayA 2.8s ease-in-out infinite !important; }` },
  { id: 'glow', name: 'Inner accent glow', period: 3.0, css: `
    @keyframes clayA {
      0%,100% { box-shadow: ${NEU}, ${RING}, inset 0 0 8px  var(--accent-glow); }
      50%     { box-shadow: ${NEU}, ${RING}, inset 0 0 26px var(--accent-glow); }
    }
    .status-bar.active { animation: clayA 3s ease-in-out infinite !important; }` },
];

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

const N = 26;
const CLIP = { x: 0, y: 84, width: 390, height: 200 };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, timezoneId:'America/New_York', reducedMotion:'no-preference' });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil:'networkidle' });
await page.evaluate(SEED);

for (const a of ANIMS) {
  await page.goto(URL, { waitUntil:'networkidle' });
  await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), THEME);
  await page.locator('.nav-btn').nth(0).click();
  await page.evaluate((css) => {
    let el = document.getElementById('__anim'); if (!el) { el = document.createElement('style'); el.id='__anim'; document.head.appendChild(el); }
    el.textContent = css;
  }, a.css);
  await sleep(300);

  const frames = [];
  for (let i = 0; i < N; i++) {
    const t = (i / N) * a.period;
    await page.evaluate((delay) => {
      const el = document.querySelector('.status-bar.active');
      el.style.animationPlayState = 'paused';
      el.style.animationDelay = `-${delay}s`;
    }, t);
    await sleep(35);
    frames.push(PNG.sync.read(await page.screenshot({ clip: CLIP })));
  }
  const { width, height } = frames[0];
  const gif = GIFEncoder();
  const delay = Math.round((a.period / N) * 1000);
  frames.forEach((f, i) => {
    const palette = quantize(f.data, 256, { format: 'rgb565' });
    const index = applyPalette(f.data, palette, 'rgb565');
    gif.writeFrame(index, width, height, { palette, delay, repeat: i === 0 ? 0 : undefined });
  });
  gif.finish();
  const out = join(OUT, `${THEME}-anim-${a.id}.gif`);
  fs.writeFileSync(out, gif.bytes());
  console.log('wrote', a.id, Math.round(fs.statSync(out).size/1024)+'KB');
}
await browser.close();
console.log('done');
