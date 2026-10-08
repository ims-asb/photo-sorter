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
    }
  });
  const win = dom.window, doc = win.document, $ = id => doc.getElementById(id);
  const key = k => doc.body.dispatchEvent(new win.KeyboardEvent('keydown', { key: k, bubbles: true }));
  const btn = re => Array.from($('sheet').querySelectorAll('button')).find(b => re.test(b.textContent));
  const dest = win.dh('Out'); win.showDirectoryPicker = async () => dest;
  await sleep(30);

  const H = 3600000, base = Date.UTC(2026, 9, 1, 15, 0, 0);
  // two events: three photos, then (2 hours later) two photos
  const times = [0, 5, 10, 130, 135].map(m => base + m * 60000);
  const names = ['v1.jpg','v2.jpg','v3.jpg','s1.jpg','s2.jpg'];
  $('tagsInput').value = '';
  $('eventInput').value = 'Sept 1';
  Object.defineProperty($('fileInput'), 'files', { value: names.map((n, i) => new win.File(['d' + n], n, { lastModified: times[i] })), configurable: true });
  $('fileInput').dispatchEvent(new win.Event('change'));
  await sleep(150);
  check('ribbon shows event 1 of 2', !$('evtRibbon').hidden && /Event 1 of 2/.test($('evtRibbon').textContent), $('evtRibbon').textContent);
  key('ArrowRight'); key('ArrowRight'); key('ArrowRight'); await sleep(10);
  check('new event is announced on its first photo', /New event starts here: Event 2 of 2/.test($('evtRibbon').textContent) && $('evtRibbon').classList.contains('new'), $('evtRibbon').textContent);
  key('ArrowRight'); key('ArrowLeft'); await sleep(30);     // s1 keep, s2 reject
  check('finish asks for event names', /2 separate events/.test($('sheet').textContent), $('sheet').textContent.slice(0, 200));
  $('evName0').value = 'Volleyball'; $('evName0').dispatchEvent(new win.Event('input'));
  $('evName1').value = 'Soccer'; $('evName1').dispatchEvent(new win.Event('input'));
  btn(/Save sorted/).click();
  await sleep(300);
  const names0 = d => d ? Array.from(d.kids.keys()).sort().join(',') : '(none)';
  check('Volleyball folder has its three photos', names0(dest.kids.get('Volleyball - sorted') && dest.kids.get('Volleyball - sorted').kids.get('Keep')) === 'v1.jpg,v2.jpg,v3.jpg');
  check('Soccer folder has its kept photo only', names0(dest.kids.get('Soccer - sorted') && dest.kids.get('Soccer - sorted').kids.get('Keep')) === 's1.jpg');
  check('done message lists both folders', /2 folders/.test($('sheet').textContent), $('sheet').textContent);
  btn(/Sort more/).click(); await sleep(20);

  // gap 0 turns events off
  $('gapInput').value = '0';
  Object.defineProperty($('fileInput'), 'files', { value: names.map((n, i) => new win.File(['e' + n], n, { lastModified: times[i] })), configurable: true });
  $('fileInput').dispatchEvent(new win.Event('change'));
  await sleep(150);
  check('gap 0 means a single event', $('evtRibbon').hidden);
  console.log(failures ? failures + ' FAILED' : 'ALL PASSED');
  process.exit(failures ? 1 : 0);
})();
