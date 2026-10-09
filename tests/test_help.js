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
  check('start screen shows the three steps', doc.querySelectorAll('.steps li').length === 3);
  Object.defineProperty($('fileInput'), 'files', { value: ['a','b'].map((n, i) => new win.File(['x' + n], n + '.jpg', { lastModified: i + 1 })), configurable: true });
  $('fileInput').dispatchEvent(new win.Event('change'));
  await sleep(150);
  $('helpBtn').click();
  check('? button opens the key card', !$('panel').hidden && /Keys/.test($('sheet').textContent) && /Undo/.test($('sheet').textContent));
  const btn = Array.from($('sheet').querySelectorAll('button')).find(b => /Back to sorting/.test(b.textContent)); btn.click();
  check('closes back to sorting', $('panel').hidden);
  key('?'); check('? key opens it too', !$('panel').hidden);
  console.log(failures ? failures + ' FAILED' : 'ALL PASSED');
  process.exit(failures ? 1 : 0);
})();
