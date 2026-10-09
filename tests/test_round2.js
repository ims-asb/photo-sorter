// round 1 (keep or reject) then round 2 (sort the kept photos into categories), saved once
const { JSDOM } = require('jsdom');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let failures = 0;
const check = (l, c, x) => { if (c) console.log('PASS', l); else { failures++; console.log('FAIL', l, x === undefined ? '' : x); } };
(async () => {
  const dom = await JSDOM.fromFile(require('path').join(__dirname,'..','index.html'), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/',
    beforeParse(win){
      win.URL.createObjectURL = () => 'blob:x'; win.URL.revokeObjectURL = () => {}; win.matchMedia = () => ({ matches: true });
      const nf = () => new win.DOMException('nope','NotFoundError');
      win.fh = (n,t,c) => { const h={kind:'file',name:n,file:new win.File([c||n],n,{lastModified:t}),async getFile(){return h.file;},async createWritable(){return{async write(b){h.file=b;},async close(){}}}}; return h; };
      win.dh = (n) => { const kids=new Map(); const d={kind:'directory',name:n,kids,async*entries(){for(const e of kids)yield e;},
        async getFileHandle(x,o){ if(!kids.has(x)){ if(o&&o.create) kids.set(x,win.fh(x,Date.now(),'')); else throw nf(); } return kids.get(x);},
        async getDirectoryHandle(x,o){ if(!kids.has(x)){ if(o&&o.create) kids.set(x,win.dh(x)); else throw nf(); } return kids.get(x);} }; return d; };
      win.__picker = async () => { throw new Error('unset'); };
      win.showDirectoryPicker = (...a) => win.__picker(...a);
    }
  });
  const win = dom.window, doc = win.document, $ = id => doc.getElementById(id);
  const key = k => doc.body.dispatchEvent(new win.KeyboardEvent('keydown', { key: k, bubbles: true }));
  const btn = re => Array.from($('sheet').querySelectorAll('button')).find(b => re.test(b.textContent));
  const dest = win.dh('Out'); win.__picker = async () => dest;
  await sleep(30);

  $('eventInput').value = 'Games';
  const files = ['a','b','c','d','e'].map((n, i) => new win.File(['d' + n], n + '.jpg', { lastModified: i + 1, type: 'image/jpeg' }));
  Object.defineProperty($('fileInput'), 'files', { value: files, configurable: true });
  $('fileInput').dispatchEvent(new win.Event('change'));
  await sleep(150);
  check('round 1 has no category buttons', $('grades').hidden);
  key('ArrowRight');   // a keep
  key('ArrowUp');      // b keep + flag
  key('ArrowLeft');    // c reject
  key('ArrowRight');   // d keep
  key('ArrowLeft');    // e reject
  await sleep(30);
  check('finish offers round 2', !!btn(/Next: sort the kept photos into categories/));
  const saved1 = win.localStorage.getItem('photosorter:v2:decisions');
  btn(/Next: sort/).click(); await sleep(10);
  check('asks for categories', /Sort into categories/.test($('sheet').textContent));
  btn(/^Start$/).click(); await sleep(10);
  check('empty categories do not start', /Sort into categories/.test($('sheet').textContent));
  $('round2Tags').value = 'Soccer, Volleyball';
  btn(/^Start$/).click(); await sleep(60);
  check('round 2 shows only the 3 kept photos', $('count').textContent === '1 of 3', $('count').textContent);
  check('round 2 note', /Round 2/.test($('note').textContent), $('note').textContent);
  check('category buttons appear', doc.querySelectorAll('#tagRow .grade').length === 2 && !$('grades').hidden);
  key('1');            // a -> Soccer
  key('2');            // b (flagged in round 1) -> Volleyball + flag
  key('ArrowRight');   // d -> plain keep
  await sleep(30);
  check('finish after round 2 has no second round button', !btn(/Next: sort/), $('sheet').textContent.slice(0, 150));
  check('round 1 choices untouched in the browser', win.localStorage.getItem('photosorter:v2:decisions') === saved1);
  btn(/Save sorted/).click(); await sleep(300);
  const out = dest.kids.get('Games - sorted');
  const names = d => d ? Array.from(d.kids.keys()).sort().join(',') : '(none)';
  check('Soccer has a', names(out && out.kids.get('Soccer')) === 'a.jpg', names(out && out.kids.get('Soccer')));
  check('flag carried into round 2: Needs post processing/Volleyball has b', names(out && out.kids.get('Needs post processing') && out.kids.get('Needs post processing').kids.get('Volleyball')) === 'b.jpg');
  check('plain keep has d', names(out && out.kids.get('Keep')) === 'd.jpg', names(out && out.kids.get('Keep')));
  check('nothing saved twice or rejected', names(out) === 'Keep,Needs post processing,Soccer', names(out));
  btn(/Sort more/).click(); await sleep(20);
  check('back to start, round 1 saved choices restored', !$('start').hidden && win.localStorage.getItem('photosorter:v2:decisions') === saved1);
  console.log(failures ? failures + ' FAILED' : 'ALL PASSED');
  process.exit(failures ? 1 : 0);
})();
