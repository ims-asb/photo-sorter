const { JSDOM } = require('jsdom');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let failures = 0;
const check = (l, c, x) => { if (c) console.log('PASS', l); else { failures++; console.log('FAIL', l, x === undefined ? '' : x); } };
(async () => {
  const dom = await JSDOM.fromFile(require('path').join(__dirname,'..','index.html'), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/',
    beforeParse(win){
      win.__picker = async () => { throw new Error('unset'); };
      win.showDirectoryPicker = (...a) => win.__picker(...a);
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
  const key = (k) => doc.body.dispatchEvent(new win.KeyboardEvent('keydown', { key: k, bubbles: true }));

  // folder mode: destination is the chosen folder, no second picker
  const root = win.dh('Assembly'); root.kids.set('a.jpg', win.fh('a.jpg', 1)); root.kids.set('b.jpg', win.fh('b.jpg', 2));
  let pickerCalls = 0;
  win.__picker = async () => { pickerCalls++; return root; };
  await sleep(30);
  $('tagsInput').value = '';
  $('chooseFolderBtn').click();
  await sleep(100);
  check('folder mode starts', !$('sort').hidden && $('eventTitle').textContent === 'Assembly');
  check('grades hidden when off', $('grades').hidden);
  (doc.querySelector('[data-code="g6"]') || {click(){}}).click();
  check('grade click ignored when off', $('count').textContent === '1 of 2');
  key('ArrowRight'); key('ArrowLeft');
  await sleep(30);
  check('finish panel says inside the folder', /inside “Assembly”/.test($('sheet').textContent), $('sheet').textContent.slice(0,200));
  const calls = pickerCalls;
  Array.from($('sheet').querySelectorAll('button')).find(b=>/Save sorted/.test(b.textContent)).click();
  await sleep(150);
  check('no second picker in folder mode', pickerCalls === calls);
  check('saved into the folder', root.kids.has('Assembly - sorted') && root.kids.get('Assembly - sorted').kids.get('Keep').kids.has('a.jpg'));
  Array.from($('sheet').querySelectorAll('button')).find(b=>/Sort more/.test(b.textContent)).click();
  await sleep(20);

  // choose photos via picker (no showOpenFilePicker -> falls back to the hidden input)
  let clicked = 0;
  $('fileInput').click = () => { clicked++; };
  $('choosePhotosBtn').click();
  await sleep(10);
  check('falls back to file input when no picker API', clicked === 1);
  const f1 = new win.File(['x1'], 'x1.jpg', { lastModified: 10 }), f2 = new win.File(['x2'], 'x2.jpg', { lastModified: 20 });
  Object.defineProperty($('fileInput'), 'files', { value: [f1, f2], configurable: true });
  $('fileInput').dispatchEvent(new win.Event('change'));
  await sleep(100);
  check('photos from input start sorting', !$('sort').hidden && $('count').textContent === '1 of 2', $('count').textContent);

  // reduced motion: no fly element
  key('ArrowRight'); await sleep(10);
  check('no fly element with reduced motion', doc.querySelectorAll('.fly').length === 0);
  win.close();
  console.log(failures ? 'FAILED' : 'ALL PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
