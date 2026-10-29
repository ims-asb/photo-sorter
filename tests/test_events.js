// no event pick list any more, and the summary shown after saving
const { JSDOM } = require('jsdom');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let failures = 0;
const check = (l, c, x) => { if (c) console.log('PASS', l); else { failures++; console.log('FAIL', l, x === undefined ? '' : x); } };
(async () => {
  const dom = await JSDOM.fromFile(require('path').join(__dirname,'..','index.html'), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/?passes=1',
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
  await sleep(30);
  check('no event box on the start screen', !$('eventInput') && !$('eventsList') && !$('eventOptions'));

  const dest = win.dh('Out'); win.showDirectoryPicker = async () => dest;
  Object.defineProperty($('fileInput'), 'files', { value: ['a','b','c'].map((n,i) => new win.File(['x'+n], n+'.jpg', { lastModified: i+1, type: 'image/jpeg' })), configurable: true });
  $('fileInput').dispatchEvent(new win.Event('change'));
  await sleep(150);
  key('ArrowRight'); await sleep(10); key('ArrowUp'); await sleep(10); key('ArrowLeft'); await sleep(30);
  check('finish name box is there and filled in', $('finishName') && /^Photos /.test($('finishName').value), $('finishName') && $('finishName').value);
  btn(/Save sorted/).click(); await sleep(300);
  const t = $('sheet').textContent;
  check('summary shows counts', /3 photos in, 2 kept, 1 rejected, 1 need post processing/.test(t), t);
  check('summary shows minutes', /About 1 minute/.test(t), t);
  console.log(failures ? failures + ' FAILED' : 'ALL PASSED');
  process.exit(failures ? 1 : 0);
})();
