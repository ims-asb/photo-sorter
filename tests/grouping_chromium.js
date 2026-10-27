// Real-Chromium check of grouping similar shots. Needs playwright, a local server on port 8769 serving the repo, and photos made by grouping_make_photos.py in /tmp/claude-0/pw/grp. Not part of the quick suite.
const {chromium}=require('playwright'); const fs=require('fs');
let fails=0; const ok=(l,c,x)=>{ if(c) console.log('PASS',l); else {fails++; console.log('FAIL',l,x===undefined?'':JSON.stringify(x));} };
(async()=>{
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p=await b.newPage({viewport:{width:1200,height:800}}); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8769/index.html');
await p.evaluate(()=>{ localStorage.clear(); });
const dir='/tmp/claude-0/pw/grp/'; const files=fs.readdirSync(dir).filter(f=>f.endsWith('.jpg')).sort().map(f=>dir+f);
await p.setInputFiles('#fileInput',files);
await p.waitForSelector('#sort:not([hidden])');
const name=async()=>(await p.textContent('#fname')).split(' ·')[0].trim();
const waitName=async n=>p.waitForFunction(n=>document.getElementById('fname').textContent.startsWith(n),n,{timeout:8000});
await waitName('IMG_00_single');
await p.waitForTimeout(6000);                 // the background check finishes
await p.keyboard.press('ArrowRight');         // decide the first photo, then the groups are made
await p.waitForTimeout(600);
const seq=[]; const badges=[];
for(let i=0;i<4;i++){ seq.push(await name()); badges.push(await p.isVisible('#groupBadge')?await p.textContent('#groupBadge'):''); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(350); }
console.log(seq.join(' -> ')); console.log(badges.join(' | '));
ok('burst 1 comes together, sharpest first', seq.join()==='IMG_B1_3.jpg,IMG_B1_4.jpg,IMG_B1_1.jpg,IMG_B1_2.jpg', seq);
ok('badge shows the position and the sharpest', badges[0]==='Similar shots 1 of 4 (sharpest)' && badges[1]==='Similar shots 2 of 4', badges);
ok('the hint bar mentions B', /Keep this, reject its similar shots/.test(await p.textContent('#hints')));
const before={k:+await p.textContent('#nKeep'),r:+await p.textContent('#nReject'),n:await name()};
console.log('now at',before.n);
// next is the single, then burst 2
await p.keyboard.press('ArrowRight'); await p.waitForTimeout(350);
let n2=await name(); ok('burst 2 starts with its sharpest shot', n2==='IMG_B2_3.jpg', n2);
const b0={k:+await p.textContent('#nKeep'),r:+await p.textContent('#nReject')};
await p.keyboard.press('b'); await p.waitForTimeout(500);
const b1={k:+await p.textContent('#nKeep'),r:+await p.textContent('#nReject')}; const after=await name();
ok('B kept one and rejected the other three', b1.k===b0.k+1 && b1.r===b0.r+3, {b0,b1});
ok('B moved past the whole group', !/IMG_B2/.test(after), after);
await p.keyboard.press('s'); await p.waitForTimeout(300);
ok('undo steps back through the rejected shots', /IMG_B2/.test(await name()), await name());
ok('no page errors', errs.length===0, errs);
console.log(fails?fails+' FAILED':'ALL PASSED'); await b.close(); process.exit(fails?1:0);
})();
