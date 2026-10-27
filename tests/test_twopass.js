// Two passes by default: pass 1 quick cull, then pass 2 picks the best
const { JSDOM } = require('jsdom');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let failures = 0;
const check = (l, c, x) => { if (c) console.log('PASS', l); else { failures++; console.log('FAIL', l, x === undefined ? '' : x); } };
async function load(){
  const dom = await JSDOM.fromFile(require('path').join(__dirname,'..','index.html'), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/',
    beforeParse(win){
      win.URL.createObjectURL = () => 'blob:x'; win.URL.revokeObjectURL = () => {}; win.matchMedia = () => ({ matches: true });
      const nf = () => new win.DOMException('nope','NotFoundError');
      win.fh = (n,t,c) => { const h={kind:'file',name:n,file:new win.File([c||n],n,{lastModified:t}),async getFile(){return h.file;},async createWritable(){return{async write(b){h.file=b;},async close(){}}}}; return h; };
      win.dh = (n) => { const kids=new Map(); const d={kind:'directory',name:n,kids,async*entries(){for(const e of kids)yield e;},
        async getFileHandle(x,o){ if(!kids.has(x)){ if(o&&o.create) kids.set(x,win.fh(x,Date.now(),'')); else throw nf(); } return kids.get(x);},
        async getDirectoryHandle(x,o){ if(!kids.has(x)){ if(o&&o.create) kids.set(x,win.dh(x)); else throw nf(); } return kids.get(x);} }; return d; };
    }
  });
  const win = dom.window, doc = win.document, $ = id => doc.getElementById(id);
  const key = k => doc.body.dispatchEvent(new win.KeyboardEvent('keydown', { key: k, bubbles: true }));
  const btn = re => Array.from($('sheet').querySelectorAll('button')).find(b => re.test(b.textContent));
  const dest = win.dh('Out'); win.showDirectoryPicker = async () => dest;
  await sleep(30);
  const add = async names => {
    Object.defineProperty($('fileInput'), 'files', { value: names.map((n, i) => new win.File(['x' + n], n + '.jpg', { lastModified: i + 1, type: 'image/jpeg' })), configurable: true });
    $('fileInput').dispatchEvent(new win.Event('change')); await sleep(150);
  };
  return { win, doc, $, key, btn, dest, add };
}
(async () => {
  // default flow
  let { win, doc, $, key, btn, dest, add } = await load();
  check('two passes is on by default', $('twoPassInput').checked);
  $('eventInput').value = 'Games';
  await add(['a','b','c','d','e']);
  check('pass 1 note', /Pass 1 of 2/.test($('note').textContent), $('note').textContent);
  key('ArrowRight'); key('ArrowRight'); key('ArrowRight'); key('ArrowRight'); key('ArrowLeft'); await sleep(40);
  check('pass 1 ends with the pass 2 offer', /Pass 1 done/.test($('sheet').textContent) && /4 of 5 photos are left/.test($('sheet').textContent), $('sheet').textContent.slice(0, 120));
  check('pass 2 offer asks for categories', !!$('round2Tags'));
  btn(/Start pass 2/).click(); await sleep(20);
  check('pass 2 will not start without categories', /Pass 1 done/.test($('sheet').textContent));
  $('round2Tags').value = 'Soccer, Volleyball';
  btn(/Start pass 2/).click(); await sleep(20);
  check('pass 2 has only the 4 survivors', $('count').textContent === '1 of 4', $('count').textContent);
  check('pass 2 note says label', /Pass 2 of 2: label/.test($('note').textContent), $('note').textContent);
  check('pass 2 shows the category buttons', doc.querySelectorAll('#tagRow .grade').length === 2 && !$('grades').hidden);
  key('1'); key('ArrowRight'); key('2'); key('ArrowLeft'); await sleep(40);   // a Soccer, b plain keep, c Volleyball, d dropped
  check('finish after pass 2 (no third pass)', /All photos sorted/.test($('sheet').textContent) && !btn(/Next: sort/), $('sheet').textContent.slice(0, 100));
  btn(/Save sorted/).click(); await sleep(300);
  const out = dest.kids.get('Games - sorted');
  const names = d => d ? Array.from(d.kids.keys()).sort().join(',') : '(none)';
  check('Soccer has a', names(out && out.kids.get('Soccer')) === 'a.jpg', names(out && out.kids.get('Soccer')));
  check('Volleyball has c', names(out && out.kids.get('Volleyball')) === 'c.jpg');
  check('plain keep has b', names(out && out.kids.get('Keep')) === 'b.jpg');
  check('summary counts both passes', /5 photos in, 3 kept, 2 rejected/.test($('sheet').textContent), $('sheet').textContent);

  // skip pass 2
  ({ $, key, btn, dest, add } = await load());
  $('eventInput').value = 'Skip';
  await add(['a','b','c']);
  key('ArrowRight'); key('ArrowLeft'); key('ArrowRight'); await sleep(40);
  btn(/Skip pass 2 and save/).click(); await sleep(20);
  check('skipping goes to the normal finish panel', /All photos sorted/.test($('sheet').textContent) && !!btn(/Save sorted/));
  btn(/Save sorted/).click(); await sleep(300);
  const names2 = d => d ? Array.from(d.kids.keys()).sort().join(',') : '(none)';
  check('skip saved the 2 kept', names2(dest.kids.get('Skip - sorted') && dest.kids.get('Skip - sorted').kids.get('Keep')) === 'a.jpg,c.jpg');

  // categories typed means one pass; unchecking means one pass
  ({ $, key, btn, dest, add } = await load());
  $('tagsInput').value = 'Soccer, Volleyball';
  await add(['a','b']);
  key('ArrowRight'); key('ArrowRight'); await sleep(40);
  check('typed categories keep the one-pass flow', /All photos sorted/.test($('sheet').textContent) && !/Pass 1 done/.test($('sheet').textContent));
  ({ $, key, btn, dest, add } = await load());
  $('twoPassInput').checked = false;
  await add(['a','b']);
  key('ArrowRight'); key('ArrowRight'); await sleep(40);
  check('unchecked means one pass', /All photos sorted/.test($('sheet').textContent));

  // going back from the pass 1 panel
  ({ win, doc, $, key, btn, dest, add } = await load());
  await add(['a','b','c']);
  key('ArrowRight'); key('ArrowRight'); key('ArrowRight'); await sleep(40);
  check('pass 1 panel is up', /Pass 1 done/.test($('sheet').textContent));
  btn(/Go back one photo/).click(); await sleep(30);
  check('Go back one photo closes the panel and reopens the last photo', $('panel').hidden && $('count').textContent === '3 of 3' && $('nKeep').textContent === '2', $('count').textContent + ' keep ' + $('nKeep').textContent);
  key('ArrowRight'); await sleep(40);
  check('deciding again brings the panel back', /Pass 1 done/.test($('sheet').textContent));
  doc.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true })); await sleep(30);
  check('Ctrl+Z works on the pass 1 panel too', $('panel').hidden && $('count').textContent === '3 of 3', $('count').textContent);

  // everything rejected: no pass 2
  ({ $, key, btn, dest, add } = await load());
  await add(['a','b']);
  key('ArrowLeft'); key('ArrowLeft'); await sleep(40);
  check('all rejected skips pass 2', !/Pass 1 done/.test($('sheet').textContent));
  console.log(failures ? failures + ' FAILED' : 'ALL PASSED');
  process.exit(failures ? 1 : 0);
})();
