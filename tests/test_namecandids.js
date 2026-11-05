// the Name the candids step: only photos filed under a "... candids" category, one at a time
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
  $('tagsInput').value = 'Soccer candids, Volleyball';
  Object.defineProperty($('fileInput'), 'files', { value: ['a','b','c','d'].map((n,i) => new win.File(['x'+n+i], n+'.jpg', { lastModified: i+1, type: 'image/jpeg' })), configurable: true });
  $('fileInput').dispatchEvent(new win.Event('change')); await sleep(150);
  key('1'); key('2'); key('1'); key('ArrowLeft'); await sleep(80);      // a candid, b Volleyball, c candid, d rejected
  check('finish panel offers naming the 2 candids', !!btn(/Name the candids \(2\)/), $('sheet').textContent.slice(0, 120));
  btn(/Name the candids/).click(); await sleep(20);
  check('first candid is on screen with the box under it', $('count').textContent === '1 of 4' && /1 of 2/.test($('sheet').textContent) && $('panel').classList.contains('dock'), $('count').textContent);
  const enter = () => $('nameCandidInput').dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  $('nameCandidInput').value = 'Lopez, Ana - soccer'; enter(); await sleep(20);
  check('Enter goes to the next candid (skipping the Volleyball photo)', $('count').textContent === '3 of 4' && /2 of 2/.test($('sheet').textContent), $('count').textContent);
  check('box starts with the last name', $('nameCandidInput').value === 'Lopez, Ana - soccer', $('nameCandidInput').value);
  $('nameCandidInput').value = 'Kim, Sam - soccer'; enter(); await sleep(20);
  check('back at the finish panel when done', /All photos sorted/.test($('sheet').textContent) && !$('panel').classList.contains('dock'), $('sheet').textContent.slice(0, 60));
  btn(/Save sorted/).click(); await sleep(300);
  const out = [...dest.kids.values()].find(k => / - sorted$/.test(k.name));
  const names = d => d ? Array.from(d.kids.keys()).sort().join(',') : '(none)';
  check('candids saved under the typed names', names(out.kids.get('Soccer candids')) === 'Kim, Sam - soccer.jpg,Lopez, Ana - soccer.jpg', names(out.kids.get('Soccer candids')));
  check('other photos keep their names', names(out.kids.get('Volleyball')) === 'b.jpg', names(out.kids.get('Volleyball')));
  console.log(failures ? failures + ' FAILED' : 'ALL PASSED');
  process.exit(failures ? 1 : 0);
})();
