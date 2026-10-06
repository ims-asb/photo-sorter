// custom tag buttons (sports) with number keys, edit flag and saving
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
  const dest = win.dh('Out');
  win.showDirectoryPicker = async () => dest;
  await sleep(30);

  check('default is the three grades', $('tagsInput').value.includes('6th grade candids'));
  doc.querySelector('[data-preset="sports"]').click();
  check('sports preset fills the field', /Volleyball, Soccer/.test($('tagsInput').value));
  $('tagsInput').value = 'Volleyball, Soccer, cross country, soccer, Track+Field';
  $('eventInput').value = 'Sept 1';
  const files = ['a','b','c','d','e'].map((n, i) => new win.File(['d' + n], n + '.jpg', { lastModified: i + 1, type: 'image/jpeg' }));
  Object.defineProperty($('fileInput'), 'files', { value: files, configurable: true });
  $('fileInput').dispatchEvent(new win.Event('change'));
  await sleep(150);
  const btns = Array.from(doc.querySelectorAll('#tagRow .grade'));
  check('4 buttons, duplicate dropped, + removed', btns.length === 4 && /Track Field/.test(btns[3].textContent), btns.map(b => b.textContent).join('|'));

  key('1');                                  // a: Volleyball
  key('2');                                  // b: Soccer
  key('ArrowUp'); key('2');                  // c: Soccer + edit
  key('3');                                  // d: cross country
  key('ArrowLeft');                          // e: reject
  await sleep(40);
  check('counts shown', btns[0].querySelector('.n').textContent === '1' && btns[1].querySelector('.n').textContent === '2');
  check('finish lists the tags', /Volleyball/.test($('sheet').textContent) && /cross country/.test($('sheet').textContent));
  Array.from($('sheet').querySelectorAll('button')).find(b => /Save sorted/.test(b.textContent)).click();
  await sleep(300);
  const out = dest.kids.get('Sept 1 - sorted');
  const names = d => d ? Array.from(d.kids.keys()).sort().join(',') : '(none)';
  check('Volleyball folder', names(out.kids.get('Volleyball')) === 'a.jpg');
  check('Soccer folder', names(out.kids.get('Soccer')) === 'b.jpg', names(out.kids.get('Soccer')));
  check('cross country folder', names(out.kids.get('cross country')) === 'd.jpg');
  check('edit + soccer', names(out.kids.get('Needs post processing').kids.get('Soccer')) === 'c.jpg');
  check('no Keep folder when unused', !out.kids.has('Keep'));
  console.log(failures ? failures + ' FAILED' : 'ALL PASSED');
  process.exit(failures ? 1 : 0);
})();
