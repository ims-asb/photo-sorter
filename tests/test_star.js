// star a photo with F or the star button: it is remembered, shown, and also copied to a Starred folder
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
  check('file name is showing', /a\.jpg/.test($('fname').textContent), $('fname').textContent);
  check('star starts empty', $('starBtn').textContent === '☆' && !$('starBtn').classList.contains('on'));
  key('f'); await sleep(10);
  check('F stars it', $('starBtn').textContent === '★' && $('starBtn').classList.contains('on'));
  key('ArrowRight'); await sleep(60);          // a kept, now on b
  check('next photo is not starred', $('starBtn').textContent === '☆', $('starBtn').textContent);
  $('starBtn').click(); await sleep(10);       // star b with the button
  check('button stars it', $('starBtn').classList.contains('on'));
  $('starBtn').click(); await sleep(10);       // and unstar
  check('button unstars it', !$('starBtn').classList.contains('on'));
  key('ArrowRight'); await sleep(60);          // b kept
  key('f'); key('ArrowLeft'); await sleep(60); // c starred then rejected
  check('stars are remembered on this computer', Object.keys(JSON.parse(win.localStorage.getItem('photosorter:v1:stars'))).length === 2);
  btn(/Save sorted/).click(); await sleep(300);
  const out = [...dest.kids.values()].find(k => / - sorted$/.test(k.name));
  const names = d => d ? Array.from(d.kids.keys()).sort().join(',') : '(none)';
  check('Keep has a and b', names(out.kids.get('Keep')) === 'a.jpg,b.jpg', names(out.kids.get('Keep')));
  check('Starred has only the kept starred photo', names(out.kids.get('Starred')) === 'a.jpg', names(out.kids.get('Starred')));
  check('summary counts the star', /1 starred/.test($('sheet').textContent), $('sheet').textContent);
  check('help card lists F', Array.from(doc.querySelectorAll('#hints kbd')).some(k => k.textContent === 'F'));
  console.log(failures ? failures + ' FAILED' : 'ALL PASSED');
  process.exit(failures ? 1 : 0);
})();
