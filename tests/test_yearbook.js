// the layout planner: every box inside its page's safe area, nothing overlapping, nothing near the fold
const { JSDOM } = require('jsdom');
let failures = 0;
const check = (l, c, x) => { if (c) console.log('PASS', l); else { failures++; console.log('FAIL', l, x === undefined ? '' : x); } };
(async () => {
  const dom = await JSDOM.fromFile(require('path').join(__dirname,'..','yearbook-planner.html'), { runScripts: 'dangerously', pretendToBeVisual: true });
  const win = dom.window, doc = win.document;
  const set = (id, v) => { const e = doc.getElementById(id); e.value = String(v); e.dispatchEvent(new win.Event('input')); };
  const cases = [
    ['straight', { nf: 3 }, 9], ['straight', { nf: 4 }, 11], ['straight', { nf: 5 }, 13],
    ['wrap', { nb: 3, nt: 0, ns: 2 }, 13], ['wrap', { nb: 2, nt: 2, ns: 3 }, 17], ['wrap', { nb: 0, nt: 0, ns: 0 }, 3]
  ];
  for (const [mode, opts, photos] of cases){
    set('mode', mode); for (const [k, v] of Object.entries(opts)) set(k, v);
    const { out, W, H, safe, gut } = win.yearbookPlanner.layout();
    const tag = mode + ' ' + JSON.stringify(opts);
    const ph = out.filter(b => b.kind !== 'text');
    check(`${tag}: ${photos} photos`, ph.length === photos, ph.length);
    const eps = 0.002;   // sizes are rounded to the nearest 0.001 in
    const inside = out.every(b => {
      const left = b.x < W ? [safe, W - gut] : [W + gut, 2 * W - safe];
      return b.x >= left[0] - eps && b.x + b.w <= left[1] + eps && b.y >= safe - eps && b.y + b.h <= H - safe + eps;
    });
    check(`${tag}: every box is inside the safe area and off the fold`, inside);
    let overlap = false;
    for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++){
      const a = out[i], c = out[j];
      if (a.x < c.x + c.w - eps && c.x < a.x + a.w - eps && a.y < c.y + c.h - eps && c.y < a.y + a.h - eps) overlap = true;
    }
    check(`${tag}: no boxes overlap`, !overlap);
    const star = out.find(b => b.id === 'Star photo'), tall = out.find(b => b.id === 'Tall photo A');
    const ratio = (star.w * star.h) / (tall.w * tall.h);
    check(`${tag}: star photo is 1.8 to 3.2 times a tall photo`, ratio > 1.8 && ratio < 3.2, ratio);
    if (mode === 'wrap'){
      const I = win.yearbookPlanner.layout().info, frames = out.filter(b => b.kind === 'frame');
      const clear = ['Star photo', 'Tall photo A', 'Tall photo B', 'Title', 'Caption', 'Paragraph'].every(id => {
        const b = out.find(x => x.id === id);
        return b.x >= I.inner.x - eps && b.y >= I.inner.y - eps && b.x + b.w <= I.inner.x + I.inner.w + eps && b.y + b.h <= I.inner.y + I.inner.h + eps;
      });
      check(`${tag}: photos and text sit inside the ring`, clear);
      const onStrip = frames.every(f => !(f.x >= I.inner.x - eps && f.x + f.w <= I.inner.x + I.inner.w + eps && f.y >= I.inner.y - eps && f.y + f.h <= I.inner.y + I.inner.h + eps));
      check(`${tag}: frames sit on the strip, not inside it`, onStrip);
    }
  }
  check('copy text lists the boxes', /Star photo:/.test(win.yearbookPlanner.sizesText()));
  check('svg drawn', doc.getElementById('svg').querySelectorAll('rect').length > 20);
  console.log(failures ? failures + ' FAILED' : 'ALL PASSED');
  process.exit(failures ? 1 : 0);
})();
