// Real-Chromium check of the sharpness hint. Needs playwright and a folder of test JPGs (two blurred ones named *_blur.jpg); paths inside are from the original run. Not part of the quick suite.
const {chromium}=require('playwright'); const fs=require('fs');
let fails=0; const ok=(l,c,x)=>{ if(c) console.log('PASS',l); else {fails++; console.log('FAIL',l,x===undefined?'':x);} };
(async()=>{
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const dir='/tmp/claude-0/pw/sharp/'; const files=fs.readdirSync(dir).filter(f=>f.endsWith('.jpg')).map(f=>dir+f);
// 1) badge in normal order
let p=await b.newPage({viewport:{width:1200,height:800}}); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///home/user/photo-sorter/index.html?passes=1');
await p.setInputFiles('#fileInput',files);
await p.waitForSelector('#sort:not([hidden])');
const badged=[];
for(let i=0;i<10;i++){
  await p.waitForFunction(()=>{const im=document.getElementById('photo');return im.complete&&im.naturalWidth>0});
  await p.waitForTimeout(250);
  badged.push(await p.isVisible('#softBadge')+'|'+await p.textContent('#fname'));
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(80);
}
console.log(badged.join('\n'));
const softNames=badged.filter(x=>x.startsWith('true')).map(x=>x.split('|')[1]);
ok('only the two blurred photos are tagged soft', softNames.length===2 && softNames.every(n=>/blur/.test(n)), softNames);
// 2) blurriest first
p=await b.newPage({viewport:{width:1200,height:800}});
await p.goto('file:///home/user/photo-sorter/index.html?passes=1');
await p.evaluate(()=>{document.querySelector('details.more').open=true});
await p.check('#softFirstInput');
const t=Date.now();
await p.setInputFiles('#fileInput',files);
await p.waitForSelector('#sort:not([hidden])',{timeout:60000});
console.log('sharpness check of 10 photos took',Date.now()-t,'ms');
await p.waitForFunction(()=>{const im=document.getElementById('photo');return im.complete&&im.naturalWidth>0});
const first=await p.textContent('#fname'); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(300); const second=await p.textContent('#fname');
ok('blurriest photos come first', /blur/.test(first)&&/blur/.test(second), [first,second]);
await p.screenshot({path:'/tmp/claude-0/pw/sharp/soft.png'});
ok('no errors', errs.length===0, errs);
console.log(fails?fails+' FAILED':'ALL PASSED'); await b.close(); process.exit(fails?1:0);
})();
