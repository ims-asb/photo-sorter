// Real-Chromium big-batch and remember-my-photos check. Needs playwright, a local server (python3 -m http.server 8765 in the repo root), and a base.jpg next to this file. Not part of the quick jsdom suite.
const {chromium}=require('playwright');
const fs=require('fs');
const N=+process.env.N||2000;
(async()=>{
const ud='./profile'; fs.rmSync(ud,{recursive:true,force:true});
const ctx=await chromium.launchPersistentContext(ud,{executablePath:'/opt/pw-browsers/chromium',viewport:{width:1280,height:800}});
await ctx.addInitScript(()=>{ window.showDirectoryPicker=async()=>{const r=await navigator.storage.getDirectory();return r.getDirectoryHandle('photos');}; });
let p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await p.goto('http://localhost:8765/index.html');
const b64=fs.readFileSync('base.jpg').toString('base64');
let t=Date.now();
await p.evaluate(async({b64,N})=>{
  const bin=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
  const root=await navigator.storage.getDirectory();
  try{await root.removeEntry('photos',{recursive:true})}catch(e){}
  const d=await root.getDirectoryHandle('photos',{create:true});
  for(let i=0;i<N;i++){const f=await d.getFileHandle('IMG_'+String(i).padStart(5,'0')+'.jpg',{create:true});const w=await f.createWritable();await w.write(new Blob([bin,new Uint8Array(i%97)]));await w.close();}
},{b64,N});
console.log('seeded',N,'in',Date.now()-t,'ms');
t=Date.now();
await p.click('#chooseFolderBtn');
await p.waitForSelector('#sort:not([hidden])');
await p.waitForFunction(()=>{const i=document.getElementById('photo');return i.complete&&i.naturalWidth>0});
console.log('to first photo',Date.now()-t,'ms; count',await p.textContent('#count'));
const lat=[];
for(let i=0;i<300;i++){
  const before=await p.evaluate(()=>document.getElementById('photo').src);
  const t0=Date.now();
  await p.keyboard.press(i%5===4?'a':'d');
  await p.waitForFunction(b=>{const i=document.getElementById('photo');return i.src!==b&&i.complete&&i.naturalWidth>0},before,{timeout:15000});
  lat.push(Date.now()-t0);
}
lat.sort((a,b)=>a-b);
console.log('key to next photo shown ms: median',lat[150],'p95',lat[285],'max',lat[299]);
console.log('count',await p.textContent('#count'),'heapMB',await p.evaluate(()=>performance.memory&&Math.round(performance.memory.usedJSHeapSize/1e6)));
// fast mashing
t=Date.now(); for(let i=0;i<100;i++) await p.keyboard.press('d'); await p.waitForTimeout(300);
console.log('100 rapid presses',Date.now()-t,'ms; count',await p.textContent('#count'));
await p.waitForTimeout(600);
await p.close();
// reopen tab
p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(500);
console.log('continue card visible:',await p.isVisible('#continueCard'), await p.textContent('#continueTitle'));
t=Date.now(); await p.click('#continueBtn');
await p.waitForSelector('#panel:not([hidden]) >> text=Pick up where you left off',{timeout:60000});
console.log('resume panel after',Date.now()-t,'ms:',(await p.textContent('#sheet')).replace(/\s+/g,' ').slice(0,120));
await p.click('text=/Resume at photo/'); await p.waitForTimeout(500);
console.log('resumed at',await p.textContent('#count'));
console.log('errors',errs);
await ctx.close();
})().catch(e=>{console.error('FAILED',e.message);process.exit(1)});
