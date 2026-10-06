const { JSDOM } = require('jsdom');
const fs = require('fs');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let failures = 0;
const check = (l, c, x) => { if (c) console.log('PASS', l); else { failures++; console.log('FAIL', l, x === undefined ? '' : x); } };
const fx = n => fs.readFileSync(require('path').join(__dirname,'fx',n));
const P = fx('preview.jpg');
const eq = (a, b) => a.length === b.length && Buffer.compare(Buffer.from(a), Buffer.from(b)) === 0;

(async () => {
  const urls = new Map();
  const dom = await JSDOM.fromFile(require('path').join(__dirname,'..','index.html'), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/',
    beforeParse(win){
      // real Blob/File/streams from Node so slice(), arrayBuffer(), stream() and unzipping work
      win.File = File; win.Blob = Blob; win.Response = Response; win.DecompressionStream = DecompressionStream; win.TextDecoder = TextDecoder;
      win.URL.createObjectURL = b => { const u = 'blob:mock/' + urls.size; urls.set(u, b); return u; };
      win.URL.revokeObjectURL = () => {};
      win.matchMedia = () => ({ matches: true });
      win.createImageBitmap = async () => ({ width: 4, height: 3, close(){} });
      win.HTMLCanvasElement.prototype.getContext = () => ({ fillRect(){}, drawImage(){}, set fillStyle(v){} });
      win.HTMLCanvasElement.prototype.toBlob = function(cb, type){ cb(new Blob(['converted-jpg'], { type })); };
      win.showDirectoryPicker = async () => { throw new Error('unset'); };
      const nf = () => new win.DOMException('nope', 'NotFoundError');
      win.fh = (n, bytes, t) => { const h = { kind:'file', name:n, file: bytes ? new File([bytes], n, { lastModified: t }) : null,
        async getFile(){ return h.file; }, async createWritable(){ return { async write(b){ h.file = b; }, async close(){} }; } }; return h; };
      win.dh = n => { const kids = new Map(); const d = { kind:'directory', name:n, kids, async *entries(){ for (const e of kids) yield e; },
        async getFileHandle(x, o){ if (!kids.has(x)){ if (o && o.create) kids.set(x, win.fh(x, null, 0)); else throw nf(); } return kids.get(x); },
        async getDirectoryHandle(x, o){ if (!kids.has(x)){ if (o && o.create) kids.set(x, win.dh(x)); else throw nf(); } return kids.get(x); } }; return d; };
    }
  });
  const win = dom.window, doc = win.document, $ = id => doc.getElementById(id);
  const key = k => doc.body.dispatchEvent(new win.KeyboardEvent('keydown', { key: k, bubbles: true }));
  const drop = hs => { const ev = new win.Event('drop', { bubbles:true, cancelable:true }); ev.dataTransfer = { types:['Files'], items: hs.map(h => ({ kind:'file', getAsFileSystemHandle: async () => h })) }; win.dispatchEvent(ev); };
  const btn = re => Array.from($('sheet').querySelectorAll('button')).find(b => re.test(b.textContent));
  const bytesOf = async b => new Uint8Array(await b.arrayBuffer());

  const dest = win.dh('Out');
  win.showDirectoryPicker = async () => dest;
  await sleep(30);

  // ---- a zip with JPGs (deflate + stored), RAW pairs, junk, webp
  drop([win.fh('shoot.zip', fx('shoot.zip'), 5)]);
  await sleep(300);
  check('zip opened and sorting started', !$('sort').hidden, $('startMsg').textContent);
  check('5 photos from the zip (junk, txt, nested zip, RAW twin skipped)', $('count').textContent === '1 of 5', $('count').textContent);
  check('note explains the skipped RAW twin', /1 RAW file skipped because the JPG of the same shot is there/.test($('note').textContent), $('note').textContent);
  check('first photo by date is day1 IMG_0001.JPG', $('fname').textContent === 'IMG_0001.JPG', $('fname').textContent);

  // step through all five: look at what each one displays, then keep it
  const shown = [];
  for (let i = 0; i < 5; i++){ await sleep(40); shown.push($('fname').textContent); key('ArrowRight'); }
  check('order: day1 0001, 0002, RAW 0003, day2 0001, webp', shown.join(' | ') === 'IMG_0001.JPG | IMG_0002.JPG | IMG_0003.CR2 · RAW preview 1400×1000 | IMG_0001.JPG | pic.webp', shown.join(' | '));
  await sleep(40);
  check('finish panel at the end', !$('panel').hidden && /All photos sorted/.test($('sheet').textContent));
  check('save text says JPG or PNG', /Everything is saved as JPG or PNG/.test($('sheet').textContent));

  btn(/Save sorted/).click();
  await sleep(500);
  check('saved', /Saved/.test($('sheet').textContent), $('sheet').textContent.slice(0, 200));
  const keep = dest.kids.get(Array.from(dest.kids.keys()).find(k => / - sorted$/.test(k))).kids.get('Keep');
  const names = Array.from(keep.kids.keys()).sort();
  check('exported names are all jpg/png', names.join(',') === 'IMG_0001 (2).JPG,IMG_0001.JPG,IMG_0002.JPG,IMG_0003.jpg,pic.jpg', names.join(','));
  check('deflated entry unzipped correctly', eq(await bytesOf(keep.kids.get('IMG_0001.JPG').file), Buffer.from('jpgdata-day1-0001-'.repeat(800))));
  check('stored entry correct', eq(await bytesOf(keep.kids.get('IMG_0002.JPG').file), Buffer.from('stored-day1-0002')));
  check('same name from another folder kept, different bytes', eq(await bytesOf(keep.kids.get('IMG_0001 (2).JPG').file), Buffer.from('jpgdata-day2-0001-'.repeat(700))));
  check('webp converted to jpg', Buffer.from(await bytesOf(keep.kids.get('pic.jpg').file)).toString() === 'converted-jpg');

  // portrait CR2 export: preview bytes with an EXIF orientation 6 block right after the JPEG start
  const raw = await bytesOf(keep.kids.get('IMG_0003.jpg').file);
  const expect = Buffer.concat([P.subarray(0, 2), Buffer.from([0xFF,0xE1,0x00,0x22,0x45,0x78,0x69,0x66,0,0,0x49,0x49,0x2A,0,8,0,0,0,1,0,0x12,0x01,3,0,1,0,0,0,6,0,0,0,0,0,0,0]), P.subarray(2)]);
  check('CR2 export is the full-size preview with orientation 6 added', eq(raw, expect), `${raw.length} vs ${expect.length}`);
  check('the lossless RAW payload was not picked', raw.length < P.length + 100);

  // ---- loose CR2 files: landscape (no rotation added), preview far into a big file, and one with no preview
  btn(/Sort more/).click(); await sleep(30);
  const fl = win.fh('IMG_0200.CR2', fx('landscape.cr2'), 100);
  const fb = win.fh('IMG_0201.CR2', fx('late.cr2'), 200);
  const fn = win.fh('IMG_0202.CR2', fx('nopreview.cr2'), 300);
  drop([fl, fb, fn]);
  await sleep(300);
  check('three CR2 files loaded', $('count').textContent === '1 of 3', $('count').textContent);
  const seen = [];
  for (let i = 0; i < 3; i++){ await sleep(60); seen.push($('fname').textContent); key('ArrowRight'); }
  check('landscape and late previews found', /IMG_0200\.CR2 · RAW preview 1400×1000/.test(seen[0]) && /IMG_0201\.CR2 · RAW preview 1400×1000/.test(seen[1]), seen.join(' | '));
  check('no-preview RAW shows a clear message', /IMG_0202\.CR2 \(only a tiny 160×120 thumbnail is stored in this RAW file/.test(seen[2]), seen[2]);
  await sleep(50);
  btn(/Save sorted/).click();
  await sleep(700);
  check('save finishes and reports the one that failed', /2 photos copied/.test($('sheet').textContent) && /1 could not be saved: IMG_0202\.CR2/.test($('sheet').textContent), $('sheet').textContent.slice(0, 260));
  const keep2 = Array.from(dest.kids.entries()).filter(([k]) => / - sorted$/.test(k)).map(([, v]) => v.kids.get('Keep'));
  const allNames = keep2.flatMap(k => Array.from(k.kids.keys())).sort();
  check('RAW exports named .jpg', allNames.includes('IMG_0200.jpg') && allNames.includes('IMG_0201.jpg'), allNames.join(','));
  const land = await bytesOf(keep2.find(k => k.kids.has('IMG_0200.jpg')).kids.get('IMG_0200.jpg').file);
  check('landscape export is exactly the embedded preview (no changes)', eq(land, P));

  // ---- broken zip
  btn(/Sort more/).click(); await sleep(30);
  drop([win.fh('broken.zip', fx('broken.zip'), 9)]);
  await sleep(150);
  check('broken zip gives a clear message', /No photos found/.test($('startMsg').textContent) && /broken\.zip/.test($('startMsg').textContent), $('startMsg').textContent);

  win.close();
  console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
