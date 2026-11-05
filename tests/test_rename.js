// R renames the photo that will be saved: the typed name plus the original ending, remembered locally
const { JSDOM } = require('jsdom');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let failures = 0;
const check = (l, c, x) => { if (c) console.log('PASS', l); else { failures++; console.log('FAIL', l, x === undefined ? '' : x); } };
(async () => {
  const dom = await JSDOM.fromFile(require('path').join(__dirname,'..','index.html'), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/?passes=1',
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
  Object.defineProperty($('fileInput'), 'files', { value: ['a','b','c'].map((n,i) => new win.File(['x'+n], n+'.jpg', { lastModified: i+1, type: 'image/jpeg' })), configurable: true });
  $('fileInput').dispatchEvent(new win.Event('change')); await sleep(150);
  key('r'); await sleep(10);
  check('R opens the rename box with the old name', !!$('renameInput') && $('renameInput').value === 'a', $('renameInput') && $('renameInput').value);
  $('renameInput').value = 'Smith, Jordan - volleyball';
  $('renameInput').dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await sleep(10);
  check('box closes and photo stays', $('panel').hidden && /a\.jpg/.test($('fname').textContent));
  check('new name is shown', !$('renamedTag').hidden && /Smith, Jordan - volleyball/.test($('renamedTag').textContent), $('renamedTag').textContent);
  key('ArrowRight'); await sleep(60);
  check('next photo has no new name', $('renamedTag').hidden);
  key('r'); await sleep(10);
  check('next rename starts from the last typed name', $('renameInput').value === 'Smith, Jordan - volleyball', $('renameInput').value);
  $('renameInput').value = 'Smith, Jordan - volleyball';   // same name on a second photo
  $('renameInput').dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await sleep(10);
  key('ArrowRight'); key('ArrowLeft'); await sleep(60);
  check('names are remembered on this computer', Object.keys(JSON.parse(win.localStorage.getItem('photosorter:v1:names'))).length === 2);
  btn(/Save sorted/).click(); await sleep(300);
  const out = [...dest.kids.values()].find(k => / - sorted$/.test(k.name));
  const names = d => d ? Array.from(d.kids.keys()).sort().join(',') : '(none)';
  check('saved with the new names, duplicates numbered', names(out.kids.get('Keep')) === 'Smith, Jordan - volleyball (2).jpg,Smith, Jordan - volleyball.jpg', names(out.kids.get('Keep')));
  check('help card lists R', Array.from(doc.querySelectorAll('#hints kbd')).some(k => k.textContent === 'R'));
  console.log(failures ? failures + ' FAILED' : 'ALL PASSED');
  process.exit(failures ? 1 : 0);
})();
