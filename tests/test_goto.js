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
  const files = Array.from({ length: 10 }, (_, i) => new win.File(['d' + i], 'p' + String(i).padStart(2, '0') + '.jpg', { lastModified: i + 1, type: 'image/jpeg' }));
  Object.defineProperty($('fileInput'), 'files', { value: files, configurable: true });
  $('fileInput').dispatchEvent(new win.Event('change'));
  await sleep(150);
  check('hints mention G', /Go to photo/.test($('hints').textContent));
  key('ArrowRight'); key('ArrowRight'); key('ArrowLeft');            // photos 1-3 sorted, now on 4
  key('g'); await sleep(10);
  check('G opens the box', /Go to a photo/.test($('sheet').textContent) && $('gotoInput').value === '4', $('sheet').textContent.slice(0, 80));
  $('gotoInput').value = '8';
  $('gotoInput').dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await sleep(20);
  check('Enter jumps to 8', $('count').textContent === '8 of 10' && $('panel').hidden, $('count').textContent);
  key('ArrowRight'); await sleep(10);
  check('keys work after a jump', $('count').textContent === '9 of 10' && $('nKeep').textContent === '3', $('count').textContent + ' keep ' + $('nKeep').textContent);
  $('gotoBtn').click(); await sleep(10);
  check('button shows first not sorted', !!btn(/First not sorted \(4\)/), $('sheet').textContent);
  btn(/First not sorted/).click(); await sleep(20);
  check('first not sorted goes to 4', $('count').textContent === '4 of 10', $('count').textContent);
  $('gotoBtn').click(); await sleep(10);
  $('gotoInput').value = '99';
  btn(/^Go$/).click(); await sleep(10);
  check('bad number stays open', !$('panel').hidden && /Go to a photo/.test($('sheet').textContent));
  $('gotoInput').value = '1';
  btn(/^Go$/).click(); await sleep(20);
  check('go to 1', $('count').textContent === '1 of 10' && $('undoBtn').disabled);
  $('gotoBtn').click(); await sleep(10);
  btn(/Cancel/).click(); await sleep(10);
  check('cancel closes', $('panel').hidden && $('count').textContent === '1 of 10');
  console.log(failures ? failures + ' FAILED' : 'ALL PASSED');
  process.exit(failures ? 1 : 0);
})();
