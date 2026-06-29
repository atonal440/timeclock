import { chromium } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { PNG } from 'pngjs';
import gifenc from 'gifenc';
const { GIFEncoder, quantize, applyPalette } = gifenc;

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'shots-clay'); // scratch dir for explorations
const CHROME = join(process.env.HOME, '.cache/ms-playwright/chromium-1223/chrome-linux/chrome');
const URL = 'http://localhost:5173/';
const THEME = 'crt-dark';

const VARIANTS = [
  {
    id: 'scanline', sel: '.status-bar.active::after', period: 1.1, n: 20,
    css: `
      [data-theme^="crt-"] .status-bar.active { position:relative; overflow:hidden; }
      [data-theme^="crt-"] .status-bar.active::after {
        content:''; position:absolute; inset:0; z-index:2; pointer-events:none;
        background: repeating-linear-gradient(0deg, transparent 0 2px, rgba(120,255,170,0.11) 2px 4px);
        animation: crtRoll 1.1s linear infinite;
      }
      @keyframes crtRoll { from { transform: translateY(0); } to { transform: translateY(-4px); } }`,
  },
  {
    id: 'sweep', sel: '.status-bar.active::before', period: 3.6, n: 28,
    css: `
      [data-theme^="crt-"] .status-bar.active { position:relative; overflow:hidden; }
      [data-theme^="crt-"] .status-bar.active::before {
        content:''; position:absolute; top:0; bottom:0; left:0; width:42%; z-index:2; pointer-events:none;
        background: linear-gradient(90deg, transparent, rgba(140,255,185,0.16), transparent);
        animation: crtSweep 3.6s linear infinite;
      }
      @keyframes crtSweep { from { transform: translateX(-120%); } to { transform: translateX(330%); } }`,
  },
];

const SEED = () => {
  const projects = ['Acme:Website','Acme:Mobile','Pruning:ClientA','Personal:Admin','Garden:Maintenance'];
  const iso=(d)=>new Date(d).toISOString(); const now=Date.now(),H=3600e3,M=60e3,e=[];
  e.push({type:'i',datetime:iso(now-6*H),account:'Acme:Mobile'});
  e.push({type:'o',datetime:iso(now-4*H-20*M)});
  e.push({type:'i',datetime:iso(now-47*M),account:'Acme:Website'});
  localStorage.setItem('tc-entries', JSON.stringify(e));
  localStorage.setItem('tc-projects', JSON.stringify(projects));
  localStorage.setItem('tc-hidden-projects','[]');
  localStorage.setItem('tc-scheme', JSON.stringify('dark'));
};
const CLIP = { x:0, y:84, width:390, height:200 };
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));

const browser = await chromium.launch({ executablePath: CHROME, args:['--no-sandbox'] });
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, timezoneId:'America/New_York', reducedMotion:'no-preference' });
const page = await ctx.newPage();
await page.goto(URL,{waitUntil:'networkidle'});
await page.evaluate(SEED);

for (const v of VARIANTS) {
  await page.goto(URL,{waitUntil:'networkidle'});
  await page.evaluate((t)=>document.documentElement.setAttribute('data-theme',t), THEME);
  await page.locator('.nav-btn').nth(0).click();
  await page.evaluate((css)=>{ let el=document.getElementById('__inj'); if(!el){el=document.createElement('style');el.id='__inj';document.head.appendChild(el);} el.textContent=css; }, v.css);
  await sleep(350);

  const frames=[];
  for (let i=0;i<v.n;i++){
    const t=(i/v.n)*v.period; // continuous loop: 0..period (exclusive)
    await page.evaluate(({delay, sel})=>{
      let el=document.getElementById('__freeze'); if(!el){el=document.createElement('style');el.id='__freeze';document.head.appendChild(el);}
      el.textContent = `${sel}{animation-delay:-${delay}s !important;animation-play-state:paused !important;}`;
    }, {delay: t, sel: v.sel});
    await sleep(35);
    frames.push(PNG.sync.read(await page.screenshot({clip:CLIP})));
  }
  const {width,height}=frames[0];
  const gif=GIFEncoder();
  const delay=Math.round((v.period/v.n)*1000);
  frames.forEach((f,i)=>{ const p=quantize(f.data,256,{format:'rgb565'}); const ix=applyPalette(f.data,p,'rgb565'); gif.writeFrame(ix,width,height,{palette:p,delay,repeat:i===0?0:undefined}); });
  gif.finish();
  const out=join(OUT, `crt-${v.id}.gif`);
  fs.writeFileSync(out, gif.bytes());
  console.log('wrote', out, `${width}x${height}`, v.n+'fr', Math.round(fs.statSync(out).size/1024)+'KB');
}
await browser.close();
console.log('done');
