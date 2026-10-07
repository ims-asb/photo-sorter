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
  const btn = re => Array.from($('sheet').querySelectorAll('button')).find(b => re.test(b.textContent));
  await sleep(30);
  const files = ['a','b','c','d'].map((n, i) => new win.File(['d' + n], n + '.jpg', { lastModified: i + 1, type: 'image/jpeg' }));
  Object.defineProperty($('fileInput'), 'files', { value: files, configurable: true });
  $('fileInput').dispatchEvent(new win.Event('change'));
  await sleep(150);
  check('disabled with nothing sorted', $('undoAllBtn').disabled);
  key('ArrowRight'); key('ArrowLeft'); key('ArrowUp'); key('ArrowRight');
  await sleep(20);
  check('enabled after sorting', !$('undoAllBtn').disabled);
  $('undoAllBtn').click(); await sleep(10);
  check('asks first', /Undo all 3 choices/.test($('sheet').textContent));
  btn(/Cancel/).click(); await sleep(10);
  check('cancel keeps choices', $('count').textContent === '4 of 4' && $('nKeep').textContent === '2', $('count').textContent);
  $('undoAllBtn').click(); await sleep(10);
  btn(/^Undo all$/).click(); await sleep(300);
  check('back to photo 1', $('count').textContent === '1 of 4', $('count').textContent);
  check('counts cleared', $('nKeep').textContent === '0' && $('nReject').textContent === '0' && $('nEdit').textContent === '0');
  check('button disabled again', $('undoAllBtn').disabled);
  check('saved choices cleared', Object.keys(JSON.parse(win.localStorage.getItem('photosorter:v2:decisions') || '{}')).length === 0);
  console.log(failures ? failures + ' FAILED' : 'ALL PASSED');
  process.exit(failures ? 1 : 0);
})();
