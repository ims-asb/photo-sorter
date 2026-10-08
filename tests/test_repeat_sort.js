const { JSDOM } = require('jsdom');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let failures = 0;
const check = (l, c, x) => { if (c) console.log('PASS', l); else { failures++; console.log('FAIL', l, x === undefined ? '' : x); } };
async function boot(){
  const dom = await JSDOM.fromFile(require('path').join(__dirname,'..','index.html'), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/',
    beforeParse(win){ win.URL.createObjectURL = () => 'blob:x'; win.URL.revokeObjectURL = () => {}; win.matchMedia = () => ({ matches: true }); }
  });
  await sleep(30);
  return dom.window;
}
(async () => {
  // ---- Space repeats the last choice
  let win = await boot(); let doc = win.document; let $ = id => doc.getElementById(id);
  const key = (k, extra) => doc.body.dispatchEvent(new win.KeyboardEvent('keydown', Object.assign({ key: k, bubbles: true }, extra || {})));
  const mk = (names, times) => names.map((n, i) => new win.File(['x' + n], n, { lastModified: times ? times[i] : i + 1, type: 'image/jpeg' }));
  $('tagsInput').value = 'Volleyball, Soccer';
  Object.defineProperty($('fileInput'), 'files', { value: mk(['a.jpg','b.jpg','c.jpg','d.jpg','e.jpg','f.jpg']), configurable: true });
  $('fileInput').dispatchEvent(new win.Event('change'));
  await sleep(150);
  key(' '); await sleep(5);
  check('Space with no history does nothing', $('count').textContent === '1 of 6');
  doc.body.dispatchEvent(new win.KeyboardEvent('keydown', { key: '@', code: 'Digit2', shiftKey: true, bubbles: true })); // a: Soccer + edit
  key(' '); key(' '); await sleep(10);                                   // b, c: same
  check('Space repeats tag and flag', $('count').textContent === '4 of 6' && $('nEdit').textContent === '3' && doc.querySelector('[data-code="t:Soccer"] .n').textContent === '3', $('count').textContent + ' ' + $('nEdit').textContent);
  key('ArrowLeft'); key(' '); await sleep(10);                           // d reject, e reject
  check('Space repeats a reject', $('nReject').textContent === '2' && $('count').textContent === '6 of 6', $('nReject').textContent);
  key('z', { ctrlKey: true }); await sleep(10);                          // undo e -> last is d (reject)
  key(' '); await sleep(10);
  check('after undo Space follows the photo before', $('nReject').textContent === '2');
  check('hint lists Space', /Space/.test($('hints').textContent));

  // ---- sort order
  win = await boot(); doc = win.document; $ = id => doc.getElementById(id);
  const files = [new win.File(['1'], 'b.jpg', { lastModified: 1 }), new win.File(['2'], 'a.jpg', { lastModified: 2 }), new win.File(['3'], 'c.jpg', { lastModified: 3 })];
  $('sortInput').value = 'name';
  Object.defineProperty($('fileInput'), 'files', { value: files, configurable: true });
  $('fileInput').dispatchEvent(new win.Event('change'));
  await sleep(150);
  check('sort by name starts with a.jpg', /a\.jpg/.test($('fname').textContent), $('fname').textContent);
  check('setting is remembered', JSON.parse(win.localStorage.getItem('photosorter:v1:settings')).sort === 'name');
  win = await boot(); doc = win.document; $ = id => doc.getElementById(id);
  const files2 = [new win.File(['1'], 'b.jpg', { lastModified: 1 }), new win.File(['2'], 'a.jpg', { lastModified: 2 })];
  Object.defineProperty($('fileInput'), 'files', { value: files2, configurable: true });
  $('fileInput').dispatchEvent(new win.Event('change'));
  await sleep(150);
  check('sort by time starts with the earliest (b.jpg)', /b\.jpg/.test($('fname').textContent), $('fname').textContent);
  console.log(failures ? failures + ' FAILED' : 'ALL PASSED');
  process.exit(failures ? 1 : 0);
})();
