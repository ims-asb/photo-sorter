// WASD: D keep, A reject, W keep + needs post processing, S undo
const { JSDOM } = require('jsdom');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let failures = 0;
const check = (l, c, x) => { if (c) console.log('PASS', l); else { failures++; console.log('FAIL', l, x === undefined ? '' : x); } };
(async () => {
  const dom = await JSDOM.fromFile(require('path').join(__dirname,'..','index.html'), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/',
    beforeParse(win){ win.URL.createObjectURL = () => 'blob:x'; win.URL.revokeObjectURL = () => {}; win.matchMedia = () => ({ matches: true }); }
  });
  const win = dom.window, doc = win.document, $ = id => doc.getElementById(id);
  const key = k => doc.body.dispatchEvent(new win.KeyboardEvent('keydown', { key: k, bubbles: true }));
  await sleep(30);
  Object.defineProperty($('fileInput'), 'files', { value: ['a','b','c','d'].map((n, i) => new win.File(['x' + n], n + '.jpg', { lastModified: i + 1 })), configurable: true });
  $('fileInput').dispatchEvent(new win.Event('change'));
  await sleep(150);
  key('d'); await sleep(10);
  check('D keeps', $('nKeep').textContent === '1' && $('count').textContent === '2 of 4', $('nKeep').textContent);
  key('A'); await sleep(10);
  check('A rejects (capital too)', $('nReject').textContent === '1');
  key('w'); await sleep(10);
  check('W keeps and flags', $('nKeep').textContent === '2' && $('nEdit').textContent === '1');
  key('s'); await sleep(10);
  check('S undoes', $('nEdit').textContent === '0' && $('count').textContent === '3 of 4', $('count').textContent);
  check('hints mention WASD', /A/.test($('hints').textContent) && /W/.test($('hints').textContent) && /S/.test($('hints').textContent));
  console.log(failures ? failures + ' FAILED' : 'ALL PASSED');
  process.exit(failures ? 1 : 0);
})();
