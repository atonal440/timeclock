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
const PERIOD = 11;  // matches auroraShimmer duration (one direction)
const N = 22;       // frames over the forward half; ping-ponged for a smooth loop

const SEED = () => {
  const projects = ['Acme:Website','Acme:Mobile','Pruning:ClientA','Personal:Admin','Garden:Maintenance'];
  const iso = (d) => new Date(d).toISOString();
  const now = Date.now(); const H=3600e3,M=60e3; const e=[];
  e.push({type:'i',datetime:iso(now-6*H),account:'Acme:Mobile'});
  e.push({type:'o',datetime:iso(now-4*H-20*M)});
  e.push({type:'i',datetime:iso(now-47*M),account:'Acme:Website'});
  localStorage.setItem('tc-entries', JSON.stringify(e));
  localStorage.setItem('tc-projects', JSON.stringify(projects));
  localStorage.setItem('tc-hidden-projects','[]');
  localStorage.setItem('tc-concept', JSON.stringify('aurora'));
  localStorage.setItem('tc-scheme', JSON.stringify('dark'));
};
const CLIP = { x:0, y:84, width:390, height:200 };
const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));

const browser = await chromium.launch({ executablePath: CHROME, args:['--no-sandbox'] });
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, timezoneId:'America/New_York', reducedMotion:'no-preference' });
const page = await ctx.newPage();
await page.goto(URL,{waitUntil:'networkidle'});
await page.evaluate(SEED);

for (const theme of ['aurora-dark','aurora-light']) {
  await page.goto(URL,{waitUntil:'networkidle'});
  await page.evaluate((t)=>document.documentElement.setAttribute('data-theme',t), theme);
  await page.locator('.nav-btn').nth(0).click();
  await sleep(350);

  const frames=[];
  for (let i=0;i<N;i++){
    const t=(i/(N-1))*PERIOD;
    await page.evaluate((delay)=>{
      let el=document.getElementById('__freeze'); if(!el){el=document.createElement('style');el.id='__freeze';document.head.appendChild(el);}
      el.textContent = `[data-theme^="aurora-"] .status-bar.active::before{animation-delay:-${delay}s !important;animation-play-state:paused !important;}`;
    }, t);
    await sleep(35);
    frames.push(PNG.sync.read(await page.screenshot({clip:CLIP})));
  }
  const {width,height}=frames[0];
  const order=[...Array(N).keys()];
  const ping=order.concat(order.slice(1,-1).reverse()); // 0..N-1..1 smooth loop
  const gif=GIFEncoder();
  ping.forEach((idx,i)=>{
    const f=frames[idx];
    const palette=quantize(f.data,256,{format:'rgb565'});
    const index=applyPalette(f.data,palette,'rgb565');
    gif.writeFrame(index,width,height,{palette,delay:70,repeat:i===0?0:undefined});
  });
  gif.finish();
  const out=join(OUT, `${theme}-pulse.gif`);
  fs.writeFileSync(out, gif.bytes());
  console.log('wrote', out, `${width}x${height}`, ping.length+'fr', Math.round(fs.statSync(out).size/1024)+'KB');
}
await browser.close();
console.log('done');
