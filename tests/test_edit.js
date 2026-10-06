// "Needs post processing" flag and the start-screen event question
const { JSDOM } = require('jsdom');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let failures = 0;
const check = (l, c, x) => { if (c) console.log('PASS', l); else { failures++; console.log('FAIL', l, x === undefined ? '' : x); } };
(async () => {
  const dom = await JSDOM.fromFile(require('path').join(__dirname,'..','photo-sorter.html'), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/',
    beforeParse(win){
      win.URL.createObjectURL = () => 'blob:x'; win.URL.revokeObjectURL = () => {};
      win.matchMedia = () => ({ matches: true });
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
  const jpg = (n, t) => new win.File(['jpgdata-' + n], n, { lastModified: t, type: 'image/jpeg' });

  const dest = win.dh('Out');
  win.__dest = dest;
  win.showDirectoryPicker = async () => dest;
  await sleep(30);

  $('eventInput').value = 'Spring Dance';
  const files = ['a','b','c','d','e'].map((n, i) => jpg(n + '.jpg', i + 1));
  Object.defineProperty($('fileInput'), 'files', { value: files, configurable: true });
  $('fileInput').dispatchEvent(new win.Event('change'));
  await sleep(150);
  check('typed event name is used', $('eventTitle').textContent === 'Spring Dance', $('eventTitle').textContent);

  // a: edit + keep, b: keep, c: edit + 7th, d: edit then reject (flag ignored), e: undo test
  key('ArrowUp'); check('flag turns on', $('editBtn').getAttribute('aria-pressed') === 'true');
  key('ArrowRight'); await sleep(10);
  check('flag resets after a decision', $('editBtn').getAttribute('aria-pressed') === 'false');
  key('ArrowRight'); await sleep(10);
  key('ArrowUp'); doc.querySelector('[data-code="g7"]').click(); await sleep(10);
  key('ArrowUp'); key('ArrowUp'); check('Up toggles off again', $('editBtn').getAttribute('aria-pressed') === 'false');
  key('ArrowUp'); key('ArrowLeft'); await sleep(10);
  check('edit count is 2', $('nEdit').textContent === '2', $('nEdit').textContent);
  check('keep count includes flagged', $('nKeep').textContent === '2', $('nKeep').textContent);
  check('7th count includes flagged', doc.querySelector('[data-code="g7"] .n').textContent === '1');

  // undo restores the flag on the photo being re-decided
  key('ArrowUp'); key('ArrowRight'); await sleep(10);
  check('last photo flagged keep', $('nEdit').textContent === '3');
  await sleep(20);
  check('finish opens', /All photos sorted/.test($('sheet').textContent));
  check('finish lists post processing', /Needs post processing/.test($('sheet').textContent));
  doc.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
  await sleep(10);
  check('undo brings the flag back', $('editBtn').getAttribute('aria-pressed') === 'true' && $('nEdit').textContent === '2');
  key('ArrowRight'); await sleep(20);

  btn(/Save sorted/).click();
  await sleep(300);
  const out = dest.kids.get('Spring Dance - sorted');
  check('folder named after event', !!out);
  const names = d => d ? Array.from(d.kids.keys()).sort().join(',') : '(none)';
  check('Keep has only b', names(out.kids.get('Keep')) === 'b.jpg', names(out.kids.get('Keep')));
  const pp = out.kids.get('Needs post processing');
  check('post processing folder exists', !!pp);
  check('flagged keeps in post processing/Keep', names(pp && pp.kids.get('Keep')) === 'a.jpg,e.jpg', names(pp && pp.kids.get('Keep')));
  check('flagged grade in post processing/7th', names(pp && pp.kids.get('7th grade candids')) === 'c.jpg');
  check('rejected never copied', ![out, pp].some(d => JSON.stringify([...d.kids.keys()]).includes('d.jpg')) && !Array.from(pp.kids.values()).some(k => k.kids.has('d.jpg')));
  check('no plain 7th folder when empty', !out.kids.has('7th grade candids'));

  console.log(failures ? failures + ' FAILED' : 'ALL PASSED');
  process.exit(failures ? 1 : 0);
})();
