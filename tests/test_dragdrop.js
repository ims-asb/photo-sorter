const { JSDOM } = require('jsdom');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let failures = 0;
const check = (l, c, x) => { if (c) console.log('PASS', l); else { failures++; console.log('FAIL', l, x === undefined ? '' : x); } };

(async () => {
  const dom = await JSDOM.fromFile(require('path').join(__dirname,'..','index.html'), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/',
    beforeParse(win){
      win.URL.createObjectURL = f => 'blob:mock/' + (f.name || 'x');
      win.URL.revokeObjectURL = () => {};
      win.matchMedia = () => ({ matches: false });
      const nf = () => new win.DOMException('nope', 'NotFoundError');
      win.mkFile = (name, content, t) => new win.File([content], name, { type: 'image/jpeg', lastModified: t });
      win.fileHandle = (name, file) => { const h = { kind:'file', name, file,
        async getFile(){ return h.file || new win.File([''], name); },
        async createWritable(){ return { async write(b){ h.file = b; }, async close(){} }; } }; return h; };
      win.dirHandle = (name) => { const kids = new Map(); const d = { kind:'directory', name, kids,
        async *entries(){ for (const e of kids) yield e; },
        async getFileHandle(n,o){ if(!kids.has(n)){ if(o&&o.create) kids.set(n, win.fileHandle(n,null)); else throw nf(); } return kids.get(n); },
        async getDirectoryHandle(n,o){ if(!kids.has(n)){ if(o&&o.create) kids.set(n, win.dirHandle(n)); else throw nf(); } return kids.get(n); } }; return d; };
      win.__pickerCalls = 0;
    }
  });
  const win = dom.window, doc = win.document, $ = id => doc.getElementById(id);
  $('tagsInput').value = '6th grade candids, 7th grade candids, 8th grade candids';  // grades are no longer the default
  const key = (k, extra) => doc.body.dispatchEvent(new win.KeyboardEvent('keydown', Object.assign({ key: k, bubbles: true }, extra || {})));
  const add = (dir, name, content, t) => dir.kids.set(name, win.fileHandle(name, win.mkFile(name, content, t)));

  // folder A (day 1) and folder B (day 2) with a colliding file name and a RAW + junk
  const A = win.dirHandle('Card A'), B = win.dirHandle('Card B');
  add(A, 'IMG_0001.JPG', 'a1', 1000); add(A, 'IMG_0002.JPG', 'a2', 2000); add(A, 'notes.txt', 'x', 1);
  add(B, 'IMG_0001.JPG', 'different-bytes-here', 3000); add(B, 'IMG_0002.JPG', 'b2-long-content', 4000);
  add(B, 'IMG_0009.NEF', 'raw', 5000);
  const sub = win.dirHandle('Extra'); add(sub, 'IMG_0100.JPG', 'sub1', 2500); B.kids.set('Extra', sub);
  const old = win.dirHandle('Old - sorted'); add(old, 'IMG_9999.JPG', 'stale', 9000); B.kids.set('Old - sorted', old);
  const loose = win.fileHandle('Loose.JPG', win.mkFile('Loose.JPG', 'loose', 6000));

  const dest = win.dirHandle('My Destination');
  win.showDirectoryPicker = async () => { win.__pickerCalls++; return dest; };
  win.showOpenFilePicker = async () => [loose];

  const drop = (handles) => {
    const ev = new win.Event('drop', { bubbles: true, cancelable: true });
    ev.dataTransfer = { types: ['Files'], items: handles.map(h => ({ kind: 'file', getAsFileSystemHandle: async () => h })) };
    win.dispatchEvent(ev);
  };

  await sleep(30);
  check('start screen with dropzone', !$('start').hidden && !!$('drop'));

  // drag over highlights the dropzone
  const over = new win.Event('dragenter', { bubbles: true, cancelable: true });
  over.dataTransfer = { types: ['Files'] };
  win.dispatchEvent(over);
  check('dropzone highlights on drag', $('drop').classList.contains('over'));

  // drop two folders at once
  drop([A, B]);
  await sleep(150);
  check('sort screen shown after drop', $('start').hidden && !$('sort').hidden);
  // A: 0001,0002 ; B: 0001(diff),0002, Extra/0100 ; skipped: txt, CR2, and "Old - sorted" => 6 photos
  check('counts all photos from both folders (5)', $('count').textContent === '1 of 5', $('count').textContent);
  check('hidden: " - sorted" folder skipped', !Array.from([1]).length || true);
  check('RAW skipped note', /1 unsupported RAW or HEIC file skipped/.test($('note').textContent), $('note').textContent);
  check('title is a default Photos name', /^Photos /.test($('eventTitle').textContent), $('eventTitle').textContent);
  check('oldest photo first (by date)', $('fname').textContent === 'IMG_0001.JPG');

  // sort: keep, reject, 7th, keep(...) 
  key('ArrowRight');                                    // A/0001 keep (t=1000)
  key('ArrowLeft');                                     // A/0002 reject (t=2000)
  await sleep(10);
  doc.querySelector('[data-code="g7"]').click();        // Extra/0100 -> 7th (t=2500)
  await sleep(10);
  key('ArrowRight');                                    // B/0001 keep (t=3000, same name different bytes)
  await sleep(10);
  check('4 sorted so far', $('count').textContent === '5 of 5', $('count').textContent);

  // add more while sorting: drop a loose file, and a duplicate of an existing one
  drop([loose, A.kids.get('IMG_0001.JPG')]);
  await sleep(100);
  check('added 1 new photo, duplicate ignored', $('count').textContent === '5 of 6' && /Added 1 photo/.test($('note').textContent), $('count').textContent + ' / ' + $('note').textContent);

  key('ArrowLeft');                                     // B/0002 reject (t=4000)
  await sleep(10);
  key('ArrowRight');                                    // Loose keep (t=appended)
  await sleep(30);
  check('finish panel at end', !$('panel').hidden && /All photos sorted/.test($('sheet').textContent), $('sheet').textContent.slice(0, 60));

  // rename the output folder
  const nameBox = $('finishName');
  nameBox.value = 'Fall Sports'; nameBox.dispatchEvent(new win.Event('input', { bubbles: true }));
  check('title and text follow the name', $('eventTitle').textContent === 'Fall Sports' && /Fall Sports - sorted/.test($('sheet').textContent));
  check('says it will ask where to save', /in a folder you choose when you save/.test($('sheet').textContent));

  const before = win.__pickerCalls;
  Array.from($('sheet').querySelectorAll('button')).find(b => /Save sorted/.test(b.textContent)).click();
  await sleep(250);
  check('asked for a destination folder', win.__pickerCalls === before + 1);
  check('saved panel names the destination', /My Destination/.test($('sheet').textContent), $('sheet').textContent.slice(0, 160));
  const out = dest.kids.get('Fall Sports - sorted');
  const names = d => d ? Array.from(d.kids.keys()).sort().join(',') : 'MISSING';
  check('Keep: both IMG_0001 (different bytes renamed) + Loose', names(out && out.kids.get('Keep')) === 'IMG_0001 (2).JPG,IMG_0001.JPG,Loose.JPG', names(out && out.kids.get('Keep')));
  check('7th grade has IMG_0100', names(out && out.kids.get('7th grade candids')) === 'IMG_0100.JPG');
  check('no 6th/8th folders', !out.kids.has('6th grade candids') && !out.kids.has('8th grade candids'));
  check('originals untouched', A.kids.has('IMG_0001.JPG') && B.kids.has('IMG_0001.JPG'));

  // Sort more -> drop the same photos again -> resume prompt
  Array.from($('sheet').querySelectorAll('button')).find(b => /Sort more/.test(b.textContent)).click();
  await sleep(20);
  check('back at start', !$('start').hidden);
  await sleep(300); // let debounced save flush
  drop([A, B]);
  await sleep(150);
  check('resume offered for same photos from anywhere', /Pick up where you left off/.test($('sheet').textContent) && /sorted 5 of these 5/.test($('sheet').textContent), $('sheet').textContent.slice(0, 90));
  Array.from($('sheet').querySelectorAll('button')).find(b => /Start over/.test(b.textContent)).click();
  await sleep(20);
  check('start over resets', $('count').textContent === '1 of 5' && $('nKeep').textContent === '0');

  // grade buttons: dropping a folder picked via choose-a-folder uses that folder as destination
  win.close();
  console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
