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
      win.URL.createObjectURL = () => 'blob:x'; win.URL.revokeObjectURL = () => {}; win.matchMedia = () => ({ matches: true });
      const nf = () => new win.DOMException('nope','NotFoundError');
      win.fh = (n,t,c) => { const h={kind:'file',name:n,file:new win.File([c===undefined?n:c],n,{lastModified:t}),async getFile(){return h.file;},async createWritable(){return{async write(b){h.file=b;},async close(){}}}}; return h; };
      win.dh = (n) => { const kids=new Map(); const d={kind:'directory',name:n,kids,async*entries(){for(const e of kids)yield e;},
        async getFileHandle(x,o){ if(!kids.has(x)){ if(o&&o.create) kids.set(x,win.fh(x,Date.now(),'')); else throw nf(); } return kids.get(x);},
        async getDirectoryHandle(x,o){ if(!kids.has(x)){ if(o&&o.create) kids.set(x,win.dh(x)); else throw nf(); } return kids.get(x);} }; return d; };
    }
  });
  const win = dom.window, doc = win.document, $ = id => doc.getElementById(id);
  const btn = re => Array.from($('sheet').querySelectorAll('button')).find(b => re.test(b.textContent));
  const put = (dir, path, content) => { const parts = path.split('/'); let d = dir; for (const p of parts.slice(0, -1)){ if (!d.kids.has(p)) d.kids.set(p, win.dh(p)); d = d.kids.get(p); } d.kids.set(parts.pop(), win.fh('f', 1, content)); const name = path.split('/').pop(); d.kids.get(name).name = name; };
  const names = d => d ? Array.from(d.kids.keys()).sort().join(',') : '(none)';

  const A = win.dh('Soccer - sorted'), B = win.dh('Soccer - sorted');
  put(A, 'Keep/a.jpg', 'same-content'); put(A, 'Keep/only-a.jpg', 'aaaa'); put(A, 'Needs post processing/Keep/x.jpg', 'xx'); put(A, '.hidden', 'h');
  put(B, 'Keep/a.jpg', 'same-content'); put(B, 'Keep/b.jpg', 'bbbb'); put(B, 'Keep/clash.jpg', 'different-1'); put(A, 'Keep/clash.jpg', 'diff-2-longer'); put(B, 'Volleyball/v.jpg', 'vv');
  const dest = win.dh('Out');
  const queue = [A, B, dest];
  win.__picker = async () => queue.shift();
  await sleep(30);

  $('combineBtn').click(); await sleep(10);
  check('panel opens, combine disabled', /Combine sorted folders/.test($('sheet').textContent) && btn(/combine$/).disabled);
  btn(/Add a folder/).click(); await sleep(20);
  btn(/Add another folder/).click(); await sleep(20);
  check('two folders listed, combine enabled', doc.querySelectorAll('#sheet ul.folders li').length === 2 && !btn(/combine$/).disabled);
  $('combineName').value = 'Soccer day';
  btn(/combine$/).click(); await sleep(300);
  const out = dest.kids.get('Soccer day');
  check('combined folder created', !!out, names(dest));
  check('Keep has both people\'s photos, duplicate skipped, clash renamed', names(out && out.kids.get('Keep')) === 'a.jpg,b.jpg,clash (2).jpg,clash.jpg,only-a.jpg', names(out && out.kids.get('Keep')));
  check('subfolders merged', names(out && out.kids.get('Needs post processing').kids.get('Keep')) === 'x.jpg' && names(out && out.kids.get('Volleyball')) === 'v.jpg');
  check('hidden files skipped', !(out && out.kids.has('.hidden')));
  check('sources untouched', names(A.kids.get('Keep')) === 'a.jpg,clash.jpg,only-a.jpg' && names(B.kids.get('Keep')) === 'a.jpg,b.jpg,clash.jpg');
  check('done message', /Combined/.test($('sheet').textContent) && /already there/.test($('sheet').textContent), $('sheet').textContent);
  btn(/Close/).click(); await sleep(10);
  check('back to start', $('panel').hidden && !$('start').hidden);
  console.log(failures ? failures + ' FAILED' : 'ALL PASSED');
  process.exit(failures ? 1 : 0);
})();
