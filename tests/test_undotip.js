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
  const key = (k, o) => doc.body.dispatchEvent(new win.KeyboardEvent('keydown', Object.assign({ key: k, bubbles: true }, o)));
  await sleep(30);
  Object.defineProperty($('fileInput'), 'files', { value: ['a','b','c','d'].map((n, i) => new win.File(['x' + n], n + '.jpg', { lastModified: i + 1 })), configurable: true });
  $('fileInput').dispatchEvent(new win.Event('change'));
  await sleep(150);
  key('d'); key('d'); await sleep(10);
  $('undoBtn').click();
  check('clicking Undo shows the tip', /Ctrl\+Z or S/.test($('note').textContent), $('note').textContent);
  key('d'); key('z', { ctrlKey: true }); await sleep(10);
  $('note').textContent = '';
  $('undoBtn').click();
  check('no tip after the shortcut was used', $('note').textContent === '', $('note').textContent);
  console.log(failures ? failures + ' FAILED' : 'ALL PASSED');
  process.exit(failures ? 1 : 0);
})();
