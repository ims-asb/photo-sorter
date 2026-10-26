// Real-Chromium check of video clips in the sorter. Needs playwright, a local server on port 8769 serving the repo, and test clips made with ffmpeg (clip1-3.webm, nopreview.mp4). Not part of the quick suite.
const {chromium}=require('playwright'); const fs=require('fs'); const crypto=require('crypto');
let fails=0; const ok=(l,c,x)=>{ if(c) console.log('PASS',l); else {fails++; console.log('FAIL',l,x===undefined?'':JSON.stringify(x));} };
const md5=b=>crypto.createHash('md5').update(b).digest('hex');
(async()=>{
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--autoplay-policy=no-user-gesture-required']});
const p=await b.newPage({viewport:{width:1200,height:800}}); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.addInitScript(()=>{ window.showDirectoryPicker=async()=>{const r=await navigator.storage.getDirectory(); try{await r.removeEntry('vout',{recursive:true})}catch(e){} return r.getDirectoryHandle('vout',{create:true});}; });
await p.goto('http://localhost:8769/index.html?passes=1');
const dir='/tmp/claude-0/pw/vid/'; const files=['clip1.webm','clip2.webm','clip3.webm','nopreview.mp4'];
await p.fill('#eventInput','Video test');
await p.setInputFiles('#fileInput',files.map(f=>dir+f));
await p.waitForSelector('#sort:not([hidden])');
await p.waitForFunction(()=>{const c=document.getElementById('clip');return !c.hidden&&c.readyState>=2});
const t1=await p.evaluate(()=>document.getElementById('clip').currentTime); await p.waitForTimeout(700);
const t2=await p.evaluate(()=>document.getElementById('clip').currentTime);
ok('the first clip is playing', t2>t1, {t1,t2});
const info=await p.textContent('#fname'); ok('name, size and length are shown', /clip1\.webm/.test(info)&&/MB/.test(info)&&/0:04/.test(info), info);
await p.keyboard.press(' '); await p.waitForTimeout(200); const paused=await p.evaluate(()=>document.getElementById('clip').paused);
ok('Space pauses', paused===true);
await p.keyboard.press(' '); await p.waitForTimeout(200); ok('Space plays again', (await p.evaluate(()=>document.getElementById('clip').paused))===false);
const muted0=await p.evaluate(()=>document.getElementById('clip').muted); await p.keyboard.press('m'); const muted1=await p.evaluate(()=>document.getElementById('clip').muted);
ok('M switches the sound', muted0===true&&muted1===false, {muted0,muted1});
await p.keyboard.press('ArrowRight');   // keep clip1
await p.waitForFunction(()=>/clip2/.test(document.getElementById('fname').textContent));
ok('the next clip loads and plays', await p.evaluate(()=>!document.getElementById('clip').hidden));
await p.keyboard.press('ArrowLeft');    // reject clip2
await p.waitForFunction(()=>/clip3/.test(document.getElementById('fname').textContent));
await p.keyboard.press('ArrowUp');      // keep + flag clip3
await p.waitForFunction(()=>/nopreview/.test(document.getElementById('fname').textContent));
await p.waitForTimeout(500);
const np=await p.textContent('#fname'); ok('an unplayable clip says so but can still be sorted', /can't be previewed|can't be opened/.test(np), np);
await p.keyboard.press('ArrowRight');   // keep nopreview.mp4
await p.waitForSelector('#sheet button.primary');
await p.click('text=/Save sorted clips/'); await p.waitForSelector('#sheet h2:has-text("Saved")',{timeout:30000});
const out=await p.evaluate(async()=>{const r=await navigator.storage.getDirectory(); const d=await r.getDirectoryHandle('vout'); const o=await d.getDirectoryHandle('Video test - sorted'); const res={}; const walk=async(h,pre)=>{for await(const [n,x] of h.entries()){ if(x.kind==='directory') await walk(x,pre+n+'/'); else res[pre+n]=Array.from(new Uint8Array(await (await x.getFile()).arrayBuffer())); }}; await walk(o,''); return res;});
console.log('saved:',Object.keys(out).join(', '));
ok('kept clips are copied byte for byte', ['Keep/clip1.webm','Keep/nopreview.mp4','Needs post processing/Keep/clip3.webm'].every(k=>out[k]&&md5(Buffer.from(out[k]))===md5(fs.readFileSync(dir+k.split('/').pop()))));
ok('the rejected clip is not saved', !Object.keys(out).some(k=>/clip2/.test(k)));
ok('no page errors', errs.length===0, errs);
console.log(fails?fails+' FAILED':'ALL PASSED'); await b.close(); process.exit(fails?1:0);
})();
