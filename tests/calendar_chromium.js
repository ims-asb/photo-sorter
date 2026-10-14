// Real-Chromium check of calendar.html (needs playwright). Not part of the quick jsdom suite.
const {chromium}=require('playwright');
const fs=require('fs');
let fails=0; const ok=(l,c,x)=>{ if(c) console.log('PASS',l); else {fails++; console.log('FAIL',l,x===undefined?'':x);} };
(async()=>{
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const ctx=await b.newContext({viewport:{width:1200,height:850},acceptDownloads:true,colorScheme:'dark'});
const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
const reqs=[]; p.on('request',r=>{ if(!r.url().startsWith('file:')&&!r.url().startsWith('data:')) reqs.push(r.url()); });
await p.goto('file:///home/user/photo-sorter/calendar.html');
ok('opens on current month', /October 2026/.test(await p.textContent('#title')), await p.textContent('#title'));
await p.screenshot({path:'cal1.png'});
const t=await p.$$eval('.day:not(.other) .ev',e=>e.map(x=>x.textContent));
ok('Oct 2026 has games', t.length>=10, t.length);
ok('Oct 13 shows IMS games (vs/@)', (await p.$$eval('.day[aria-label^="Tuesday, October 13"] .ev',e=>e.map(x=>x.textContent))).join('|')==='Soccer vs Maywood|Volleyball vs Maywood', await p.$$eval('.day[aria-label^="Tuesday, October 13"] .ev',e=>e.map(x=>x.textContent)));
ok('Oct 15 XC away at Beaver Lake', (await p.$$eval('.day[aria-label^="Thursday, October 15"] .ev',e=>e.map(x=>x.textContent))).includes('XC @ Beaver Lake'));
await p.click('.day[aria-label^="Tuesday, October 13"]');
ok('day dialog opens with detail', /Home game/.test(await p.textContent('#dlgBody')) && /Start 3:15/.test(await p.textContent('#dlgBody')));
await p.screenshot({path:'cal2.png'});
await p.click('text=Close');
await p.selectOption('#where','home');
const homeOnly=await p.$$eval('.day:not(.other) .ev',e=>e.map(x=>x.textContent));
ok('home only has no @', homeOnly.every(x=>!/ @ /.test(x)||/season/.test(x)), homeOnly);
await p.selectOption('#where','');
await p.selectOption('#scope','all');
ok('all-games mode shows 3 games', (await p.$$eval('.day:not(.other) .ev',e=>e.map(x=>x.textContent))).some(x=>/3 games/.test(x)));
await p.click('.day[aria-label^="Tuesday, October 13"]');
ok('all mode lists 3 matchups', (await p.$$('#dlgBody .games li')).length===6, (await p.$$('#dlgBody .games li')).length);
await p.click('text=Close');
await p.selectOption('#scope','us');
await p.click('#chips button:has-text("Volleyball")');
ok('volleyball hidden', !(await p.$$eval('.ev',e=>e.map(x=>x.textContent))).some(x=>/Volleyball/.test(x)));
await p.click('#chips button:has-text("Volleyball")');
await p.click('#vList');
ok('list view shows rows', (await p.$$('.row')).length>5);
await p.screenshot({path:'cal3.png'});
await p.click('#vMonth');
// next months
for(const m of ['November 2026','December 2026','January 2027']){ await p.click('#next'); ok('month '+m, (await p.textContent('#title'))===m); }
for(let i=0;i<4;i++) await p.click('#next');
ok('last month May 2027 and next disabled', (await p.textContent('#title'))==='May 2027' && await p.isDisabled('#next'), await p.textContent('#title'));
ok('track on May 27', (await p.$$eval('.day[aria-label^="Thursday, May 27"] .ev',e=>e.map(x=>x.textContent))).join()==='Track vs Pac Cascade', await p.$$eval('.day[aria-label^="Thursday, May 27"] .ev',e=>e.map(x=>x.textContent)));
// add event
await p.click('#today');
await p.click('#addBtn');
await p.fill('#evTitle','Spirit Week kickoff'); await p.fill('#evDate','2026-10-26'); await p.click('dialog >> text=Save');
await p.waitForTimeout(100);
ok('custom event shows', (await p.$$eval('.ev',e=>e.map(x=>x.textContent))).includes('Spirit Week kickoff'));
// ics
const [dl]=await Promise.all([p.waitForEvent('download'),p.click('#icsBtn')]);
const f=await dl.path(); const ics=fs.readFileSync(f,'utf8');
ok('ics has events and CRLF', /BEGIN:VCALENDAR/.test(ics)&&/\r\n/.test(ics)&&(ics.match(/BEGIN:VEVENT/g)||[]).length>40, (ics.match(/BEGIN:VEVENT/g)||[]).length);
ok('ics includes custom + a volleyball game', /Spirit Week kickoff/.test(ics)&&/SUMMARY:Volleyball vs Maywood/.test(ics));
// persistence
await p.reload();
ok('custom event persists after reload', (await p.$$eval('.ev',e=>e.map(x=>x.textContent))).includes('Spirit Week kickoff'));
await p.screenshot({path:'cal4.png'});
// mobile
await p.setViewportSize({width:390,height:800}); await p.screenshot({path:'cal5.png'});
ok('no horizontal scroll on phone', await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1), await p.evaluate(()=>document.documentElement.scrollWidth));
// light mode
const c2=await b.newContext({viewport:{width:1200,height:850},colorScheme:'light'}); const p2=await c2.newPage(); await p2.goto('file:///home/user/photo-sorter/calendar.html'); await p2.screenshot({path:'cal6.png'});
ok('no network requests', reqs.length===0, reqs);
ok('no errors', errs.length===0, errs);
console.log(fails?fails+' FAILED':'ALL PASSED'); await b.close(); process.exit(fails?1:0);
})();
