// Real-Chromium end-to-end check: 600 photos (30 blurred), blurriest first, undo, close and resume, both passes, save. Needs playwright, a local server on port 8767 serving the repo, and sharp.jpg and blur.jpg next to it. Not part of the quick suite.
const {chromium}=require('playwright'); const fs=require('fs');
let fails=0; const ok=(l,c,x)=>{ if(c) console.log('PASS',l); else {fails++; console.log('FAIL',l,x===undefined?'':JSON.stringify(x));} };
const N=600, URL='http://localhost:8767/index.html';
(async()=>{
const ud='/tmp/claude-0/pw/e2e/profile'; fs.rmSync(ud,{recursive:true,force:true});
const ctx=await chromium.launchPersistentContext(ud,{executablePath:'/opt/pw-browsers/chromium',viewport:{width:1200,height:800}});
await ctx.addInitScript(()=>{ window.showDirectoryPicker=async()=>{const r=await navigator.storage.getDirectory();return r.getDirectoryHandle('bugs');}; });
const errs=[]; const watch=p=>{p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});};
let p=await ctx.newPage(); watch(p); await p.goto(URL);
// seed: 30 blurred at random places
const blurIdx=new Set(); while(blurIdx.size<30) blurIdx.add(Math.floor(Math.random()*N));
const names=[...Array(N)].map((_,i)=>'IMG_'+String(i).padStart(4,'0')+'.jpg');
const blurSet=new Set([...blurIdx].map(i=>names[i]));
const sharpB=fs.readFileSync('sharp.jpg').toString('base64'), blurB=fs.readFileSync('blur.jpg').toString('base64');
await p.evaluate(async({sharpB,blurB,N,blurIdx})=>{
  const dec=b=>Uint8Array.from(atob(b),c=>c.charCodeAt(0)); const S=dec(sharpB), B=dec(blurB);
  const root=await navigator.storage.getDirectory(); try{await root.removeEntry('bugs',{recursive:true})}catch(e){}
  const d=await root.getDirectoryHandle('bugs',{create:true});
  for(let i=0;i<N;i++){const f=await d.getFileHandle('IMG_'+String(i).padStart(4,'0')+'.jpg',{create:true});const w=await f.createWritable();await w.write(new Blob([blurIdx.includes(i)?B:S,new Uint8Array(i%251)]));await w.close();}
},{sharpB,blurB,N,blurIdx:[...blurIdx]});
console.log('seeded',N,'photos,',blurSet.size,'blurred');
await p.click('#chooseFolderBtn'); await p.waitForSelector('#sort:not([hidden])');
const t0=Date.now();
const cnt=async()=>+(/^(\d+)/.exec(await p.textContent('#count'))[1]);
const stat=async()=>({k:+await p.textContent('#nKeep'),r:+await p.textContent('#nReject'),i:await cnt()-1});
const nameNow=()=>p.textContent('#fname').then(t=>t.split(' ·')[0].trim());
let kept=0,rejected=0,seenBlur=[],lastName=''; const decided=new Map();
async function step(){ // decide on the current photo by its name
  await p.waitForFunction(l=>{const im=document.getElementById('photo');const t=document.getElementById('fname').textContent.split(' ·')[0].trim();return im.complete&&im.naturalWidth>0&&t.length>0&&t!==l},lastName,{timeout:8000});
  const n=await nameNow(); lastName=n; const before=await cnt(); const isBlur=blurSet.has(n);
  await p.keyboard.press(isBlur?'a':'d');
  await p.waitForFunction(b=>+(/^(\d+)/.exec(document.getElementById('count').textContent)[1])!==b || document.getElementById('panel').hidden===false,before,{timeout:8000});
  decided.set(n,isBlur?'reject':'keep'); if(isBlur) seenBlur.push(decided.size);
  return n;
}
// phase A: 25 decisions, then wait for the background check, then 40 more
for(let i=0;i<25;i++) await step();
await p.waitForTimeout(Math.max(0,45000-(Date.now()-t0)));
const firstAfter=[]; for(let i=0;i<40;i++) firstAfter.push(await step());
const blurInNext40=firstAfter.filter(n=>blurSet.has(n)).length; const blurIn25=[...decided.keys()].slice(0,25).filter(n=>blurSet.has(n)).length;
// (blurriest first was replaced by grouping similar shots, so there is no ordering check here)
// undo test
let st=await stat(); for(let i=0;i<3;i++) await p.keyboard.press('s'); await p.waitForTimeout(150);
const st2=await stat(); ok('S undoes three, counts stay consistent', st2.i===st.i-3 && st2.k+st2.r===st2.i, {st,st2});
for(const n of [...decided.keys()].slice(-3)) decided.delete(n);
lastName=''; for(let i=0;i<3;i++) await step();
st=await stat(); ok('keep+reject equals photos done', st.k+st.r===st.i, st);
// close mid pass 1, then continue
await p.waitForTimeout(700); const doneBefore=st.i; await p.close();
p=await ctx.newPage(); watch(p); await p.goto(URL);
ok('Continue card is offered after closing the tab', await p.isVisible('#continueCard'));
await p.click('#continueBtn'); await p.waitForSelector('#panel:not([hidden])',{timeout:60000});
const resumeText=await p.textContent('#sheet'); ok('resume panel knows what was done', new RegExp('sorted '+doneBefore+' of these '+N).test(resumeText), resumeText.slice(0,100));
await p.click('text=/Resume at photo/'); await p.waitForTimeout(500); lastName='';
// finish pass 1
let guard=0; while(await p.isHidden('#panel') && guard++<N){ try{ await step(); }catch(e){ break; } }
await p.waitForSelector('#panel:not([hidden])',{timeout:10000});
const keptNow=[...decided.values()].filter(v=>v==='keep').length;
const pt=await p.textContent('#sheet'); console.log('after pass 1:',pt.slice(0,90).replace(/\s+/g,' '));
const expectKept=N-blurSet.size;
ok('pass 1 left only the sharp photos', new RegExp(expectKept+' of '+N+' photos are left').test(pt), pt.slice(0,120));
// pass 2: label
await p.fill('#round2Tags','Odd, Even'); await p.click('text=Start pass 2'); await p.waitForTimeout(300);
ok('pass 2 shows the survivors', (await p.textContent('#count'))===`1 of ${expectKept}`, await p.textContent('#count'));
const firstName=await nameNow(); ok('pass 2 is back in normal order', firstName==='IMG_0000.jpg'||!blurSet.has('IMG_0000.jpg')&&/IMG_000\d/.test(firstName), firstName);
let o=0,e=0,plain=0,drop=0,pk=0; guard=0;
while(await p.isHidden('#panel') && guard++<N){ const k=pk++; let key; if(k%50===49){key='ArrowLeft';drop++;} else if(k%3===0){key='1';o++;} else if(k%3===1){key='2';e++;} else {key='ArrowRight';plain++;} await p.keyboard.press(key); if(k%25===0) await p.waitForTimeout(10); }
await p.waitForSelector('#panel:not([hidden])',{timeout:10000}); await p.waitForTimeout(300);
ok('finish panel after the last photo', /All photos sorted/.test(await p.textContent('#sheet')), (await p.textContent('#sheet')).slice(0,80));
await p.click('text=Save sorted photos'); await p.waitForSelector('#sheet h2:has-text("Saved")',{timeout:120000}); await p.waitForTimeout(500);
const out=await p.evaluate(async()=>{const r=await navigator.storage.getDirectory(); const d=await r.getDirectoryHandle('bugs'); const o=await d.getDirectoryHandle('Bug check - sorted'); const res={}; for await(const [n,h] of o.entries()){ if(h.kind==='directory'){ const arr=[]; for await(const [fn] of h.entries()) arr.push(fn); res[n]=arr; } } return res;});
const all=Object.values(out).flat();
console.log('saved folders:',Object.fromEntries(Object.entries(out).map(([k,v])=>[k,v.length])),'expected Odd',o,'Even',e,'Keep',plain,'dropped',drop);
ok('Odd/Even/Keep counts match', (out.Odd||[]).length===o && (out.Even||[]).length===e && (out.Keep||[]).length===plain, {o,e,plain});
ok('no photo saved twice and none blurred', new Set(all).size===all.length && all.every(n=>!blurSet.has(n)), all.length);
ok('summary line', new RegExp(N+' photos in, '+(N-blurSet.size-drop)+' kept, '+(blurSet.size+drop)+' rejected').test(await p.textContent('#sheet')), (await p.textContent('#sheet')).slice(0,120));
ok('no page errors', errs.length===0, errs.slice(0,5));
console.log(fails?fails+' FAILED':'ALL PASSED'); await ctx.close(); process.exit(fails?1:0);
})().catch(e=>{console.error('SCRIPT ERROR',e.message);process.exit(2)});
