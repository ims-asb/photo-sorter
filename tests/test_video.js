// Video clips: shown, kept or rejected, and copied as they are
const { JSDOM } = require('jsdom');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let failures = 0;
const check = (l, c, x) => { if (c) console.log('PASS', l); else { failures++; console.log('FAIL', l, x === undefined ? '' : x); } };
(async () => {
  const dom = await JSDOM.fromFile(require('path').join(__dirname,'..','index.html'), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/?passes=1',
    beforeParse(win){
      win.URL.createObjectURL = () => 'blob:x'; win.URL.revokeObjectURL = () => {}; win.matchMedia = () => ({ matches: true });
      const nf = () => new win.DOMException('nope','NotFoundError');
      win.fh = (n,t,c) => { const h={kind:'file',name:n,file:new win.File([c||n],n,{lastModified:t}),async getFile(){return h.file;},async createWritable(){return{async write(b){h.file=b;},async close(){}}}}; return h; };
      win.dh = (n) => { const kids=new Map(); const d={kind:'directory',name:n,kids,async*entries(){for(const e of kids)yield e;},
        async getFileHandle(x,o){ if(!kids.has(x)){ if(o&&o.create) kids.set(x,win.fh(x,Date.now(),'')); else throw nf(); } return kids.get(x);},
        async getDirectoryHandle(x,o){ if(!kids.has(x)){ if(o&&o.create) kids.set(x,win.dh(x)); else throw nf(); } return kids.get(x);} }; return d; };
    }
  });
  const win = dom.window, doc = win.document, $ = id => doc.getElementById(id);
  const key = k => doc.body.dispatchEvent(new win.KeyboardEvent('keydown', { key: k, bubbles: true }));
  const btn = re => Array.from($('sheet').querySelectorAll('button')).find(b => re.test(b.textContent));
  const dest = win.dh('Out'); win.showDirectoryPicker = async () => dest;
  await sleep(30);
  const mk = (n, t) => new win.File(['video-bytes-' + n], n, { lastModified: t, type: 'video/mp4' });
  Object.defineProperty($('fileInput'), 'files', { value: [mk('a.mp4',1), mk('b.mov',2), mk('c.webm',3), mk('d.mp4',4)], configurable: true });
  $('fileInput').dispatchEvent(new win.Event('change'));
  await sleep(150);
  check('four clips are in', $('count').textContent === '1 of 4', $('count').textContent);
  check('the video element is shown, the photo is hidden', !$('clip').hidden && $('photo').hidden);
  check('name and size are shown', /a\.mp4/.test($('fname').textContent) && /MB/.test($('fname').textContent), $('fname').textContent);
  check('hints mention play and sound', /Play or pause/.test($('hints').textContent) && /Sound on or off/.test($('hints').textContent) && !/Zoom/.test($('hints').textContent), $('hints').textContent);
  key('z'); check('zoom does nothing on a clip', !$('zoomBadge') || $('zoomBadge').hidden);
  check('sound is on by default', $('clip').muted === false);
  key('m'); check('M turns the sound off, with a note', /Sound off/.test($('note').textContent) && $('clip').muted === true, $('note').textContent);
  key('ArrowRight'); key('ArrowLeft'); key('ArrowUp'); key('ArrowRight'); await sleep(40);
  check('finish speaks of clips', /All clips sorted/.test($('sheet').textContent), $('sheet').textContent.slice(0, 80));
  check('the clip is hidden at the end', $('clip').hidden);
  btn(/Save sorted clips/).click(); await sleep(300);
  const out = [...dest.kids.values()].find(k => / - sorted$/.test(k.name));
  const names = d => d ? Array.from(d.kids.keys()).sort().join(',') : '(none)';
  check('kept clips copied with their own names', names(out && out.kids.get('Keep')) === 'a.mp4,d.mp4', names(out && out.kids.get('Keep')));
  check('flagged clip in post processing', names(out && out.kids.get('Needs post processing') && out.kids.get('Needs post processing').kids.get('Keep')) === 'c.webm');
  const a = out.kids.get('Keep').kids.get('a.mp4').file;
  check('copied byte for byte (no conversion)', a.size === 'video-bytes-a.mp4'.length, a.size);
  check('rejected clip not copied', !JSON.stringify([...out.kids.keys()]).includes('b.mov') && !Array.from(out.kids.values()).some(k => k.kids.has('b.mov')));
  check('summary says clips', /4 clips in, 3 kept, 1 rejected/.test($('sheet').textContent), $('sheet').textContent);
  console.log(failures ? failures + ' FAILED' : 'ALL PASSED');
  process.exit(failures ? 1 : 0);
})();
