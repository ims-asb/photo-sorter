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
  Object.defineProperty($('fileInput'), 'files', { value: ['a','b','c'].map((n, i) => new win.File(['x' + n], n + '.jpg', { lastModified: i + 1 })), configurable: true });
  $('fileInput').dispatchEvent(new win.Event('change'));
  await sleep(150);
  // jsdom does not load images, so tell it the photo has a size
  Object.defineProperty($('photo'), 'naturalWidth', { value: 4000, configurable: true });
  const tf = () => $('photo').style.transform;
  key('z');
  check('Z starts at a gentle 2x', tf() === 'scale(2)' && !$('zoomBadge').hidden && /2/.test($('zoomBadge').textContent), tf());
  key('+'); check('+ goes to 3x', tf() === 'scale(3)' && /3/.test($('zoomBadge').textContent), tf());
  key('+'); key('+'); key('+'); key('+');
  check('stops at 8x', tf() === 'scale(8)', tf());
  key('-'); check('- goes down a step (6x)', tf() === 'scale(6)', tf());
  key('-'); key('-'); key('-'); key('-');
  check('down to 1.5x', tf() === 'scale(1.5)', tf());
  key('-'); check('one more - zooms all the way out', tf() === '' && $('zoomBadge').hidden, tf());
  key('='); check('= zooms in from normal', tf() !== '' && !$('zoomBadge').hidden, tf());
  key('+'); key('+');
  key('z'); check('Z zooms out', tf() === '' && $('zoomBadge').hidden);
  key('z'); check('zoom level is remembered', tf() !== '' && tf() !== 'scale(2)', tf());
  key('ArrowRight'); await sleep(30);
  check('a decision zooms out', tf() === '' && $('zoomBadge').hidden);
  // mouse wheel
  const wheel = d => $('stage').dispatchEvent(new win.WheelEvent('wheel', { deltaY: d, bubbles: true, cancelable: true }));
  const before = zoomLevelOf();
  function zoomLevelOf(){ return tf(); }
  wheel(-100); await sleep(150);
  check('wheel up zooms in', tf() !== '', tf());
  const one = tf(); wheel(-100); await sleep(150);
  check('wheel up again zooms more', tf() !== one, one + ' -> ' + tf());
  console.log(failures ? failures + ' FAILED' : 'ALL PASSED');
  process.exit(failures ? 1 : 0);
})();
