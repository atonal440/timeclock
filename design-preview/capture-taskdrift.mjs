import { chromium } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { PNG } from 'pngjs';
import gifenc from 'gifenc';
const { GIFEncoder, quantize, applyPalette } = gifenc;

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'shots-clay'); // scratch dir for explorations
fs.mkdirSync(OUT, { recursive: true });
const CHROME = join(process.env.HOME, '.cache/ms-playwright/chromium-1223/chrome-linux/chrome');
const URL = 'http://localhost:5173/';
const THEME = 'aurora-dark';
const PERIOD = 11, N = 22;

// Drift confined to the active task row (.project-btn.current), reusing the
// existing auroraShimmer keyframes + --shimmer vars.
const INJECT = `
[data-theme^="aurora-"] .project-btn.current { position:relative; overflow:hidden; background:rgba(255,255,255,0.06); }
[data-theme^="aurora-"] .project-btn.current::before {
  content:''; position:absolute; inset:-80%; z-index:-1; pointer-events:none;
  background:
    radial-gradient(40% 85% at 28% 42%, var(--shimmer-a), transparent 70%),
    radial-gradient(46% 90% at 74% 60%, var(--shimmer-b), transparent 70%);
  animation: auroraShimmer 11s ease-in-out infinite alternate;
}`;

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
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));

const browser = await chromium.launch({ executablePath: CHROME, args:['--no-sandbox'] });
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, timezoneId:'America/New_York', reducedMotion:'no-preference' });
const page = await ctx.newPage();
await page.goto(URL,{waitUntil:'networkidle'});
await page.evaluate(SEED);
await page.goto(URL,{waitUntil:'networkidle'});
await page.evaluate((t)=>document.documentElement.setAttribute('data-theme',t), THEME);
await page.locator('.nav-btn').nth(0).click();
await page.evaluate((css)=>{ const el=document.createElement('style'); el.id='__inject'; el.textContent=css; document.head.appendChild(el); }, INJECT);
await sleep(400);

// clip to the SWITCH TO label + the current row + the next row for context
const box = await page.locator('.project-btn.current').boundingBox();
const CLIP = { x:0, y: Math.max(0, box.y - 46), width:390, height: box.height + 110 };

const frames=[];
for (let i=0;i<N;i++){
  const t=(i/(N-1))*PERIOD;
  await page.evaluate((delay)=>{
    let el=document.getElementById('__freeze'); if(!el){el=document.createElement('style');el.id='__freeze';document.head.appendChild(el);}
    el.textContent = `.project-btn.current::before{animation-delay:-${delay}s !important;animation-play-state:paused !important;}`;
  }, t);
  await sleep(35);
  frames.push(PNG.sync.read(await page.screenshot({clip:CLIP})));
}
const {width,height}=frames[0];
const order=[...Array(N).keys()];
const ping=order.concat(order.slice(1,-1).reverse());
const gif=GIFEncoder();
ping.forEach((idx,i)=>{ const f=frames[idx]; const p=quantize(f.data,256,{format:'rgb565'}); const ix=applyPalette(f.data,p,'rgb565'); gif.writeFrame(ix,width,height,{palette:p,delay:70,repeat:i===0?0:undefined}); });
gif.finish();
const out=join(OUT, 'aurora-taskdrift.gif');
fs.writeFileSync(out, gif.bytes());
console.log('wrote', out, `${width}x${height}`, ping.length+'fr', Math.round(fs.statSync(out).size/1024)+'KB');
await browser.close();
