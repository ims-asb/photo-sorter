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
  let win = await boot(); let doc = win.document; let $ = id => doc.getElementById(id);
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
